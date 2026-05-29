import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PublicationStatus, Platform, PackageSize } from '@crosspost/shared';
import { ListingCondition } from '@crosspost/shared';
import { VintedHttpClient } from '../http/vinted-http.client.js';
import {
  VintedWardrobeItemsResponseSchema,
  type VintedItem,
  type VintedWardrobeItemsResponse,
} from './vinted-api.schemas.js';
import {
  Listing,
  type ListingDocument,
} from '../../listings/schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../../publications/schemas/publication.schema.js';
import { ImageImporterService } from '../../media/image-importer.service.js';
import { normalizeTitle } from '../../listings/listing-title.util.js';
import { VINTED_WARDROBE_ITEMS_URL } from '../vinted-platform.config.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type {
  PlatformSyncAdapter,
  SyncResult,
} from '../../sync/platform-sync.types.js';

const PAGE_SIZE = 20;
const MAX_PAGES = 30; // garde-fou (max 600 annonces / sync)

@Injectable()
export class VintedSyncService implements PlatformSyncAdapter {
  private readonly logger = new Logger(VintedSyncService.name);

  constructor(
    private readonly client: VintedHttpClient,
    private readonly imageImporter: ImageImporterService,
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async sync(account: AccountDocument): Promise<SyncResult> {
    const userId = account.userId?.toString();
    if (!userId) {
      throw new Error(`Account ${account._id.toString()} sans userId`);
    }
    this.logger.log(`Sync Vinted pour ${account.email} (user ${userId})...`);

    const items = await this.fetchAllItems(account);
    this.logger.log(`  → ${items.length} annonces récupérées via l'API Vinted`);

    // Index titre→listingId existant (dédup cross-plateforme : ne pas recréer
    // une annonce déjà importée via LBC). Match sur titre normalisé.
    const existingByTitle = await this.buildTitleIndex(userId);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      const externalId = String(item.id);
      const exists = await this.publicationModel
        .findOne({
          accountId: account._id,
          platform: Platform.VINTED,
          externalId,
        })
        .lean()
        .exec();
      if (exists) {
        skipped++;
        continue;
      }

      try {
        await this.importItem(userId, account._id, item, existingByTitle);
        created++;
      } catch (err) {
        this.logger.error(
          `  ✗ Import item ${externalId} échoué: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    // Cleanup : annonces disparues côté Vinted → on retire leur Publication.
    const liveExternalIds = new Set(items.map((i) => String(i.id)));
    const deleteRes = await this.publicationModel
      .deleteMany({
        accountId: account._id,
        platform: Platform.VINTED,
        externalId: { $exists: true, $nin: Array.from(liveExternalIds) },
      })
      .exec();
    const removed = deleteRes.deletedCount ?? 0;
    if (removed > 0) {
      this.logger.log(
        `  → ${removed} publication(s) supprimée(s) (annonce(s) plus présente(s) sur Vinted)`,
      );
    }

    this.logger.log(
      `Sync Vinted terminé: ${created} créées, ${skipped} déjà présentes, ${removed} supprimées, ${errors} erreurs (sur ${items.length})`,
    );
    return { found: items.length, created, skipped, removed, errors };
  }

  /** Paginé : itère tant que current_page < total_pages. */
  private async fetchAllItems(account: AccountDocument): Promise<VintedItem[]> {
    const all: VintedItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL(VINTED_WARDROBE_ITEMS_URL(account.externalUserId));
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', String(PAGE_SIZE));
      url.searchParams.set('order', 'relevance');

      const res = await this.client.request<VintedWardrobeItemsResponse>(
        account,
        {
          method: 'GET',
          url: url.toString(),
          label: `vinted:sync:p${page}`,
          responseSchema: VintedWardrobeItemsResponseSchema,
        },
      );
      const payload = res.data;
      all.push(...payload.items);
      if (page >= payload.pagination.total_pages || payload.items.length === 0) {
        break;
      }
    }
    return all;
  }

  /** Map titre normalisé → listingId, pour tous les listings de l'user. */
  private async buildTitleIndex(
    userId: string,
  ): Promise<Map<string, Types.ObjectId>> {
    const listings = await this.listingModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('_id title')
      .lean()
      .exec();
    const map = new Map<string, Types.ObjectId>();
    for (const l of listings) {
      map.set(normalizeTitle(l.title), l._id);
    }
    return map;
  }

  /**
   * Crée la Publication Vinted. Si un Listing au même titre existe déjà
   * (synced via LBC), on le réutilise au lieu d'en recréer un.
   */
  private async importItem(
    userId: string,
    accountId: Types.ObjectId,
    item: VintedItem,
    existingByTitle: Map<string, Types.ObjectId>,
  ): Promise<void> {
    const externalId = String(item.id);
    const externalUrl = item.url ?? `https://www.vinted.fr/items/${externalId}`;

    let listingId = existingByTitle.get(normalizeTitle(item.title));

    if (!listingId) {
      // Pas d'annonce existante → on en crée une depuis les données Vinted.
      const imageUrls = pickImageUrls(item);
      const media = imageUrls.length
        ? await this.imageImporter.importMany(userId, imageUrls)
        : [];

      const listing = await this.listingModel.create({
        userId: new Types.ObjectId(userId),
        title: item.title,
        description: item.title, // l'API wardrobe n'expose pas la description
        price: extractPrice(item),
        condition: mapCondition(item.status),
        packageSize: PackageSize.M,
        media,
      });
      listingId = listing._id;
      existingByTitle.set(normalizeTitle(item.title), listingId);
    }

    await this.publicationModel.create({
      listingId,
      accountId,
      platform: Platform.VINTED,
      status: PublicationStatus.PUBLISHED,
      externalId,
      externalUrl,
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractPrice(item: VintedItem): number {
  const amount = item.price?.amount;
  const n = amount ? Number.parseFloat(amount) : 0;
  return Number.isFinite(n) ? n : 0;
}

function pickImageUrls(item: VintedItem): string[] {
  return item.photos
    .map((p) => p.full_size_url ?? p.url)
    .filter((u): u is string => !!u);
}

const VINTED_STATUS_TO_CONDITION: Record<string, ListingCondition> = {
  'neuf avec étiquette': ListingCondition.NEW_WITH_TAGS,
  'neuf sans étiquette': ListingCondition.NEW_WITHOUT_TAGS,
  'très bon état': ListingCondition.VERY_GOOD,
  'bon état': ListingCondition.GOOD,
  satisfaisant: ListingCondition.FAIR,
};

function mapCondition(status?: string): ListingCondition | null {
  if (!status) return null;
  return VINTED_STATUS_TO_CONDITION[status.trim().toLowerCase()] ?? null;
}

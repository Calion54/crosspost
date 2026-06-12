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
  Publication,
  type PublicationDocument,
} from '../../publications/schemas/publication.schema.js';
import { ListingReuseService } from '../../listings/listing-reuse.service.js';
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
    private readonly reuse: ListingReuseService,
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

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      const externalId = String(item.id);
      const existing = await this.publicationModel
        .findOne({
          accountId: account._id,
          platform: Platform.VINTED,
          externalId,
        })
        .exec();
      if (existing) {
        // Réconciliation idempotente du statut de la publication (PUBLISHED↔SOLD)
        // d'après l'état Vinted courant.
        const status = extractStatus(item);
        if (existing.status !== status) {
          await this.publicationModel
            .updateOne({ _id: existing._id }, { $set: { status } })
            .exec();
          await this.reuse.reconcileListingSold(existing.listingId);
          this.logger.log(`  → publication ${externalId} → ${status}`);
        }
        skipped++;
        continue;
      }

      try {
        await this.importItem(userId, account._id, item);
        created++;
      } catch (err) {
        this.logger.error(
          `  ✗ Import item ${externalId} échoué: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    // Cleanup : annonces disparues côté Vinted → on retire leur Publication,
    // SAUF les publications déjà marquées vendues (on garde pour stats / historique).
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

  /**
   * Extrait les champs Vinted puis délègue la dédup + création à
   * ListingReuseService (logique partagée avec Leboncoin).
   */
  private async importItem(
    userId: string,
    accountId: Types.ObjectId,
    item: VintedItem,
  ): Promise<void> {
    const externalId = String(item.id);
    const externalUrl = item.url ?? `https://www.vinted.fr/items/${externalId}`;

    await this.reuse.importSyncedListing({
      userId,
      accountId,
      platform: Platform.VINTED,
      title: item.title,
      price: extractPrice(item),
      imageUrls: pickImageUrls(item),
      fields: {
        description: item.title, // l'API wardrobe n'expose pas la description
        packageSize: PackageSize.M,
        condition: mapCondition(item.status),
      },
      externalId,
      externalUrl,
      status: extractStatus(item),
      publishedAt: extractPublishedAt(item),
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

/**
 * La date de publication n'est pas exposée directement par l'API wardrobe.
 * On utilise le timestamp d'upload de la 1ère photo (Unix seconds) comme
 * proxy — l'utilisateur upload les photos juste avant de submit, donc c'est
 * fiable à <1 min près.
 */
function extractPublishedAt(item: VintedItem): Date | undefined {
  const ts = item.photos[0]?.high_resolution?.timestamp;
  return ts ? new Date(ts * 1000) : undefined;
}

/**
 * Statut de la publication depuis Vinted. Détection stricte : SOLD seulement
 * si `item_closing_action === 'sold'` ; tout le reste (actif, reserved,
 * not_sold…) = PUBLISHED.
 */
function extractStatus(item: VintedItem): PublicationStatus {
  return item.is_closed && item.item_closing_action === 'sold'
    ? PublicationStatus.SOLD
    : PublicationStatus.PUBLISHED;
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

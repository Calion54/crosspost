import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PublicationStatus, Platform } from '@crosspost/shared';
import { LeboncoinHttpClient } from '../http/leboncoin-http.client.js';
import { LeboncoinCategoryMapper } from './leboncoin-category.mapper.js';
import { LeboncoinAttributeMapper } from './leboncoin-attribute.mapper.js';
import {
  LbcDashboardSearchResponseSchema,
  type LbcAd,
  type LbcDashboardSearchResponse,
} from './lbc-api.schemas.js';
import {
  Publication,
  type PublicationDocument,
} from '../../publications/schemas/publication.schema.js';
import { ListingReuseService } from '../../listings/listing-reuse.service.js';
import {
  LBC_DASHBOARD_SEARCH_URL,
  LBC_WEB_HOST,
} from '../leboncoin-platform.config.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type {
  PlatformSyncAdapter,
  SyncResult,
} from '../../sync/platform-sync.types.js';

const PAGE_SIZE = 50;
const MAX_PAGES = 20; // garde-fou (max 1000 annonces / sync — assez large)

// Statuses LBC qui indiquent qu'une annonce n'existe plus côté plateforme et
// dont la Publication doit être nettoyée. La liste est conservative — si on
// en oublie un, on le verra dans le log "Ad … status=…" ci-dessous et on
// l'ajoutera ici.
const DEAD_LBC_STATUSES = new Set([
  'deleted',
  'refused',
  'refused_admin',
  'expired',
]);

@Injectable()
export class LeboncoinSyncService implements PlatformSyncAdapter {
  private readonly logger = new Logger(LeboncoinSyncService.name);

  constructor(
    private readonly client: LeboncoinHttpClient,
    private readonly categoryMapper: LeboncoinCategoryMapper,
    private readonly attributeMapper: LeboncoinAttributeMapper,
    private readonly reuse: ListingReuseService,
    @InjectModel(Publication.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async sync(account: AccountDocument): Promise<SyncResult> {
    const userId = account.userId?.toString();
    if (!userId) {
      throw new Error(`Account ${account._id.toString()} sans userId`);
    }
    this.logger.log(
      `Sync LBC pour ${account.email} (user ${userId})...`,
    );

    const ads = await this.fetchAllAds(account);
    this.logger.log(`  → ${ads.length} annonces récupérées via l'API LBC`);

    // Log explicite des statuts pour faire le tri "vivante" vs "morte".
    // Si une annonce supprimée reste publiée côté Crosspost, c'est ici qu'on
    // verra quel status LBC lui attribue → on l'ajoutera à DEAD_LBC_STATUSES.
    for (const ad of ads) {
      this.logger.debug(
        `Ad ${ad.list_id} status=${ad.status ?? '?'} subject="${ad.subject}"`,
      );
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const ad of ads) {
      const externalId = String(ad.list_id);
      const exists = await this.publicationModel
        .findOne({
          accountId: account._id,
          platform: Platform.LEBONCOIN,
          externalId,
        })
        .lean()
        .exec();
      if (exists) {
        skipped++;
        continue;
      }

      // Pas la peine d'importer une annonce qui est déjà morte côté LBC.
      if (ad.status && DEAD_LBC_STATUSES.has(ad.status)) {
        skipped++;
        continue;
      }

      try {
        await this.importAd(userId, account._id, ad);
        created++;
      } catch (err) {
        this.logger.error(
          `  ✗ Import ad ${externalId} échoué: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    // Cleanup : les annonces supprimées côté LBC doivent perdre leur Publication.
    // Une annonce est "vivante" si elle est renvoyée par l'API ET que son
    // status n'est pas dans DEAD_LBC_STATUSES (LBC peut renvoyer une annonce
    // supprimée avec status="deleted" — il faut donc l'exclure ici aussi).
    const liveExternalIds = new Set(
      ads
        .filter((ad) => !ad.status || !DEAD_LBC_STATUSES.has(ad.status))
        .map((ad) => String(ad.list_id)),
    );
    const deleteRes = await this.publicationModel
      .deleteMany({
        accountId: account._id,
        platform: Platform.LEBONCOIN,
        externalId: { $exists: true, $nin: Array.from(liveExternalIds) },
      })
      .exec();
    const removed = deleteRes.deletedCount ?? 0;
    if (removed > 0) {
      this.logger.log(
        `  → ${removed} publication(s) supprimée(s) (annonce(s) plus présente(s) sur LBC)`,
      );
    }

    this.logger.log(
      `Sync LBC terminé: ${created} créées, ${skipped} déjà présentes, ${removed} supprimées, ${errors} erreurs (sur ${ads.length})`,
    );
    return { found: ads.length, created, skipped, removed, errors };
  }

  /** Paginé : itère sur les pages tant que l'API renvoie des résultats. */
  private async fetchAllAds(account: AccountDocument): Promise<LbcAd[]> {
    const all: LbcAd[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      const res = await this.client.request(account, {
        method: 'POST',
        url: LBC_DASHBOARD_SEARCH_URL,
        label: `lbc:sync:p${page}`,
        responseSchema: LbcDashboardSearchResponseSchema,
        data: {
          context: 'default',
          filters: { owner: { user_id: account.externalUserId } },
          limit: PAGE_SIZE,
          offset,
          sort_by: 'time',
          sort_order: 'desc',
          include_inactive: true,
          include_draft: true,
        },
      });
      const payload = res.data as LbcDashboardSearchResponse;
      const batch = payload.ads;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break; // dernière page
    }
    return all;
  }

  /**
   * Extrait les champs LBC puis délègue la dédup + création à
   * ListingReuseService (logique partagée avec Vinted).
   */
  private async importAd(
    userId: string,
    accountId: Types.ObjectId,
    ad: LbcAd,
  ): Promise<void> {
    const externalId = String(ad.list_id);
    const externalUrl = ad.url ?? `${LBC_WEB_HOST}/ad/${externalId}.htm`;
    const category = await this.categoryMapper.toUniversal(ad.category_name);
    const { condition, color, packageSize } = this.attributeMapper.parse(ad);

    await this.reuse.importSyncedListing({
      userId,
      accountId,
      platform: Platform.LEBONCOIN,
      title: ad.subject,
      price: extractPrice(ad),
      imageUrls: pickImageUrls(ad),
      fields: {
        description: ad.body ?? '',
        packageSize, // M par défaut
        category,
        condition, // null si pas trouvé dans les attributes
        color, // null si pas trouvé
        // location est gérée au niveau User.defaultLocation (page Settings).
      },
      externalId,
      externalUrl,
      status: PublicationStatus.PUBLISHED,
      publishedAt: parseLbcPublishedAt(ad.first_publication_date),
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractPrice(ad: LbcAd): number {
  if (typeof ad.price === 'number') return ad.price;
  if (Array.isArray(ad.price) && ad.price.length > 0) return ad.price[0];
  return 0;
}

/**
 * Parse le format LBC `"YYYY-MM-DD HH:mm:ss"` (heure Paris).
 * Interprété comme local time du serveur — décalage de 1-2h possible vs UTC,
 * négligeable pour un tri par date de publication.
 */
function parseLbcPublishedAt(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? undefined : d;
}


function pickImageUrls(ad: LbcAd): string[] {
  const images = ad.images;
  if (!images) return [];
  // Préférer urls (qualité originale) > urls_large > urls_thumb (vraiment small)
  return images.urls ?? images.urls_large ?? images.urls_thumb ?? [];
}

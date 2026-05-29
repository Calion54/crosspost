import { Injectable, Logger } from '@nestjs/common';
import { PackageSize } from '@crosspost/shared';
import { VintedHttpClient } from '../../http/vinted-http.client.js';
import {
  VINTED_ITEMS_URL,
  VINTED_NEW_ITEM_PAGE,
  VINTED_WEB_HOST,
} from '../../vinted-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';
import {
  VintedSubmitItemResponseSchema,
  type VintedSubmitItemResponse,
} from '../vinted-publish.schemas.js';

/**
 * Step 7 (final) — Submit l'annonce sur Vinted.
 *
 * POST /api/v2/item_upload/items
 *
 * Le body est construit à partir du contexte :
 *  - root : `brand_id`/`brand`, `color_ids`, `catalog_id`, `assigned_photos`,
 *           prix/titre/description, `temp_uuid` == `upload_session_id`
 *  - `item_attributes` : tous les autres attributs résolus (condition,
 *           video_game_*, etc.) au format `{code, ids:[id]}`.
 *
 * NOTE: `package_size_id` est résolu via `ctx.packageSizes` (rempli par
 * `fetch-package-sizes`). Les ids sont **dynamiques par catégorie**, on mappe
 * `listing.packageSize` (S/M/L) par index dans le tableau (avec clamp si la
 * catégorie expose moins de 3 tailles).
 */
@Injectable()
export class VintedSubmitItemStep implements PublishStep<VintedPublishContext> {
  readonly name = 'submit-item';

  private readonly logger = new Logger(VintedSubmitItemStep.name);

  constructor(private readonly client: VintedHttpClient) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    if (!ctx.categoryId) throw new Error('Submit Vinted : categoryId absent');
    if (!ctx.uploadSessionId)
      throw new Error('Submit Vinted : uploadSessionId absent');
    if (!ctx.uploadedPhotos?.length)
      throw new Error('Submit Vinted : aucune photo uploadée');
    if (!ctx.resolvedAttrs)
      throw new Error('Submit Vinted : resolvedAttrs absent');
    if (!ctx.packageSizes?.length)
      throw new Error(
        'Submit Vinted : packageSizes absent (step fetch-package-sizes manqué ?)',
      );

    const body = this.buildBody(ctx);

    const res = await this.client.request<VintedSubmitItemResponse>(
      ctx.account,
      {
        method: 'POST',
        url: VINTED_ITEMS_URL,
        data: body,
        label: 'vinted:publish:submit-item',
        responseSchema: VintedSubmitItemResponseSchema,
        headers: {
          Accept: 'application/json,text/plain,*/*,image/webp',
          'Content-Type': 'application/json',
          locale: 'fr-FR',
          Origin: VINTED_WEB_HOST,
          Referer: VINTED_NEW_ITEM_PAGE,
          'x-enable-dynamic-attribute-condition': 'true',
          'x-enable-dynamic-attribute-size': 'true',
          'x-enable-dynamic-attribute-video-game-rating': 'true',
          'x-upload-form': 'true',
        },
      },
    );

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Submit Vinted HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 500)}`,
      );
    }

    const itemId = res.data.item.id;
    if (itemId == null) {
      throw new Error(
        `Submit Vinted : item.id null dans une réponse 2xx — body: ${JSON.stringify(res.data)?.slice(0, 500)}`,
      );
    }

    ctx.externalId = String(itemId);
    ctx.externalUrl = `${VINTED_WEB_HOST}/items/${itemId}`;
    this.logger.log(
      `Annonce Vinted créée : id=${itemId} → ${ctx.externalUrl}`,
    );
  }

  /**
   * Construit le body JSON pour POST /items. Promu en root: brand, color,
   * catégorie. Le reste va dans `item_attributes`.
   */
  private buildBody(ctx: VintedPublishContext): Record<string, unknown> {
    const resolved = ctx.resolvedAttrs!;

    const brandId = resolved.brand ?? null;
    const brandTitle =
      brandId != null
        ? (ctx.brandCatalog ?? []).find((b) => b.id === brandId)?.title ?? null
        : null;

    const colorIds = resolved.color != null ? [resolved.color] : [];

    // Tout sauf brand/color va dans item_attributes (condition, video_game_*, …)
    const itemAttributes = Object.entries(resolved)
      .filter(([code]) => code !== 'brand' && code !== 'color')
      .map(([code, id]) => ({ code, ids: [id] }));

    const assignedPhotos = (ctx.uploadedPhotos ?? []).map((p) => ({
      id: p.id,
      orientation: 0,
    }));

    const item: Record<string, unknown> = {
      id: null,
      currency: 'EUR',
      temp_uuid: ctx.uploadSessionId,
      title: ctx.listing.title,
      description: ctx.listing.description,
      brand_id: brandId,
      brand: brandTitle,
      catalog_id: ctx.categoryId,
      isbn: null,
      is_unisex: false,
      ai_photo: false,
      price: ctx.listing.price,
      package_size_id: pickPackageSizeId(ctx),
      shipment_prices: { domestic: null, international: null },
      color_ids: colorIds,
      assigned_photos: assignedPhotos,
      measurement_length: null,
      measurement_width: null,
      item_attributes: itemAttributes,
      manufacturer: null,
      manufacturer_labelling: null,
    };

    return {
      item,
      feedback_id: null,
      push_up: false,
      parcel: null,
      upload_session_id: ctx.uploadSessionId,
    };
  }
}

/**
 * Mappe `listing.packageSize` → id Vinted via l'index dans `ctx.packageSizes`.
 * S/M/L = index 0/1/2 dans la liste triée par capacité croissante. Si la
 * catégorie expose moins de tailles que demandé (rare), on clamp sur la plus
 * grande disponible.
 */
const PACKAGE_SIZE_TO_INDEX: Record<PackageSize, number> = {
  [PackageSize.S]: 0,
  [PackageSize.M]: 1,
  [PackageSize.L]: 2,
};

function pickPackageSizeId(ctx: VintedPublishContext): number {
  const sizes = ctx.packageSizes!;
  const wanted = PACKAGE_SIZE_TO_INDEX[ctx.listing.packageSize];
  const idx = Math.min(wanted, sizes.length - 1);
  return sizes[idx].id;
}

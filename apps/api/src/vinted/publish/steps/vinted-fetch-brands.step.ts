import { Injectable, Logger } from '@nestjs/common';
import { VintedHttpClient } from '../../http/vinted-http.client.js';
import {
  VINTED_BRANDS_URL,
  VINTED_NEW_ITEM_PAGE,
} from '../../vinted-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';
import {
  VintedBrandsResponseSchema,
  type VintedBrandsResponse,
} from '../vinted-publish.schemas.js';

/**
 * Step 4 (conditionnel) — Récupère le catalogue de marques curaté pour la
 * catégorie, si l'attribut `brand` est requis.
 *
 * GET /api/v2/item_upload/brands?category_id=<catId>  header `mda-brand: true`
 *
 * Vinted renvoie ~40-60 marques fréquentes pour la catégorie (pas le catalogue
 * complet) + `disable_custom_brands` qui dit si on peut envoyer une marque en
 * texte libre.
 *
 * No-op pour les catégories sans `brand` dans le schéma (ex: video games).
 */
@Injectable()
export class VintedFetchBrandsStep implements PublishStep<VintedPublishContext> {
  readonly name = 'fetch-brands';

  private readonly logger = new Logger(VintedFetchBrandsStep.name);

  constructor(private readonly client: VintedHttpClient) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    if (!ctx.attributesSchema) {
      throw new Error(
        'Fetch brands : attributesSchema absent (step fetch-attribute-schema manqué ?)',
      );
    }
    if (!ctx.categoryId) {
      throw new Error('Fetch brands : catégorie absente');
    }

    const needsBrand = ctx.attributesSchema.some((a) => a.code === 'brand');
    if (!needsBrand) {
      this.logger.log(
        `Catégorie ${ctx.categoryId} ne requiert pas de marque — skip`,
      );
      return;
    }

    const url = new URL(VINTED_BRANDS_URL);
    url.searchParams.set('category_id', String(ctx.categoryId));

    const res = await this.client.request<VintedBrandsResponse>(ctx.account, {
      method: 'GET',
      url: url.toString(),
      label: 'vinted:publish:fetch-brands',
      responseSchema: VintedBrandsResponseSchema,
      headers: {
        Accept: 'application/json,text/plain,*/*,image/webp',
        locale: 'fr-FR',
        'mda-brand': 'true',
        Referer: VINTED_NEW_ITEM_PAGE,
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Fetch brands Vinted HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
      );
    }

    ctx.brandCatalog = res.data.brands;
    ctx.disableCustomBrands = res.data.disable_custom_brands ?? false;

    this.logger.log(
      `${res.data.brands.length} marque(s) curatée(s) pour catégorie ${ctx.categoryId} ` +
        `(custom brands ${ctx.disableCustomBrands ? 'désactivé' : 'autorisé'})`,
    );
  }
}

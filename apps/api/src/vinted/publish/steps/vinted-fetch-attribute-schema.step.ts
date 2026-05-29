import { Injectable, Logger } from '@nestjs/common';
import { VintedHttpClient } from '../../http/vinted-http.client.js';
import {
  VINTED_ATTRIBUTES_URL,
  VINTED_NEW_ITEM_PAGE,
  VINTED_WEB_HOST,
} from '../../vinted-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';
import {
  VintedAttributesResponseSchema,
  type VintedAttributesResponse,
} from '../vinted-publish.schemas.js';

/**
 * Step 3 — Récupère le schéma dynamique des attributs pour la catégorie.
 *
 * POST /api/v2/item_upload/attributes  body {attributes:[{code:"category", value:[catId]}]}
 *
 * Réponse : array d'attributs (brand, condition, color, size…). Chaque attribut
 * a soit ses options inline (`configuration.options`), soit `configuration:null`
 * → le catalogue est à fetcher séparément (step suivant : enrich-options).
 *
 * Les trois headers `x-enable-dynamic-attribute-*` sont envoyés systématiquement —
 * ils débloquent les options inline pour condition/size/video-game-rating.
 */
@Injectable()
export class VintedFetchAttributeSchemaStep
  implements PublishStep<VintedPublishContext>
{
  readonly name = 'fetch-attribute-schema';

  private readonly logger = new Logger(VintedFetchAttributeSchemaStep.name);

  constructor(private readonly client: VintedHttpClient) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    if (!ctx.categoryId) {
      throw new Error(
        'Fetch attribute schema : catégorie absente (step resolve-category manqué ?)',
      );
    }

    const body = {
      attributes: [{ code: 'category', value: [ctx.categoryId] }],
    };

    const res = await this.client.request<VintedAttributesResponse>(
      ctx.account,
      {
        method: 'POST',
        url: VINTED_ATTRIBUTES_URL,
        data: body,
        label: 'vinted:publish:fetch-attribute-schema',
        responseSchema: VintedAttributesResponseSchema,
        headers: {
          Accept: 'application/json,text/plain,*/*,image/webp',
          'Content-Type': 'application/json',
          'accept-features': 'ALL',
          locale: 'fr-FR',
          Origin: VINTED_WEB_HOST,
          Referer: VINTED_NEW_ITEM_PAGE,
          'x-enable-dynamic-attribute-condition': 'true',
          'x-enable-dynamic-attribute-size': 'true',
          'x-enable-dynamic-attribute-video-game-rating': 'true',
        },
      },
    );

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Fetch attribute schema Vinted HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
      );
    }

    ctx.attributesSchema = res.data.attributes;

    const inline = res.data.attributes.filter(
      (a) => a.configuration?.options?.length,
    ).length;
    const external = res.data.attributes.length - inline;
    this.logger.log(
      `${res.data.attributes.length} attribut(s) requis pour catégorie ${ctx.categoryId} ` +
        `(${inline} avec options inline, ${external} à enrichir via catalogue externe) : ` +
        res.data.attributes.map((a) => a.code).join(', '),
    );
  }
}

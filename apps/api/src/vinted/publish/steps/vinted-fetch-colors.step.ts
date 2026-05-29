import { Injectable, Logger } from '@nestjs/common';
import { VintedHttpClient } from '../../http/vinted-http.client.js';
import {
  VINTED_COLORS_URL,
  VINTED_NEW_ITEM_PAGE,
} from '../../vinted-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';
import {
  VintedColorsResponseSchema,
  type VintedColorsResponse,
} from '../vinted-publish.schemas.js';

/**
 * Step 5 (conditionnel) — Récupère le catalogue de couleurs Vinted si
 * l'attribut `color` est requis pour la catégorie.
 *
 * GET /api/v2/item_upload/colors  → ~29 couleurs (catalogue global, pas de
 * query param). Le résolveur LLM mappe ensuite la couleur de l'item depuis
 * titre/description vers un id de cette liste.
 */
@Injectable()
export class VintedFetchColorsStep implements PublishStep<VintedPublishContext> {
  readonly name = 'fetch-colors';

  private readonly logger = new Logger(VintedFetchColorsStep.name);

  constructor(private readonly client: VintedHttpClient) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    if (!ctx.attributesSchema) {
      throw new Error(
        'Fetch colors : attributesSchema absent (step fetch-attribute-schema manqué ?)',
      );
    }

    const needsColor = ctx.attributesSchema.some((a) => a.code === 'color');
    if (!needsColor) {
      this.logger.log(
        `Catégorie ${ctx.categoryId} ne requiert pas de couleur — skip`,
      );
      return;
    }

    const res = await this.client.request<VintedColorsResponse>(ctx.account, {
      method: 'GET',
      url: VINTED_COLORS_URL,
      label: 'vinted:publish:fetch-colors',
      responseSchema: VintedColorsResponseSchema,
      headers: {
        Accept: 'application/json,text/plain,*/*,image/webp',
        locale: 'fr-FR',
        Referer: VINTED_NEW_ITEM_PAGE,
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Fetch colors Vinted HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
      );
    }

    ctx.colorCatalog = res.data.colors;
    this.logger.log(`${res.data.colors.length} couleur(s) chargée(s)`);
  }
}

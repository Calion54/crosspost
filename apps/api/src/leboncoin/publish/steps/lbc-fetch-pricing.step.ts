import { Injectable, Logger } from '@nestjs/common';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_DEPOSIT_PAGE,
  LBC_PRICING_URL,
} from '../../leboncoin-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcPricingResponseSchema,
  type LbcPricingResponse,
} from '../leboncoin-publish.schemas.js';

/**
 * Step 7 — Récupère le `pricing_id` de l'écran "options".
 *
 * POST /api/options/v5/pricing/classifieds
 *
 * Entre la création (submit-ad) et la confirmation (confirm-ad), le front
 * charge l'écran des options payantes. Cet appel renvoie le `pricing_id`
 * qu'on doit passer au confirm. On ne sélectionne aucune option payante
 * (`selected_packs: []`).
 */
@Injectable()
export class LbcFetchPricingStep implements PublishStep<LbcPublishContext> {
  readonly name = 'fetch-pricing';

  private readonly logger = new Logger(LbcFetchPricingStep.name);

  constructor(private readonly client: LeboncoinHttpClient) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    if (!ctx.externalId) {
      throw new Error('Pricing LBC : ad_id absent (step submit-ad manqué ?)');
    }
    if (!ctx.category?.id) {
      throw new Error('Pricing LBC : catégorie absente (step classify manqué ?)');
    }

    const adId = Number.parseInt(ctx.externalId, 10);
    const body = {
      user_journey: 'deposit',
      page_name: 'option',
      classifieds: [
        {
          ad_id: adId,
          category: ctx.category.id,
          action_id: ctx.actionId ?? 1,
        },
      ],
      is_edit_refused: false,
      selected_packs: [],
    };

    const res = await this.client.request<LbcPricingResponse>(ctx.account, {
      method: 'POST',
      url: LBC_PRICING_URL,
      data: body,
      label: 'lbc:publish:pricing',
      responseSchema: LbcPricingResponseSchema,
      headers: {
        Accept: 'application/json',
        Referer: `${LBC_DEPOSIT_PAGE}/options`,
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Pricing LBC HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
      );
    }

    ctx.pricingId = res.data.pricing_id;
    this.logger.log(`pricing_id récupéré : ${ctx.pricingId}`);
  }
}

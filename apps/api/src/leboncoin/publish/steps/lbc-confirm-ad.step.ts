import { Injectable, Logger } from '@nestjs/common';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_CONFIRM_SUBMIT_URL,
  LBC_DEPOSIT_PAGE,
} from '../../leboncoin-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcConfirmSubmitResponseSchema,
  type LbcConfirmSubmitResponse,
} from '../leboncoin-publish.schemas.js';

/**
 * Step final — Confirme le dépôt de l'annonce.
 *
 * POST /api/services/v4/submit
 *
 * Après la création de l'annonce (step submit-ad), LBC attend une confirmation
 * de l'écran "options" : on valide le dépôt avec les options gratuites (aucune
 * option payante → `options: []`). Sans cet appel, l'annonce reste en attente.
 *
 * Body :
 *   { ads: [{ ad_type, ad_id, options: [], action_id, transaction_type: "new_ad" }],
 *     pricing_id, user_journey: "deposit" }
 */
@Injectable()
export class LbcConfirmAdStep implements PublishStep<LbcPublishContext> {
  readonly name = 'confirm-ad';

  private readonly logger = new Logger(LbcConfirmAdStep.name);

  constructor(private readonly client: LeboncoinHttpClient) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    if (!ctx.externalId) {
      throw new Error('Confirm LBC : ad_id absent (step submit-ad manqué ?)');
    }
    if (!ctx.pricingId) {
      throw new Error(
        'Confirm LBC : pricing_id absent de la réponse submit — impossible de confirmer',
      );
    }

    const adId = Number.parseInt(ctx.externalId, 10);
    const body = {
      ads: [
        {
          ad_type: 'sell',
          ad_id: adId,
          options: [],
          action_id: ctx.actionId ?? 1,
          transaction_type: 'new_ad',
        },
      ],
      pricing_id: ctx.pricingId,
      user_journey: 'deposit',
    };

    const res = await this.client.request<LbcConfirmSubmitResponse>(
      ctx.account,
      {
        method: 'POST',
        url: LBC_CONFIRM_SUBMIT_URL,
        data: body,
        label: 'lbc:publish:confirm',
        responseSchema: LbcConfirmSubmitResponseSchema,
        headers: {
          Accept: 'application/json',
          Referer: `${LBC_DEPOSIT_PAGE}/options`,
        },
      },
    );

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Confirm LBC HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
      );
    }

    this.logger.log(`Annonce LBC confirmée : ad_id=${adId}`);
  }
}

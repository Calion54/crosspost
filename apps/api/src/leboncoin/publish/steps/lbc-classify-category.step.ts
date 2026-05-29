import { Injectable, Logger } from '@nestjs/common';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_CLASSIFY_URL,
  LBC_DEPOSIT_PAGE,
} from '../../leboncoin-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcClassifyResponseSchema,
  type LbcClassifiedCategory,
} from '../leboncoin-publish.schemas.js';

/**
 * Step 1 — Classifier la catégorie à partir du titre de l'annonce.
 *
 * GET /api/ad-classifier/v2/classify?q=<title>&isPro=false
 *
 * Réponse : array de candidats triés par score (top en premier). On prend
 * le premier et on l'écrit dans `ctx.category`. Le `predictionId` est conservé
 * pour les steps suivants (LBC tracke ses prédictions A/B).
 */
@Injectable()
export class LbcClassifyCategoryStep implements PublishStep<LbcPublishContext> {
  readonly name = 'classify-category';

  private readonly logger = new Logger(LbcClassifyCategoryStep.name);

  constructor(private readonly client: LeboncoinHttpClient) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    const url = new URL(LBC_CLASSIFY_URL);
    url.searchParams.set('q', ctx.listing.title);
    url.searchParams.set('isPro', 'false');

    const res = await this.client.request<LbcClassifiedCategory[]>(
      ctx.account,
      {
        method: 'GET',
        url: url.toString(),
        label: 'lbc:publish:classify',
        responseSchema: LbcClassifyResponseSchema,
        headers: {
          Referer: LBC_DEPOSIT_PAGE,
        },
      },
    );

    const candidates = res.data;
    if (!candidates.length) {
      throw new Error(
        `Aucune catégorie suggérée par LBC pour "${ctx.listing.title}"`,
      );
    }
    const top = candidates[0];
    ctx.category = {
      id: top.id,
      topId: top.topID,
      name: top.name,
      predictionId: top.category_reco_prediction_id,
    };
    this.logger.log(
      `Catégorie LBC : "${top.name}" (id=${top.id}, topId=${top.topID})`,
    );
  }
}

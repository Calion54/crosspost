import { Injectable, Logger } from '@nestjs/common';
import { PackageSize } from '@crosspost/shared';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_DEPOSIT_PAGE,
  LBC_SHIPPING_PREDICT_URL,
} from '../../leboncoin-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcShippingPredictResponseSchema,
  type LbcShippingPredictResponse,
} from '../leboncoin-publish.schemas.js';
import type { LbcDepositConfigResponse } from '../leboncoin-deposit-schema.schemas.js';

/**
 * Step 5 — Récupère les options de livraison + prediction_id auprès de LBC.
 *
 * POST /api/consumergoods/proxy/v2/pages/ad-submit
 *
 * Body : { category_id, subject, body, ad_price, ad_params: { ad_submission_id,
 *          donation, title_adparams_prediction_id, <category-specific attrs> } }
 *
 * Stratégie : on **ignore** `weight_prediction` (LBC's ML) et on prend
 * `weight_range[0]` (la valeur la plus petite) du bucket correspondant au
 * `packageSize` choisi par l'user. Objectif : sous-déclarer le poids pour
 * minimiser le coût de livraison affiché à l'acheteur. Le seller absorbe
 * la différence au moment de l'envoi.
 *
 * Enrichit `ctx.resolvedAttrs` avec :
 *  - `shipping` (objet complet pour extended_attributes.shipping)
 *  - `item_weight_prediction_id` (= prediction_id retourné)
 *
 * Ces clés sont ensuite placées au bon endroit dans le body par le step
 * submit-ad selon leur codec_type respectif.
 */
@Injectable()
export class LbcPredictShippingStep implements PublishStep<LbcPublishContext> {
  readonly name = 'predict-shipping';

  private readonly logger = new Logger(LbcPredictShippingStep.name);

  constructor(private readonly client: LeboncoinHttpClient) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    if (!ctx.category?.id) {
      throw new Error(
        'Predict shipping : catégorie absente (step classify manqué ?)',
      );
    }
    if (!ctx.depositSchema) {
      throw new Error(
        'Predict shipping : depositSchema absent (step fetch-deposit-schema manqué ?)',
      );
    }
    if (!ctx.resolvedAttrs) {
      throw new Error(
        'Predict shipping : resolvedAttrs absent (step resolve-attributes manqué ?)',
      );
    }

    const body = {
      category_id: ctx.category.id,
      subject: ctx.listing.title,
      body: ctx.listing.description,
      ad_price: Math.round(ctx.listing.price * 100),
      ad_params: buildAdParams(ctx.depositSchema, ctx.resolvedAttrs),
    };

    const res = await this.client.request<LbcShippingPredictResponse>(
      ctx.account,
      {
        method: 'POST',
        url: LBC_SHIPPING_PREDICT_URL,
        data: body,
        label: 'lbc:publish:predict-shipping',
        responseSchema: LbcShippingPredictResponseSchema,
        headers: {
          Referer: LBC_DEPOSIT_PAGE,
        },
      },
    );

    const bucket = bucketForSize(ctx.listing.packageSize, res.data);
    const smallestWeight = bucket.weight_range[0];
    if (smallestWeight === undefined) {
      throw new Error(
        `Predict shipping : weight_range vide pour packageSize=${ctx.listing.packageSize}`,
      );
    }
    const shippingTypes = bucket.delivery_options
      .filter((o) => o.checked)
      .map((o) => o.name);

    ctx.resolvedAttrs.shipping = {
      version: 2,
      shipping_types: shippingTypes,
      estimated_parcel_weight: smallestWeight,
      estimated_parcel_size: ctx.listing.packageSize,
    };
    ctx.resolvedAttrs.item_weight_prediction_id = res.data.prediction_id;

    this.logger.log(
      `Shipping résolu : ${smallestWeight}g (${ctx.listing.packageSize}) + ${shippingTypes.length} transporteur(s) → ${shippingTypes.join(', ')}`,
    );
  }
}

/**
 * Construit le payload `ad_params` du predict en sélectionnant, depuis
 * `resolvedAttrs`, toutes les valeurs dont l'item du schéma a un codec_type
 * `CODEC_TYPE_ATTRIBUTES`. C'est exactement le sous-ensemble qui ira dans
 * `attributes` du body submit final, et LBC attend la même forme ici.
 */
function buildAdParams(
  schema: LbcDepositConfigResponse,
  resolved: Record<string, unknown>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const item of schema.definitions.items) {
    const key = item.answer_modelization?.representation?.associated_key;
    const codec = item.answer_modelization?.representation?.codec_type;
    if (!key || codec !== 'CODEC_TYPE_ATTRIBUTES') continue;
    const value = resolved[key];
    if (value !== undefined) params[key] = value;
  }
  return params;
}

function bucketForSize(
  size: PackageSize,
  res: LbcShippingPredictResponse,
): LbcShippingPredictResponse['small'] {
  switch (size) {
    case PackageSize.S:
      return res.small;
    case PackageSize.M:
      return res.medium;
    case PackageSize.L:
      return res.large;
  }
}

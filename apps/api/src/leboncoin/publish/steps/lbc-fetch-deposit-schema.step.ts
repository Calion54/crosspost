import { Injectable, Logger } from '@nestjs/common';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_DEPOSIT_CONFIG_URL,
  LBC_DEPOSIT_PAGE,
} from '../../leboncoin-platform.config.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcDepositConfigResponseSchema,
  type LbcDepositConfigResponse,
} from '../leboncoin-deposit-schema.schemas.js';

/**
 * Step 2 — Récupère le schéma dynamique du form de dépôt pour la catégorie.
 *
 * GET /api/adsubmit/dynamic-deposit/config
 *
 * Réponse : navigation (ordre des steps + items) + definitions (les items :
 * associated_key, codec_type, choix possibles, règles mandatory, règles
 * conditionnelles, etc.).
 *
 * On stocke tel quel dans `ctx.depositSchema` ; les steps suivants
 * (resolve-attributes, submit-ad) s'en servent pour :
 *  1. Savoir quels champs il faut remplir (mandatory) pour cette catégorie
 *  2. Connaître les choix valides (enum) pour piloter le LLM
 *  3. Connaître `codec_type` pour ranger chaque valeur au bon endroit du body
 */
@Injectable()
export class LbcFetchDepositSchemaStep
  implements PublishStep<LbcPublishContext>
{
  readonly name = 'fetch-deposit-schema';

  private readonly logger = new Logger(LbcFetchDepositSchemaStep.name);

  constructor(private readonly client: LeboncoinHttpClient) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    if (!ctx.category?.id) {
      throw new Error(
        'Fetch deposit schema : catégorie absente (step classify manqué ?)',
      );
    }

    const url = new URL(LBC_DEPOSIT_CONFIG_URL);
    url.searchParams.set('user_id', ctx.account.externalUserId);
    url.searchParams.set('ad_type', 'sell');
    url.searchParams.set('account_type', 'private');
    url.searchParams.set('category', ctx.category.id);
    url.searchParams.set('user_has_phone', ctx.account.phone ? 'true' : 'false');
    url.searchParams.set('user_journey', 'deposit');

    const res = await this.client.request<LbcDepositConfigResponse>(
      ctx.account,
      {
        method: 'GET',
        url: url.toString(),
        label: 'lbc:publish:fetch-deposit-schema',
        responseSchema: LbcDepositConfigResponseSchema,
        headers: {
          Referer: LBC_DEPOSIT_PAGE,
        },
      },
    );

    ctx.depositSchema = res.data;

    const itemsCount = res.data.definitions.items.length;
    const stepsCount = res.data.navigation.ordered_steps.length;
    this.logger.log(
      `Schéma de dépôt récupéré : ${stepsCount} étapes, ${itemsCount} items (catégorie ${ctx.category.id})`,
    );
  }
}

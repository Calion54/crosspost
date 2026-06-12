import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { LeboncoinHttpClient } from '../http/leboncoin-http.client.js';
import {
  LBC_DELETE_ADS_URL,
  LBC_INTERNAL_API_KEY,
  LBC_WEB_HOST,
} from '../leboncoin-platform.config.js';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type { ListingDocument } from '../../listings/schemas/listing.schema.js';
import type { PublicationDocument } from '../../publications/schemas/publication.schema.js';
import type { PublishStep } from '../../publish/publish-step.interface.js';
import type {
  DeletePublicationResult,
  PlatformPublishAdapter,
  PublishOptions,
  PublishResult,
} from '../../publish/platform-publish.types.js';
import type { LbcPublishContext } from './leboncoin-publish.context.js';
import { LbcClassifyCategoryStep } from './steps/lbc-classify-category.step.js';
import { LbcFetchDepositSchemaStep } from './steps/lbc-fetch-deposit-schema.step.js';
import { LbcUploadImagesStep } from './steps/lbc-upload-images.step.js';
import { LbcResolveAttributesStep } from './steps/lbc-resolve-attributes.step.js';
import { LbcPredictShippingStep } from './steps/lbc-predict-shipping.step.js';
import { LbcSubmitAdStep } from './steps/lbc-submit-ad.step.js';
import { LbcFetchPricingStep } from './steps/lbc-fetch-pricing.step.js';
import { LbcConfirmAdStep } from './steps/lbc-confirm-ad.step.js';

/**
 * Service publish Leboncoin.
 * - `publish()`           : orchestre la chaîne de steps (chaque step = 1 appel API LBC)
 * - `deletePublication()` : supprime une annonce (idempotent)
 */
@Injectable()
export class LeboncoinPublishService implements PlatformPublishAdapter {
  private readonly logger = new Logger(LeboncoinPublishService.name);

  /**
   * Chaîne de steps exécutée par `publish()`. Au fur et à mesure qu'on ajoute
   * un step (1 par curl), il est injecté ici et poussé dans `this.steps` dans
   * l'ordre voulu.
   */
  private readonly steps: PublishStep<LbcPublishContext>[];

  constructor(
    private readonly client: LeboncoinHttpClient,
    private readonly classifyCategory: LbcClassifyCategoryStep,
    private readonly fetchDepositSchema: LbcFetchDepositSchemaStep,
    private readonly uploadImages: LbcUploadImagesStep,
    private readonly resolveAttributes: LbcResolveAttributesStep,
    private readonly predictShipping: LbcPredictShippingStep,
    private readonly submitAd: LbcSubmitAdStep,
    private readonly fetchPricing: LbcFetchPricingStep,
    private readonly confirmAd: LbcConfirmAdStep,
  ) {
    this.steps = [
      this.classifyCategory,
      this.fetchDepositSchema,
      this.uploadImages,
      this.resolveAttributes,
      this.predictShipping,
      this.submitAd,
      this.fetchPricing,
      this.confirmAd,
    ];
  }

  /** Orchestre la chaîne de steps. Termine quand `ctx.externalId/externalUrl` sont remplis. */
  async publish(
    account: AccountDocument,
    listing: ListingDocument,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    if (this.steps.length === 0) {
      throw new NotImplementedException(
        'Aucun step LBC publish configuré (en construction — Étape 4)',
      );
    }
    const ctx: LbcPublishContext = {
      account,
      listing,
      defaultLocation: options?.defaultLocation,
    };
    for (const step of this.steps) {
      this.logger.log(`Step "${step.name}" start (account=${account.email})`);
      try {
        await step.execute(ctx);
      } catch (err) {
        this.logger.error(
          `Step "${step.name}" failed: ${(err as Error).message}`,
        );
        throw err;
      }
      this.logger.log(`Step "${step.name}" done`);
    }
    if (!ctx.externalId || !ctx.externalUrl) {
      throw new InternalServerErrorException(
        `Publish terminé mais externalId/externalUrl manquants — chaîne de steps incomplète`,
      );
    }
    return { externalId: ctx.externalId, externalUrl: ctx.externalUrl };
  }

  /**
   * Supprime une annonce sur Leboncoin via DELETE /api/pintad/v1/public/manual/delete/ads.
   * Idempotent : 404/410 → `already_gone`.
   */
  async deletePublication(
    account: AccountDocument,
    publication: PublicationDocument,
  ): Promise<DeletePublicationResult> {
    if (!publication.externalId) {
      return {
        status: 'already_gone',
        message: "Pas d'externalId — rien à supprimer côté LBC",
      };
    }
    const listId = Number.parseInt(publication.externalId, 10);
    if (!Number.isFinite(listId)) {
      return {
        status: 'failed',
        message: `externalId "${publication.externalId}" n'est pas numérique`,
      };
    }

    const res = await this.client.request<{
      ads_deleted?: number[];
      ads_not_found?: number[];
    }>(account, {
      method: 'DELETE',
      url: LBC_DELETE_ADS_URL,
      data: { list_ids: [listId] },
      headers: {
        api_key: LBC_INTERNAL_API_KEY,
        Referer: `${LBC_WEB_HOST}/compte/mes-annonces/suppression`,
      },
      label: `lbc:delete:${listId}`,
    });

    // 404 Not Found ou 410 Gone → l'annonce n'est plus côté LBC. Idempotent.
    if (res.status === 404 || res.status === 410) {
      this.logger.log(`LBC ${listId} déjà absent (HTTP ${res.status})`);
      return { status: 'already_gone', message: `HTTP ${res.status}` };
    }
    if (res.status >= 200 && res.status < 300) {
      const notFound = res.data?.ads_not_found;
      if (Array.isArray(notFound) && notFound.includes(listId)) {
        return {
          status: 'already_gone',
          message: 'Présent dans ads_not_found',
        };
      }
      return { status: 'deleted' };
    }
    // LBC renvoie un 500 (corps vide) quand l'annonce n'existe déjà plus, au
    // lieu d'un 404 propre. On traite donc un 5xx comme idempotent
    // (already_gone) pour pouvoir nettoyer la Publication et republier. Risque
    // assumé : un 5xx réellement transitoire (annonce encore en ligne) dropperait
    // la ligne à tort — récupérable via un resync / un nouveau publish.
    if (res.status >= 500) {
      this.logger.warn(
        `LBC ${listId} : delete HTTP ${res.status} — annonce supposée déjà absente, traitée en already_gone`,
      );
      return {
        status: 'already_gone',
        message: `HTTP ${res.status} (supposé déjà supprimé)`,
      };
    }
    return {
      status: 'failed',
      message: `HTTP ${res.status} — ${JSON.stringify(res.data)?.slice(0, 200)}`,
    };
  }
}

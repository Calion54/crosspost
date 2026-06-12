import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
import { VintedHttpClient } from '../http/vinted-http.client.js';
import {
  VINTED_DELETE_ITEM_URL,
  VINTED_NEW_ITEM_PAGE,
  VINTED_WEB_HOST,
} from '../vinted-platform.config.js';
import { VintedAccessDeniedSchema } from './vinted-publish.schemas.js';
import type { VintedPublishContext } from './vinted-publish.context.js';
import { VintedUploadPhotosStep } from './steps/vinted-upload-photos.step.js';
import { VintedResolveCategoryStep } from './steps/vinted-resolve-category.step.js';
import { VintedFetchPackageSizesStep } from './steps/vinted-fetch-package-sizes.step.js';
import { VintedFetchAttributeSchemaStep } from './steps/vinted-fetch-attribute-schema.step.js';
import { VintedFetchBrandsStep } from './steps/vinted-fetch-brands.step.js';
import { VintedFetchColorsStep } from './steps/vinted-fetch-colors.step.js';
import { VintedResolveAttributesStep } from './steps/vinted-resolve-attributes.step.js';
import { VintedSubmitItemStep } from './steps/vinted-submit-item.step.js';

/**
 * Service publish Vinted.
 * - `publish()`           : orchestre la chaîne de steps (chaque step = 1 appel API Vinted)
 * - `deletePublication()` : supprime une annonce (idempotent) — à câbler
 *
 * Les steps sont injectés ici et poussés dans `this.steps` dans l'ordre voulu
 * au fur et à mesure des curls partagés.
 */
@Injectable()
export class VintedPublishService implements PlatformPublishAdapter {
  private readonly logger = new Logger(VintedPublishService.name);

  private readonly steps: PublishStep<VintedPublishContext>[];

  constructor(
    private readonly client: VintedHttpClient,
    private readonly uploadPhotos: VintedUploadPhotosStep,
    private readonly resolveCategory: VintedResolveCategoryStep,
    private readonly fetchPackageSizes: VintedFetchPackageSizesStep,
    private readonly fetchAttributeSchema: VintedFetchAttributeSchemaStep,
    private readonly fetchBrands: VintedFetchBrandsStep,
    private readonly fetchColors: VintedFetchColorsStep,
    private readonly resolveAttributes: VintedResolveAttributesStep,
    private readonly submitItem: VintedSubmitItemStep,
  ) {
    this.steps = [
      this.uploadPhotos,
      this.resolveCategory,
      this.fetchPackageSizes,
      this.fetchAttributeSchema,
      this.fetchBrands,
      this.fetchColors,
      this.resolveAttributes,
      this.submitItem,
    ];
  }

  async publish(
    account: AccountDocument,
    listing: ListingDocument,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    if (this.steps.length === 0) {
      throw new NotImplementedException(
        'Aucun step Vinted publish configuré (en construction)',
      );
    }
    const ctx: VintedPublishContext = {
      account,
      listing,
      defaultLocation: options?.defaultLocation,
      // Session de dépôt Vinted — UUID stable réutilisé par upload-photos
      // (temp_uuid) et submit-item (temp_uuid + upload_session_id).
      uploadSessionId: randomUUID(),
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
        `Publish Vinted terminé mais externalId/externalUrl manquants — chaîne de steps incomplète`,
      );
    }
    return { externalId: ctx.externalId, externalUrl: ctx.externalUrl };
  }

  /**
   * Supprime une annonce sur Vinted via POST /api/v2/items/{id}/delete (oui,
   * POST et pas DELETE — convention Vinted). Pas de body. Idempotent : 404 →
   * `already_gone`.
   */
  async deletePublication(
    account: AccountDocument,
    publication: PublicationDocument,
  ): Promise<DeletePublicationResult> {
    if (!publication.externalId) {
      return {
        status: 'already_gone',
        message: "Pas d'externalId — rien à supprimer côté Vinted",
      };
    }

    const res = await this.client.request<unknown>(account, {
      method: 'POST',
      url: VINTED_DELETE_ITEM_URL(publication.externalId),
      label: `vinted:delete:${publication.externalId}`,
      headers: {
        Accept: 'application/json,text/plain,*/*,image/webp',
        'Content-Length': '0',
        locale: 'fr-FR',
        Origin: VINTED_WEB_HOST,
        Referer: publication.externalUrl || VINTED_NEW_ITEM_PAGE,
      },
    });

    if (res.status === 404 || res.status === 410) {
      this.logger.log(
        `Vinted ${publication.externalId} déjà absent (HTTP ${res.status})`,
      );
      return { status: 'already_gone', message: `HTTP ${res.status}` };
    }
    if (res.status >= 200 && res.status < 300) {
      this.logger.log(`Vinted ${publication.externalId} supprimé`);
      return { status: 'deleted' };
    }
    // 403 + access_denied = état métier (annonce verrouillée par Vinted, vente en
    // cours non validée…). Pas une auth cassée.
    if (
      res.status === 403 &&
      VintedAccessDeniedSchema.safeParse(res.data).success
    ) {
      this.logger.warn(
        `Vinted ${publication.externalId} : suppression refusée (vente en cours ?)`,
      );
      return {
        status: 'failed',
        message:
          'Vinted refuse la suppression — annonce verrouillée (vente en cours non validée par l\'acheteur).',
      };
    }
    return {
      status: 'failed',
      message: `HTTP ${res.status} — ${JSON.stringify(res.data)?.slice(0, 200)}`,
    };
  }
}

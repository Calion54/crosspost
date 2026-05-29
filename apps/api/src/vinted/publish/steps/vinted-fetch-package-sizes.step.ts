import { Injectable, Logger } from '@nestjs/common';
import { VintedHttpClient } from '../../http/vinted-http.client.js';
import {
  VINTED_PACKAGE_SIZES_URL,
  VINTED_WEB_HOST,
} from '../../vinted-platform.config.js';
import {
  VintedPackageSizesResponseSchema,
  type VintedPackageSizesResponse,
} from '../vinted-publish.schemas.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';

/**
 * Step 3 — Récupère les tailles de colis valides pour la catégorie résolue.
 *
 * GET https://api.vinted.fr/shipping-estimation/external/catalogs/{id}/package_sizes
 *
 * Les ids des tailles sont **dynamiques** : ils varient selon la catégorie
 * (ex: jeux vidéo = [8, 9, 10] / HEAVY_SMALL/MEDIUM/LARGE). On ne peut donc
 * pas hardcoder un mapping fixe S/M/L → id. Le step `submit-item` mappe par
 * index dans le tableau (S → [0], M → [1], L → [2], avec clamp).
 *
 * Headers spécifiques observés sur l'API api.vinted.fr (vs www.vinted.fr) :
 *  - `platform: web`
 *  - `x-next-app: marketplace-web`
 * Les cookies portent sur `.vinted.fr` donc valables sur les deux sous-domaines.
 */
@Injectable()
export class VintedFetchPackageSizesStep
  implements PublishStep<VintedPublishContext>
{
  readonly name = 'fetch-package-sizes';

  private readonly logger = new Logger(VintedFetchPackageSizesStep.name);

  constructor(private readonly client: VintedHttpClient) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    if (!ctx.categoryId) {
      throw new Error(
        'Fetch package sizes : categoryId absent (step resolve-category manqué ?)',
      );
    }

    const res = await this.client.request<VintedPackageSizesResponse>(
      ctx.account,
      {
        method: 'GET',
        url: VINTED_PACKAGE_SIZES_URL(ctx.categoryId),
        label: 'vinted:publish:fetch-package-sizes',
        responseSchema: VintedPackageSizesResponseSchema,
        headers: {
          Accept: 'application/json, text/plain, */*',
          locale: 'fr-FR',
          Origin: VINTED_WEB_HOST,
          Referer: `${VINTED_WEB_HOST}/`,
          platform: 'web',
          'x-next-app': 'marketplace-web',
        },
      },
    );

    const sizes = res.data.package_sizes;
    if (sizes.length === 0) {
      throw new Error(
        `Fetch package sizes : aucune taille disponible pour catégorie ${ctx.categoryId}`,
      );
    }

    ctx.packageSizes = sizes;
    this.logger.log(
      `${sizes.length} taille(s) pour catégorie ${ctx.categoryId} : ${sizes
        .map((s) => `${s.id}=${s.title}`)
        .join(', ')}`,
    );
  }
}

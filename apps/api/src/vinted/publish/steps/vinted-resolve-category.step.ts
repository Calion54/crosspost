import { Injectable, Logger } from '@nestjs/common';
import { VintedCategoryResolver } from '../../catalog/vinted-category-resolver.service.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';

/**
 * Step 2 — Résout la catégorie Vinted (id feuille) à partir du listing via
 * cascade LLM sur l'arbre du catalogue.
 *
 * Remplace l'ancien `suggest-category` qui passait par les photos uploadées
 * (endpoint `/suggestions/categories`). On utilise désormais le catalogue
 * complet en cache + Claude Haiku pour piquer dans l'arbre, sans dépendre des
 * suggestions Vinted (souvent à côté).
 *
 * Pose `ctx.categoryId` consommé ensuite par `fetch-attribute-schema`.
 */
@Injectable()
export class VintedResolveCategoryStep
  implements PublishStep<VintedPublishContext>
{
  readonly name = 'resolve-category';

  private readonly logger = new Logger(VintedResolveCategoryStep.name);

  constructor(private readonly resolver: VintedCategoryResolver) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    const leaf = await this.resolver.resolve(ctx.listing);
    ctx.categoryId = leaf.id;
    this.logger.log(
      `ctx.categoryId = ${leaf.id} (${leaf.path ? `${leaf.path} > ` : ''}${leaf.title})`,
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { LlmService } from '../../common/llm/llm.service.js';
import type { ListingDocument } from '../../listings/schemas/listing.schema.js';
import { VintedCatalogCache } from './vinted-catalog-cache.service.js';
import type { VintedCatalogNode } from './vinted-catalog.schemas.js';

/**
 * Résout la catégorie Vinted (nœud feuille) d'un listing via **cascade LLM**.
 *
 * À chaque niveau de l'arbre, on demande à Claude de choisir parmi les enfants
 * directs (typiquement 5-30 options). On descend récursivement jusqu'à atteindre
 * une feuille (`catalogs` vide), seule valeur acceptée comme `catalog_id` au
 * submit Vinted.
 *
 * Pourquoi cette approche vs un seul appel avec ~1000 feuilles :
 *  - **Zéro mapping hardcodé** entre notre `ListingCategory` et l'ontologie
 *    Vinted (qui évolue : ajout récent de "Polos", "Jupes longueur genou", etc.)
 *  - Chaque appel a un petit `enum` → meilleur signal, output forcé valide
 *  - Coût moindre (~2.5k tokens cumulés vs ~10k single-shot)
 *
 * Trade-off : 3-5 appels LLM en série → ~2-4s de latence. Acceptable dans un
 * flow publish qui prend déjà 30-60s (uploads photos + attributs).
 */
@Injectable()
export class VintedCategoryResolver {
  private readonly logger = new Logger(VintedCategoryResolver.name);
  /** Garde-fou anti-récursion infinie (la profondeur réelle Vinted est ≤5). */
  private static readonly MAX_DEPTH = 8;

  constructor(
    private readonly cache: VintedCatalogCache,
    private readonly llm: LlmService,
  ) {}

  /**
   * Cascade LLM jusqu'à atteindre une feuille. Throw si :
   *  - le catalogue est vide
   *  - le LLM retourne un id hors options (ne devrait pas arriver grâce à l'enum)
   *  - on dépasse MAX_DEPTH (= arbre Vinted plus profond qu'attendu)
   */
  async resolve(listing: ListingDocument): Promise<VintedCatalogNode> {
    const tree = await this.cache.getCatalog();
    if (tree.length === 0) {
      throw new Error('Resolve category : catalogue Vinted vide');
    }

    const breadcrumb: string[] = [];
    let candidates: VintedCatalogNode[] = tree;

    for (let depth = 0; depth < VintedCategoryResolver.MAX_DEPTH; depth++) {
      const pickedId = await this.llmPick(listing, candidates, breadcrumb);
      const picked = candidates.find((c) => c.id === pickedId);
      if (!picked) {
        // Impossible en théorie (enum forcé côté tool) — défense en profondeur.
        throw new Error(
          `Resolve category : id ${pickedId} hors candidats [${candidates
            .map((c) => c.id)
            .join(', ')}]`,
        );
      }
      breadcrumb.push(picked.title);

      if (picked.catalogs.length === 0) {
        // Feuille atteinte → on arrête.
        this.logger.log(
          `Catégorie résolue (${depth + 1} niveau(x)) : ${breadcrumb.join(
            ' > ',
          )} (id=${picked.id})`,
        );
        return picked;
      }
      candidates = picked.catalogs;
    }

    throw new Error(
      `Resolve category : profondeur max (${VintedCategoryResolver.MAX_DEPTH}) atteinte sans feuille (parcours : ${breadcrumb.join(' > ')})`,
    );
  }

  // ─── LLM pick (1 appel par niveau de l'arbre) ──────────────────────────────

  private async llmPick(
    listing: ListingDocument,
    candidates: VintedCatalogNode[],
    breadcrumb: string[],
  ): Promise<number> {
    const tool: Anthropic.Tool = {
      name: 'pick_category',
      description:
        "Choisit la sous-catégorie Vinted la plus appropriée à ce niveau de l'arbre.",
      input_schema: {
        type: 'object',
        properties: {
          category_id: {
            type: 'integer',
            enum: candidates.map((c) => c.id),
            description: 'Id de la catégorie choisie parmi la liste fournie.',
          },
        },
        required: ['category_id'],
      } as Anthropic.Tool['input_schema'],
    };

    const res = await this.llm.createMessage({
      system: SYSTEM_PROMPT,
      maxTokens: 256,
      messages: [
        { role: 'user', content: this.buildPrompt(listing, candidates, breadcrumb) },
      ],
      tools: [tool],
      // Force Claude à appeler pick_category — sinon il peut répondre en texte.
      toolChoice: { type: 'tool', name: 'pick_category' },
    });

    const toolUse = res.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      const textBlock = res.content.find((c) => c.type === 'text');
      const textSnippet =
        textBlock && textBlock.type === 'text' ? textBlock.text.slice(0, 300) : '<aucun texte>';
      throw new Error(
        `Resolve category : LLM n'a pas renvoyé de tool_use (stop_reason=${res.stop_reason}, text="${textSnippet}")`,
      );
    }
    const id = (toolUse.input as { category_id?: unknown }).category_id;
    if (typeof id !== 'number') {
      throw new Error(
        `Resolve category : category_id non numérique reçu : ${JSON.stringify(id)}`,
      );
    }
    return id;
  }

  private buildPrompt(
    listing: ListingDocument,
    candidates: VintedCatalogNode[],
    breadcrumb: string[],
  ): string {
    const lines: string[] = [
      `Annonce à classer :`,
      `- Titre : ${listing.title}`,
      `- Description : ${listing.description}`,
    ];
    if (listing.category) {
      lines.push(`- Catégorie interne (indicatif) : ${listing.category}`);
    }
    lines.push('');
    if (breadcrumb.length > 0) {
      lines.push(`Niveau précédent : ${breadcrumb.join(' > ')}`);
      lines.push('Choisis la sous-catégorie la plus appropriée :');
    } else {
      lines.push('Choisis la catégorie racine la plus appropriée :');
    }
    lines.push('');
    for (const c of candidates) {
      lines.push(`  · ${c.id} = ${c.title}`);
    }
    return lines.join('\n');
  }
}

const SYSTEM_PROMPT = `Tu es un assistant qui classe une annonce dans l'arbre des catégories Vinted.
À chaque niveau, tu reçois la liste des sous-catégories disponibles (id numérique + libellé).
Tu choisis l'id qui correspond le mieux au produit, en te basant sur le titre, la description et la catégorie interne fournie en indicatif.
Préfère toujours la catégorie la plus spécifique et fidèle au produit. Si plusieurs choix sont plausibles, prends le plus précis.
Réponds via le tool pick_category.`;

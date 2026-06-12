import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { LlmService } from '../../common/llm/llm.service.js';
import type { ListingDocument } from '../../listings/schemas/listing.schema.js';
import { VintedCatalogCache } from './vinted-catalog-cache.service.js';
import type { VintedCatalogNode } from './vinted-catalog.schemas.js';

/**
 * Résout la catégorie Vinted (nœud feuille) d'un listing en **un seul appel
 * LLM** sur l'arbre complet aplati.
 *
 * Historique : on faisait une cascade (1 appel par niveau, choix glouton parmi
 * les enfants directs). Problème : à chaque niveau le LLM ne voyait que des
 * libellés abstraits ("Loisirs et collections" vs "Divertissement") sans le
 * contenu des branches → un mauvais virage en haut était irrémédiable (ex: un
 * lot de livres classé en "Autocollants").
 *
 * Maintenant : on présente TOUTES les feuilles avec leur chemin complet
 * (`id = Racine > … > Feuille`) en un seul prompt. Le LLM voit l'ontologie
 * entière d'un coup et choisit directement la bonne feuille — seules les
 * feuilles sont des `catalog_id` valides au submit Vinted.
 *
 * Coût maîtrisé par **prompt caching** : la liste des feuilles est identique à
 * chaque publication (catalogue mis en cache 24h au boot), donc placée dans un
 * bloc système marqué `cache_control: ephemeral`. Seul le titre/description du
 * listing varie d'un appel à l'autre.
 */
@Injectable()
export class VintedCategoryResolver {
  private readonly logger = new Logger(VintedCategoryResolver.name);

  constructor(
    private readonly cache: VintedCatalogCache,
    private readonly llm: LlmService,
  ) {}

  async resolve(listing: ListingDocument): Promise<VintedCatalogNode> {
    const tree = await this.cache.getCatalog();
    if (tree.length === 0) {
      throw new Error('Resolve category : catalogue Vinted vide');
    }

    const leaves = flattenLeaves(tree);
    if (leaves.length === 0) {
      throw new Error('Resolve category : aucune feuille dans le catalogue');
    }

    const pickedId = await this.llmPickLeaf(listing, leaves);
    const picked = leaves.find((l) => l.node.id === pickedId);
    if (!picked) {
      // Ne devrait pas arriver (id validé dans llmPickLeaf) — défense en profondeur.
      throw new Error(
        `Resolve category : id ${pickedId} absent des feuilles du catalogue`,
      );
    }

    this.logger.log(
      `Catégorie résolue : ${picked.path} (id=${picked.node.id})`,
    );
    return picked.node;
  }

  // ─── LLM : 1 seul appel, arbre complet en bloc système caché ────────────────

  private async llmPickLeaf(
    listing: ListingDocument,
    leaves: Array<{ node: VintedCatalogNode; path: string }>,
  ): Promise<number> {
    const leafList = leaves
      .map((l) => `${l.node.id} = ${l.path}`)
      .join('\n');

    // Bloc système = instructions + catalogue. Le `cache_control` sur le dernier
    // bloc (le catalogue, stable) met en cache tools+system → appels suivants
    // ~10x moins chers sur cette portion (TTL 5 min, recouvre les rafales).
    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT },
      {
        type: 'text',
        text:
          `Catégories Vinted disponibles (format "id = chemin complet"). ` +
          `Seules ces feuilles sont valides :\n\n${leafList}`,
        // TTL 1h (vs 5 min par défaut) : couvre une session de travail avec des
        // trous entre publications. Write 2× au lieu de 1,25×, négligeable au
        // volume actuel. Repasser à 5 min (retirer `ttl`) si le débit augmente.
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ];

    const tool: Anthropic.Tool = {
      name: 'pick_category',
      description:
        'Choisit la catégorie feuille Vinted (par id) la plus appropriée au produit.',
      input_schema: {
        type: 'object',
        properties: {
          category_id: {
            type: 'integer',
            description: 'Id d\'une feuille présente dans la liste fournie.',
          },
        },
        required: ['category_id'],
      } as Anthropic.Tool['input_schema'],
    };

    const validIds = new Set(leaves.map((l) => l.node.id));
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: this.buildPrompt(listing) },
    ];

    // 2 tentatives : si le LLM renvoie un id hors liste, on le corrige une fois.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.llm.createMessage({
        system,
        maxTokens: 256,
        messages,
        tools: [tool],
        toolChoice: { type: 'tool', name: 'pick_category' },
      });

      this.logger.debug(
        `cache tokens — read: ${res.usage.cache_read_input_tokens ?? 0}, ` +
          `write: ${res.usage.cache_creation_input_tokens ?? 0}`,
      );

      const toolUse = res.content.find((c) => c.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error(
          `Resolve category : pas de tool_use (stop_reason=${res.stop_reason})`,
        );
      }

      const id = (toolUse.input as { category_id?: unknown }).category_id;
      if (typeof id === 'number' && validIds.has(id)) return id;

      this.logger.warn(
        `Resolve category : id invalide reçu (${JSON.stringify(id)}), tentative ${attempt + 1}/2`,
      );
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: `L'id ${JSON.stringify(id)} n'est pas une feuille valide de la liste. Choisis un id présent dans la liste.`,
      });
    }

    throw new Error(
      'Resolve category : le LLM n\'a pas renvoyé d\'id de feuille valide après 2 tentatives',
    );
  }

  private buildPrompt(listing: ListingDocument): string {
    const lines = [
      `Annonce à classer :`,
      `- Titre : ${listing.title}`,
      `- Description : ${listing.description}`,
    ];
    if (listing.category) {
      lines.push(`- Catégorie interne (indicatif) : ${listing.category}`);
    }
    lines.push('');
    lines.push(
      'Choisis la feuille la plus précise et fidèle au produit via le tool pick_category.',
    );
    return lines.join('\n');
  }
}

/**
 * Aplatit l'arbre en liste de feuilles avec leur chemin complet
 * ("Racine > Sous-cat > Feuille"). Seules les feuilles (catalogs vide) sont des
 * catalog_id valides côté Vinted.
 */
function flattenLeaves(
  tree: VintedCatalogNode[],
): Array<{ node: VintedCatalogNode; path: string }> {
  const out: Array<{ node: VintedCatalogNode; path: string }> = [];
  const walk = (nodes: VintedCatalogNode[], prefix: string): void => {
    for (const n of nodes) {
      const path = prefix ? `${prefix} > ${n.title}` : n.title;
      if (n.catalogs.length === 0) {
        out.push({ node: n, path });
      } else {
        walk(n.catalogs, path);
      }
    }
  };
  walk(tree, '');
  return out;
}

const SYSTEM_PROMPT = `Tu classes une annonce dans l'arbre des catégories Vinted.
On te fournit la liste COMPLÈTE des catégories feuilles, chacune avec son chemin complet ("id = Racine > Sous-catégorie > Feuille").
Choisis l'id de la feuille qui correspond le mieux au produit, en te basant sur le titre, la description et la catégorie interne fournie en indicatif.
Raisonne sur la nature réelle du produit : un lot de livres va dans la branche des livres (romans, BD…), pas dans les loisirs créatifs ; un jouet dans jeux & jouets, etc.
Préfère toujours la feuille la plus spécifique et fidèle. Réponds uniquement via le tool pick_category avec un id présent dans la liste.`;

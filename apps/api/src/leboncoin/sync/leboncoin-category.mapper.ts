import { Injectable, Logger } from '@nestjs/common';
import { ListingCategory } from '@crosspost/shared';
import { LlmService } from '../../common/llm/llm.service.js';

/**
 * Mapping LBC `category_name` → notre enum `ListingCategory`.
 *
 * 1. Règles keyword (rapides, déterministes) — couvrent ~90% des cas connus
 * 2. Fallback LLM (Haiku) si aucune règle ne matche — couvre les nouveaux libellés ou cas ambigus
 * 3. Cache mémoire par `category_name` → 1 seul appel LLM par catégorie unique par process
 *
 * Coût : pour ~50 catégories LBC uniques × $0.0001 = ~$0.005 par démarrage process.
 */

const RULES: Array<{ regex: RegExp; category: ListingCategory }> = [
  // Bébé (avant CLOTHING pour matcher "vêtements bébé" en premier)
  {
    regex: /b[ée]b[ée]|pu[ée]riculture|poussette|biberon|landau|maternit[ée]/i,
    category: ListingCategory.BABY,
  },
  // Mode / Vêtements / Accessoires bagagerie
  {
    regex:
      /v[ée]tement|chaussure|mode|sac\s*[àa]?\s*main|maroquinerie|bagagerie|bijou|montre|lunettes? de soleil|manteau|robe|pantalon|jean|pull|t-shirt|chemise|jupe|casquette|chapeau|accessoires? &|accessoires? bagagerie/i,
    category: ListingCategory.CLOTHING,
  },
  // Beauté
  {
    regex: /beaut[ée]|cosm[ée]tique|parfum|maquillage|soin du visage|soin du corps/i,
    category: ListingCategory.BEAUTY,
  },
  // Électronique
  {
    regex:
      /t[ée]l[ée]phone|smartphone|tablette|ordinateur|laptop|pc|console|jeux? vid[ée]o|tv|t[ée]l[ée]vision|audio|photo|cam[ée]ra|hi-fi|son|informatique|multim[ée]dia|[ée]lectronique|objets? connect[ée]s/i,
    category: ListingCategory.ELECTRONICS,
  },
  // Sports
  {
    regex:
      /sport|fitness|v[ée]lo|musculation|randonn[ée]e|ski|surf|football|tennis|basket|natation|yoga|escalade|trotinette|roller/i,
    category: ListingCategory.SPORTS,
  },
  // Jeux & jouets (après "jeux vidéo" capturé par ELECTRONICS)
  {
    regex: /jouet|jeu de soci[ée]t[ée]|figurine|peluche|lego|playmobil|jeux? & jouets?/i,
    category: ListingCategory.TOYS_GAMES,
  },
  // Livres & médias
  {
    regex:
      /livre|bd|bande dessin[ée]e|cd|dvd|blu-ray|vinyle|magazine|musique|film|partition/i,
    category: ListingCategory.BOOKS_MEDIA,
  },
  // Bricolage / DIY (avant Maison pour outillage)
  {
    regex: /bricolage|outillage|outils?|mat[ée]riel|jardinage|construction|peinture/i,
    category: ListingCategory.DIY,
  },
  // Maison (inclut Arts de la table, électroménager)
  {
    regex:
      /maison|meuble|d[ée]coration|d[ée]co|[ée]lectrom[ée]nager|[ée]quipement maison|cuisine|salon|chambre|jardin|terrasse|literie|matelas|canap[ée]|arts? de la table/i,
    category: ListingCategory.HOME,
  },
  // Collection (inclut modélisme, maquettes)
  {
    regex: /collection|antiquit[ée]|vintage|art\b|nft|mod[ée]lisme|maquette/i,
    category: ListingCategory.COLLECTIBLES,
  },
];

const SYSTEM_PROMPT = `Tu mappes une catégorie Leboncoin (en français) vers une catégorie universelle.

Catégories cibles :
- clothing : Vêtements, chaussures, sacs, bijoux, montres
- electronics : Téléphones, ordinateurs, TV, audio, photo, jeux vidéo
- home : Mobilier, déco, électroménager, équipement maison, jardin
- sports : Vélos, équipement sportif, fitness, randonnée
- toys_games : Jouets, jeux de société, peluches (jamais jeux vidéo)
- books_media : Livres, BD, CD/DVD, vinyles, magazines
- beauty : Cosmétiques, parfums, maquillage, soin
- baby : Puériculture, vêtements bébé, poussettes
- diy : Bricolage, outillage, jardinage
- collectibles : Antiquités, collection, vintage, art
- other : Tout ce qui ne rentre dans aucune autre catégorie

Réponds avec un seul tool call set_category.`;

@Injectable()
export class LeboncoinCategoryMapper {
  private readonly logger = new Logger(LeboncoinCategoryMapper.name);
  private readonly cache = new Map<string, ListingCategory>();

  constructor(private readonly llm: LlmService) {}

  async toUniversal(
    categoryName?: string | null,
  ): Promise<ListingCategory> {
    if (!categoryName) return ListingCategory.OTHER;

    const cached = this.cache.get(categoryName);
    if (cached) return cached;

    // 1. Règles keyword (fast path)
    const ruleMatch = matchByRules(categoryName);
    if (ruleMatch) {
      this.cache.set(categoryName, ruleMatch);
      return ruleMatch;
    }

    // 2. Fallback LLM
    const llmMatch = await this.askLlm(categoryName);
    this.cache.set(categoryName, llmMatch);
    return llmMatch;
  }

  private async askLlm(categoryName: string): Promise<ListingCategory> {
    try {
      const res = await this.llm.createMessage({
        system: SYSTEM_PROMPT,
        maxTokens: 256,
        messages: [
          {
            role: 'user',
            content: `Catégorie Leboncoin : "${categoryName}"`,
          },
        ],
        tools: [
          {
            name: 'set_category',
            description: 'Sélectionne la catégorie universelle correspondante',
            input_schema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  enum: Object.values(ListingCategory),
                },
              },
              required: ['category'],
            },
          },
        ],
      });
      const toolUse = res.content.find((c) => c.type === 'tool_use');
      if (toolUse && toolUse.type === 'tool_use') {
        const input = toolUse.input as { category?: string };
        if (
          input.category &&
          Object.values(ListingCategory).includes(
            input.category as ListingCategory,
          )
        ) {
          this.logger.debug(
            `LLM matched "${categoryName}" → ${input.category}`,
          );
          return input.category as ListingCategory;
        }
      }
    } catch (err) {
      this.logger.warn(
        `LLM mapping échoué pour "${categoryName}": ${(err as Error).message}`,
      );
    }
    this.logger.debug(`Catégorie "${categoryName}" → OTHER (fallback)`);
    return ListingCategory.OTHER;
  }
}

function matchByRules(categoryName: string): ListingCategory | null {
  for (const rule of RULES) {
    if (rule.regex.test(categoryName)) return rule.category;
  }
  return null;
}

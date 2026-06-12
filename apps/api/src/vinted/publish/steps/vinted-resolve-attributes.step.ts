import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { ListingCondition } from '@crosspost/shared';
import { LlmService } from '../../../common/llm/llm.service.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';
import type { VintedAttribute } from '../vinted-publish.schemas.js';

/**
 * Step 6 — Résout les valeurs de chaque attribut requis pour la catégorie.
 *
 * Itère sur `ctx.attributesSchema` (rempli par fetch-attribute-schema) :
 *  1. **Mapping direct** quand l'info existe déjà côté listing
 *     (ex: `condition` mappé depuis `ctx.listing.condition` via match titre).
 *  2. **Batch LLM** pour tout le reste, avec tool-use Anthropic et `enum`
 *     d'entiers : Claude est forcé à choisir un id valide → impossible de
 *     recevoir une valeur hors options.
 *
 * Pour chaque attribut, les options proviennent :
 *  - `brand`  → `ctx.brandCatalog` (catalogue fetché séparément)
 *  - `color`  → `ctx.colorCatalog` (catalogue fetché séparément)
 *  - autres   → `attr.configuration.options[].options[]` (inline)
 *
 * Résultat : `ctx.resolvedAttrs` (Record code → option id). Le step submit
 * s'en sert pour construire le body final.
 */
@Injectable()
export class VintedResolveAttributesStep
  implements PublishStep<VintedPublishContext>
{
  readonly name = 'resolve-attributes';

  private readonly logger = new Logger(VintedResolveAttributesStep.name);

  constructor(private readonly llm: LlmService) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    if (!ctx.attributesSchema) {
      throw new Error(
        'Resolve attributes : attributesSchema absent (step fetch-attribute-schema manqué ?)',
      );
    }

    const resolved: Record<string, number> = {};

    // ─── Pass 1 : mappings directs ──────────────────────────────────────────
    for (const attr of ctx.attributesSchema) {
      const direct = this.getDirectValue(attr, ctx);
      if (direct !== undefined) resolved[attr.code] = direct;
    }

    // ─── Pass 2 : batch LLM pour tous les autres ─────────────────────────────
    const batch: Array<{
      code: string;
      label: string;
      options: Array<{ id: number; title: string }>;
    }> = [];

    for (const attr of ctx.attributesSchema) {
      if (resolved[attr.code] !== undefined) continue;
      // `isbn` est un champ texte libre (pas un enum d'ids) → résolu en Pass 3.
      if (attr.code === 'isbn') continue;

      const options = this.getOptionsFor(attr, ctx);
      if (!options.length) {
        this.logger.warn(
          `Aucune option disponible pour "${attr.code}" — skip`,
        );
        continue;
      }
      batch.push({
        code: attr.code,
        label: attr.configuration?.title ?? attr.code,
        options,
      });
    }

    if (batch.length > 0) {
      const llmFilled = await this.llmFillBatch(ctx, batch);
      Object.assign(resolved, llmFilled);
    }

    // ─── Pass 3 : attribut texte libre `isbn` (catégories livres) ────────────
    // `isbn` arrive avec `configuration: null` (pas d'options) — c'est une chaîne
    // libre, pas un id. On la résout à part et on la pose dans `ctx.isbn` (le
    // submit la met au root `item.isbn`, pas dans `item_attributes`).
    if (ctx.attributesSchema.some((a) => a.code === 'isbn')) {
      ctx.isbn = await this.resolveIsbn(ctx);
    }

    // ─── Diagnostic ──────────────────────────────────────────────────────────
    // `isbn` est exclu : suivi via ctx.isbn, jamais dans `resolved`.
    const missing = ctx.attributesSchema
      .filter(
        (a) =>
          a.code !== 'isbn' &&
          a.configuration?.required &&
          resolved[a.code] === undefined,
      )
      .map((a) => a.code);
    if (missing.length > 0) {
      this.logger.warn(
        `Attributs requis non résolus (le submit risque d'échouer) : ${missing.join(', ')}`,
      );
    }

    ctx.resolvedAttrs = resolved;
    this.logger.log(
      `${Object.keys(resolved).length} attribut(s) résolu(s) (${batch.length} via LLM) — ` +
        Object.entries(resolved)
          .map(([k, v]) => `${k}=${v}`)
          .join(', '),
    );
  }

  // ─── Mapping direct ─────────────────────────────────────────────────────────

  private getDirectValue(
    attr: VintedAttribute,
    ctx: VintedPublishContext,
  ): number | undefined {
    if (attr.code === 'condition' && ctx.listing.condition) {
      const targetTitle = CONDITION_TO_VINTED_TITLE[ctx.listing.condition];
      if (!targetTitle) return undefined;
      const wanted = normalize(targetTitle);
      const match = flattenInlineOptions(attr).find(
        (o) => normalize(o.title) === wanted,
      );
      return match?.id;
    }
    return undefined;
  }

  // ─── Source des options par attribut ────────────────────────────────────────

  private getOptionsFor(
    attr: VintedAttribute,
    ctx: VintedPublishContext,
  ): Array<{ id: number; title: string }> {
    if (attr.code === 'brand') {
      return (ctx.brandCatalog ?? []).map((b) => ({
        id: b.id,
        title: b.title,
      }));
    }
    if (attr.code === 'color') {
      return (ctx.colorCatalog ?? []).map((c) => ({
        id: c.id,
        title: c.title,
      }));
    }
    return flattenInlineOptions(attr);
  }

  // ─── Résolution ISBN (texte libre, catégories livres) ───────────────────────

  /**
   * Trouve l'ISBN-13 du livre. D'abord par extraction directe dans le texte de
   * l'annonce (fast-path, pas d'appel LLM), sinon en demandant au LLM
   * d'identifier le livre depuis titre/description et de fournir son ISBN.
   * Toute valeur est validée (clé de contrôle ISBN-10/13) avant d'être retenue :
   * un ISBN halluciné ou mal formé est rejeté (→ `undefined`, submit avec null)
   * plutôt que d'envoyer une valeur invalide qui ferait échouer le dépôt.
   */
  private async resolveIsbn(
    ctx: VintedPublishContext,
  ): Promise<string | undefined> {
    const text = `${ctx.listing.title}\n${ctx.listing.description}`;

    const fromText = extractIsbnFromText(text);
    if (fromText) {
      this.logger.log(`ISBN extrait du texte de l'annonce : ${fromText}`);
      return fromText;
    }

    const tool: Anthropic.Tool = {
      name: 'provide_isbn',
      description: "Fournit l'ISBN-13 du livre décrit dans l'annonce.",
      input_schema: {
        type: 'object',
        properties: {
          isbn: {
            type: 'string',
            description:
              "ISBN-13 réel de l'ouvrage ou de sa collection (13 chiffres, sans tirets ni espaces). Chaîne vide uniquement si aucun ISBN réel n'est identifiable.",
          },
        },
        required: ['isbn'],
      } as Anthropic.Tool['input_schema'],
    };

    const res = await this.llm.createMessage({
      system: ISBN_SYSTEM_PROMPT,
      maxTokens: 256,
      messages: [
        {
          role: 'user',
          content: `Titre : ${ctx.listing.title}\nDescription : ${ctx.listing.description}`,
        },
      ],
      tools: [tool],
      toolChoice: { type: 'tool', name: 'provide_isbn' },
    });

    const toolUse = res.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      this.logger.warn('ISBN : aucun tool_use dans la réponse LLM');
      return undefined;
    }
    const raw = (toolUse.input as { isbn?: unknown }).isbn;
    if (typeof raw !== 'string' || !raw.trim()) return undefined;

    const normalized = normalizeIsbn(raw);
    const isbn13 = toIsbn13IfValid(normalized);
    if (!isbn13) {
      this.logger.warn(`ISBN LLM invalide (reçu "${raw}") — ignoré`);
      return undefined;
    }
    this.logger.log(`ISBN résolu via LLM : ${isbn13}`);
    return isbn13;
  }

  // ─── LLM batch (1 seul appel, tool-use enum forcé) ──────────────────────────

  private async llmFillBatch(
    ctx: VintedPublishContext,
    batch: Array<{
      code: string;
      label: string;
      options: Array<{ id: number; title: string }>;
    }>,
  ): Promise<Record<string, number>> {
    const properties: Record<string, unknown> = {};
    for (const f of batch) {
      properties[f.code] = {
        type: 'integer',
        enum: f.options.map((o) => o.id),
        description: f.label,
      };
    }
    const tool: Anthropic.Tool = {
      name: 'fill_listing_attributes',
      description:
        'Renseigne chaque attribut Vinted en choisissant l\'id de l\'option la plus pertinente.',
      input_schema: {
        type: 'object',
        properties,
        required: batch.map((f) => f.code),
      } as Anthropic.Tool['input_schema'],
    };

    const userPrompt = this.buildUserPrompt(ctx, batch);

    const res = await this.llm.createMessage({
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [tool],
    });

    const toolUse = res.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      this.logger.warn('LLM batch : aucun tool_use dans la réponse');
      return {};
    }
    const input = toolUse.input as Record<string, unknown>;

    // Validation : ne garder que les valeurs présentes dans l'enum déclaré.
    const out: Record<string, number> = {};
    for (const f of batch) {
      const v = input[f.code];
      if (typeof v === 'number' && f.options.some((o) => o.id === v)) {
        out[f.code] = v;
      } else {
        this.logger.warn(
          `LLM batch : valeur invalide pour "${f.code}" (reçu ${JSON.stringify(v)})`,
        );
      }
    }
    return out;
  }

  private buildUserPrompt(
    ctx: VintedPublishContext,
    batch: Array<{
      code: string;
      label: string;
      options: Array<{ id: number; title: string }>;
    }>,
  ): string {
    const lines = [
      `Annonce à publier sur Vinted :`,
      `- Titre : ${ctx.listing.title}`,
      `- Description : ${ctx.listing.description}`,
      `- Catégorie Vinted : ${ctx.categoryId ?? '?'}`,
      ``,
      `Pour chaque attribut, choisis l'id de l'option la plus pertinente.`,
      `Si rien ne colle vraiment, prends l'option la plus neutre (ex: "No Label" pour brand, "Multicolore" pour color, "Non précisé" pour les ratings).`,
      ``,
    ];
    for (const f of batch) {
      lines.push(`▸ ${f.code} — ${f.label}`);
      for (const opt of f.options) {
        lines.push(`    · ${opt.id} = ${opt.title}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Aplatit la structure imbriquée `configuration.options[].options[]` en une
 * liste plate `{id, title}`. Vinted regroupe les options dans un "group"
 * unique pour la plupart des attributs (cf. inline condition / video_game_*).
 */
function flattenInlineOptions(
  attr: VintedAttribute,
): Array<{ id: number; title: string }> {
  const groups = attr.configuration?.options ?? [];
  return groups.flatMap((g) =>
    (g.options ?? []).map((o) => ({ id: o.id, title: o.title })),
  );
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// ─── Helpers ISBN ────────────────────────────────────────────────────────────

/** Retire tirets/espaces et met le `X` final (ISBN-10) en majuscule. */
function normalizeIsbn(s: string): string {
  return s.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Scanne le texte à la recherche d'un ISBN explicite (10 ou 13 chiffres, tirets
 * et espaces tolérés). Ne retient que les candidats dont la clé de contrôle est
 * valide → filtre les faux positifs (numéros de tél, références, etc.).
 * Retourne toujours un ISBN-13 (conversion 10→13 si besoin).
 */
function extractIsbnFromText(text: string): string | undefined {
  const candidates =
    text.match(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dxX]/g) ?? [];
  for (const c of candidates) {
    const isbn13 = toIsbn13IfValid(normalizeIsbn(c));
    if (isbn13) return isbn13;
  }
  return undefined;
}

/**
 * Valide la clé de contrôle d'un ISBN normalisé (10 ou 13 chiffres) et renvoie
 * sa forme ISBN-13. `undefined` si invalide.
 */
function toIsbn13IfValid(isbn: string): string | undefined {
  if (isbn.length === 10 && isValidIsbn10(isbn)) return isbn10To13(isbn);
  if (isbn.length === 13 && isValidIsbn13(isbn)) return isbn;
  return undefined;
}

function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = isbn[i] === 'X' ? 10 : Number(isbn[i]);
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/** Convertit un ISBN-10 valide en ISBN-13 (préfixe 978 + nouvelle clé). */
function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

// ─── Mappings constants ────────────────────────────────────────────────────

const CONDITION_TO_VINTED_TITLE: Record<ListingCondition, string> = {
  [ListingCondition.NEW_WITH_TAGS]: 'Neuf avec étiquette',
  [ListingCondition.NEW_WITHOUT_TAGS]: 'Neuf sans étiquette',
  [ListingCondition.VERY_GOOD]: 'Très bon état',
  [ListingCondition.GOOD]: 'Bon état',
  [ListingCondition.FAIR]: 'Satisfaisant',
};

const SYSTEM_PROMPT = `Tu es un assistant qui remplit le formulaire de dépôt d'annonce Vinted.
Pour chaque attribut, tu reçois la liste des options autorisées (id numérique + libellé humain).
Tu dois choisir l'id qui décrit le mieux le produit, en te basant sur le titre, la description et la catégorie.
Si plusieurs ids semblent plausibles, prends le plus spécifique. Si rien ne colle vraiment, prends l'option la plus neutre quand elle existe (ex: "No Label", "Multicolore", "Non précisé").
Réponds via le tool fill_listing_attributes.`;

const ISBN_SYSTEM_PROMPT = `Tu fournis l'ISBN-13 d'un livre ou magazine mis en vente sur Vinted, à partir de son titre et de sa description.
- Si un ISBN figure dans le texte, renvoie-le.
- Sinon, identifie l'ouvrage OU la collection/série, et renvoie un ISBN-13 RÉEL et EXISTANT correspondant (depuis ta connaissance).
- Pour un lot ou plusieurs exemplaires d'un même titre / d'une même collection (ex: "lot de 38 J'aime lire"), renvoie un ISBN-13 réel et représentatif de ce titre/collection — un seul suffit.
- Ne renvoie une chaîne vide QUE si tu ne peux identifier ni l'ouvrage ni aucun ISBN réel correspondant.
Impératif : l'ISBN doit appartenir réellement à l'ouvrage/la collection — ne génère JAMAIS 13 chiffres au hasard. Réponds via le tool provide_isbn.`;

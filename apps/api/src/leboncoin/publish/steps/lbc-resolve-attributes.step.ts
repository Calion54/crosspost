import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { ListingCondition } from '@crosspost/shared';
import type { ListingLocation } from '@crosspost/shared';
import { LlmService } from '../../../common/llm/llm.service.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import type {
  LbcDepositChoice,
  LbcDepositConfigResponse,
  LbcDepositItem,
} from '../leboncoin-deposit-schema.schemas.js';

/**
 * Step 4 — Résout dynamiquement les valeurs de chaque champ du form LBC.
 *
 * Itère le schéma de dépôt récupéré (step 2) et, pour chaque champ mandatory :
 *  1. Tente un mapping direct depuis le listing / l'account / le ctx (subject,
 *     body, price_cents, email, phone, condition, images, location, shipping,
 *     ad_submission_id, category_reco_prediction_id, donation, …).
 *  2. À défaut, si le champ a un enum statique (`multiple_answers.choices`),
 *     le met dans un batch LLM (1 seul appel Haiku avec tool use et enum forcé
 *     par champ → la réponse ne peut pas être invalide).
 *  3. À défaut, si le champ a des `conditional_choices` qui dépendent d'autres
 *     champs déjà remplis, on résout en pass 2 (les dépendances de la pass 1
 *     ont été remplies entre-temps).
 *
 * Le résultat (`Record<associated_key, value>`) est posé dans
 * `ctx.resolvedAttrs` ; le step submit-ad s'en sert pour construire le body
 * en respectant `codec_type` de chaque item.
 */
@Injectable()
export class LbcResolveAttributesStep
  implements PublishStep<LbcPublishContext>
{
  readonly name = 'resolve-attributes';

  private readonly logger = new Logger(LbcResolveAttributesStep.name);

  constructor(private readonly llm: LlmService) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    const schema = ctx.depositSchema;
    if (!schema) {
      throw new Error(
        'Resolve attributes : depositSchema absent (step fetch-deposit-schema manqué ?)',
      );
    }
    if (!ctx.uploadedImages?.length) {
      throw new Error(
        'Resolve attributes : pas d\'images uploadées (step upload-images manqué ?)',
      );
    }

    const filled: Record<string, unknown> = {};

    // ─── Pass 1 : direct + batch LLM (fields à choix statiques) ────────────
    const llmBatch: Array<{
      key: string;
      label: string;
      choices: LbcDepositChoice[];
    }> = [];

    for (const item of schema.definitions.items) {
      const key = associatedKey(item);
      if (!key || !sendable(item)) continue;

      const direct = this.getDirectValue(key, ctx);
      if (direct !== undefined) {
        filled[key] = direct;
        continue;
      }

      if (!isMandatory(item)) continue;

      const staticChoices = item.answer_modelization?.multiple_answers?.choices;
      if (staticChoices?.length) {
        llmBatch.push({
          key,
          label: item.decoration?.label ?? key,
          choices: staticChoices,
        });
      }
      // Les conditional_choices sont gérés en pass 2.
    }

    if (llmBatch.length > 0) {
      const llmFilled = await this.llmFillBatch(ctx, llmBatch);
      Object.assign(filled, llmFilled);
    }

    // ─── Pass 2 : conditional_choices (dépendent d'autres réponses) ────────
    for (const item of schema.definitions.items) {
      const key = associatedKey(item);
      if (!key || filled[key] !== undefined) continue;
      if (!sendable(item) || !isMandatory(item)) continue;

      const choices = resolveConditionalChoices(item, filled);
      if (!choices?.length) continue;

      const value = await this.llmFillSingle(
        ctx,
        key,
        item.decoration?.label ?? key,
        choices,
      );
      if (value) filled[key] = value;
    }

    // ─── Diagnostic : repérer les mandatory non remplis ────────────────────
    const missing: string[] = [];
    for (const item of schema.definitions.items) {
      const key = associatedKey(item);
      if (!key || !sendable(item) || !isMandatory(item)) continue;
      if (filled[key] === undefined || filled[key] === null) missing.push(key);
    }
    if (missing.length > 0) {
      this.logger.warn(
        `Champs mandatory non résolus (le submit risque d'échouer) : ${missing.join(', ')}`,
      );
    }

    ctx.resolvedAttrs = filled;
    this.logger.log(
      `${Object.keys(filled).length} attribut(s) résolu(s) (${llmBatch.length} via LLM)`,
    );
  }

  // ─── Mappings directs ────────────────────────────────────────────────────

  private getDirectValue(
    key: string,
    ctx: LbcPublishContext,
  ): unknown | undefined {
    switch (key) {
      case 'subject':
        return ctx.listing.title;
      case 'body':
        return ctx.listing.description;
      case 'price_cents':
        return String(Math.round(ctx.listing.price * 100));
      case 'email':
        return ctx.account.email;
      case 'phone':
        return ctx.account.phone ?? null;
      case 'donation':
        return '0';
      case 'condition':
        return ctx.listing.condition
          ? CONDITION_TO_LBC[ctx.listing.condition]
          : undefined;
      case 'ad_submission_id':
        return randomUUID();
      case 'title_adparams_prediction_id':
        // Champ caché tracking côté LBC (UUID client-side, non vérifié serveur).
        return randomUUID();
      case 'category_reco_prediction_id':
        return ctx.category?.predictionId;
      case 'images':
        return ctx.uploadedImages!.map((img) => ({
          name: img.filename,
          url: img.url,
        }));
      case 'location':
        return ctx.defaultLocation
          ? buildLbcLocation(ctx.defaultLocation)
          : undefined;
      // `shipping` + `item_weight_prediction_id` sont remplis par le step
      // predict-shipping (qui appelle l'endpoint LBC) — pas ici.
      default:
        return undefined;
    }
  }

  // ─── LLM : batch (pass 1) ────────────────────────────────────────────────

  private async llmFillBatch(
    ctx: LbcPublishContext,
    fields: Array<{
      key: string;
      label: string;
      choices: LbcDepositChoice[];
    }>,
  ): Promise<Record<string, string>> {
    const properties: Record<string, unknown> = {};
    for (const f of fields) {
      properties[f.key] = {
        type: 'string',
        enum: f.choices.map((c) => c.identifier),
        description: f.label,
      };
    }
    const tool: Anthropic.Tool = {
      name: 'fill_listing_fields',
      description:
        'Renseigne chaque champ du formulaire en choisissant la valeur la plus pertinente.',
      input_schema: {
        type: 'object',
        properties,
        required: fields.map((f) => f.key),
      } as Anthropic.Tool['input_schema'],
    };

    const userPrompt = this.buildUserPrompt(ctx, fields);

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
    const out: Record<string, string> = {};
    for (const f of fields) {
      const v = input[f.key];
      if (
        typeof v === 'string' &&
        f.choices.some((c) => c.identifier === v)
      ) {
        out[f.key] = v;
      } else {
        this.logger.warn(
          `LLM batch : valeur invalide pour "${f.key}" (reçu ${JSON.stringify(v)})`,
        );
      }
    }
    return out;
  }

  // ─── LLM : single field avec choices conditionnels (pass 2) ──────────────

  private async llmFillSingle(
    ctx: LbcPublishContext,
    key: string,
    label: string,
    choices: LbcDepositChoice[],
  ): Promise<string | undefined> {
    const result = await this.llmFillBatch(ctx, [{ key, label, choices }]);
    return result[key];
  }

  private buildUserPrompt(
    ctx: LbcPublishContext,
    fields: Array<{ key: string; label: string; choices: LbcDepositChoice[] }>,
  ): string {
    const lines = [
      `Annonce à publier :`,
      `- Titre : ${ctx.listing.title}`,
      `- Description : ${ctx.listing.description}`,
      `- Catégorie LBC : ${ctx.category?.name ?? '?'}`,
      ``,
      `Pour chaque champ ci-dessous, choisis la valeur (identifier) la plus pertinente parmi les choix listés :`,
      ``,
    ];
    for (const f of fields) {
      lines.push(`▸ ${f.key} — ${f.label}`);
      for (const c of f.choices) {
        lines.push(`    · ${c.identifier} = ${c.label ?? c.identifier}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }
}

const SYSTEM_PROMPT = `Tu es un assistant qui remplit le formulaire de dépôt d'annonce Leboncoin.
Pour chaque champ, tu reçois la liste des valeurs autorisées (identifier + libellé humain).
Tu dois choisir l'identifier qui décrit le mieux le produit, en te basant sur le titre, la description et la catégorie.
Si plusieurs identifiers semblent plausibles, prends le plus spécifique. Si rien ne colle, prends "other" / "autre" quand c'est dispo, sinon le plus neutre.
Réponds via le tool fill_listing_fields.`;

// ─── Helpers (purs, testables) ───────────────────────────────────────────

function associatedKey(item: LbcDepositItem): string | undefined {
  return item.answer_modelization?.representation?.associated_key;
}

function sendable(item: LbcDepositItem): boolean {
  // CODEC_TYPE_NONE = champ UI-only (ex: predicted_params). On ne l'envoie pas.
  const codec = item.answer_modelization?.representation?.codec_type;
  return !!codec && codec !== 'CODEC_TYPE_NONE';
}

function isMandatory(item: LbcDepositItem): boolean {
  return !!item.static_rules?.mandatory;
}

function resolveConditionalChoices(
  item: LbcDepositItem,
  filled: Record<string, unknown>,
): LbcDepositChoice[] | undefined {
  const rules = item.dynamic_rules?.conditional_choices;
  if (!rules?.length) return undefined;
  for (const block of rules) {
    const allMatch = block.choices_requirements.every((req) => {
      const v = filled[req.previous_associated_key];
      if (req.operator === 'REQUIREMENT_OPERATOR_EQUAL') {
        return (
          typeof v === 'string' &&
          Array.isArray(req.previous_raw_answer) &&
          req.previous_raw_answer.includes(v)
        );
      }
      // Autres opérateurs non rencontrés pour l'instant — fail safe.
      return false;
    });
    if (allMatch) return block.choices;
  }
  return undefined;
}

// ─── Format LBC pour location / shipping / condition / package size ──────

function buildLbcLocation(loc: ListingLocation): Record<string, unknown> {
  return {
    address: '',
    district: '',
    city: loc.city,
    country: loc.country,
    lat: loc.lat,
    lng: loc.lng,
    zipcode: loc.zipcode,
    label: `${loc.city} (${loc.zipcode})`,
    geo_provider: 'here',
    geo_source: 'city',
  };
}

const CONDITION_TO_LBC: Record<ListingCondition, string> = {
  [ListingCondition.NEW_WITH_TAGS]: 'neuf',
  [ListingCondition.NEW_WITHOUT_TAGS]: 'commeneuf',
  [ListingCondition.VERY_GOOD]: 'tresbonetat',
  [ListingCondition.GOOD]: 'bonetat',
  [ListingCondition.FAIR]: 'etatsatisfaisant',
};

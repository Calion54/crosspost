import { z } from 'zod';

/**
 * Zod schemas pour la réponse de `GET /api/adsubmit/dynamic-deposit/config`.
 *
 * LBC nous renvoie ici le **contrat dynamique du form de dépôt** pour une
 * catégorie donnée : ordre des étapes, champs (mandatory ou non), choix
 * possibles, règles conditionnelles (ex: `decoration_type` dont les choix
 * dépendent de la valeur de `house_and_garden_type`).
 *
 * On extrait uniquement les sous-champs qu'on consomme. `.passthrough()`
 * partout pour absorber sans bruit les nombreux champs UI/i18n que LBC
 * ajoute (decoration plus poussée, layouts mobiles, etc.).
 */

// ─── Choices (utilisé dans static et conditional choices) ─────────────────
const ChoiceSchema = z
  .object({
    identifier: z.string(),
    label: z.string().optional(),
  })
  .passthrough();

export type LbcDepositChoice = z.infer<typeof ChoiceSchema>;

// ─── Conditional choices : choices qui dépendent d'une réponse précédente ─
const ConditionalChoicesSchema = z
  .object({
    choices_requirements: z.array(
      z
        .object({
          previous_associated_key: z.string(),
          previous_associated_key_path: z.string().optional(),
          previous_raw_answer: z.array(z.string()).optional(),
          operator: z.string(),
        })
        .passthrough(),
    ),
    choices: z.array(ChoiceSchema),
  })
  .passthrough();

// ─── Item (= un champ du form) ────────────────────────────────────────────
// Note : LBC distingue ITEM_TYPE_QUESTION (un champ atomique) vs
// ITEM_TYPE_GROUP (un container de sous-items). On ne valide que ce qu'on
// lit ; tout le reste passe en passthrough.

const ItemSchema = z
  .object({
    identifier: z.string(),
    type: z.string().optional(),
    answer_modelization: z
      .object({
        representation: z
          .object({
            associated_key: z.string().optional(),
            /**
             * Où ranger ce champ dans le body du submit :
             * - CODEC_TYPE_ROOT                 → racine du body
             * - CODEC_TYPE_ATTRIBUTES           → body.attributes
             * - CODEC_TYPE_EXTENDED_ATTRIBUTES  → body.extended_attributes
             * - CODEC_TYPE_NONE                 → UI-only (ne pas envoyer)
             */
            codec_type: z.string().optional(),
          })
          .passthrough()
          .optional(),
        single_answer: z
          .object({
            type: z.string().optional(),
          })
          .passthrough()
          .optional(),
        multiple_answers: z
          .object({
            choices: z.array(ChoiceSchema).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    decoration: z
      .object({
        label: z.string().optional(),
        placeholder: z.string().optional(),
        visual_representation: z.string().optional(),
      })
      .passthrough()
      .optional(),
    static_rules: z
      .object({
        mandatory: z
          .object({
            error_message: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    dynamic_rules: z
      .object({
        conditional_choices: z.array(ConditionalChoicesSchema).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type LbcDepositItem = z.infer<typeof ItemSchema>;

// ─── Navigation : ordre des steps et des items dans chaque step ───────────

const StepSchema = z
  .object({
    identifier: z.string(),
    ordered_items: z.array(z.string()),
  })
  .passthrough();

// ─── Réponse complète ─────────────────────────────────────────────────────

export const LbcDepositConfigResponseSchema = z
  .object({
    navigation: z
      .object({
        ordered_steps: z.array(StepSchema),
      })
      .passthrough(),
    definitions: z
      .object({
        items: z.array(ItemSchema),
      })
      .passthrough(),
  })
  .passthrough();

export type LbcDepositConfigResponse = z.infer<
  typeof LbcDepositConfigResponseSchema
>;

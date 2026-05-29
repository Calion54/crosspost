import { z } from 'zod';

/**
 * Zod schemas pour les réponses API LBC du flow publish.
 * Chaque step ajoute ici le schema de SA réponse, au fur et à mesure des curls
 * partagés. `.passthrough()` partout pour absorber les champs que LBC ajoute.
 */

// ─── Step 1 : classify ─────────────────────────────────────────────────────
// GET /api/ad-classifier/v2/classify?q=<title>&isPro=false
// → array de candidats catégorie (top en premier)

export const LbcClassifiedCategorySchema = z
  .object({
    id: z.string(),
    topID: z.string(),
    name: z.string(),
    /**
     * Tracking ID de la classification (UUID + scores per-candidate).
     * Partagé entre tous les candidats de la même requête. À renvoyer dans les
     * calls suivants pour que LBC tracke ses prédictions.
     */
    category_reco_prediction_id: z.string().optional(),
  })
  .passthrough();

export const LbcClassifyResponseSchema = z.array(LbcClassifiedCategorySchema);

export type LbcClassifiedCategory = z.infer<typeof LbcClassifiedCategorySchema>;

// ─── Step 2 : upload image ─────────────────────────────────────────────────
// POST /api/pintad/v1/public/upload/image (multipart/form-data, 1 image)
// → { filename, url }

export const LbcUploadImageResponseSchema = z
  .object({
    filename: z.string(),
    url: z.string(),
  })
  .passthrough();

export type LbcUploadImageResponse = z.infer<typeof LbcUploadImageResponseSchema>;

// ─── Step 5 : predict shipping ─────────────────────────────────────────────
// POST /api/consumergoods/proxy/v2/pages/ad-submit
// → { prediction_id, weight_prediction, size_prediction, small/medium/large: { weight_range, delivery_options[], ... } }

const ShippingDeliveryOptionSchema = z
  .object({
    name: z.string(),
    checked: z.boolean().optional(),
    max_weight: z.number().optional(),
  })
  .passthrough();

const ShippingBucketSchema = z
  .object({
    weight_range: z.array(z.number()),
    delivery_options: z.array(ShippingDeliveryOptionSchema),
  })
  .passthrough();

export const LbcShippingPredictResponseSchema = z
  .object({
    prediction_id: z.string(),
    weight_prediction: z.number().optional(),
    size_prediction: z.string().optional(),
    small: ShippingBucketSchema,
    medium: ShippingBucketSchema,
    large: ShippingBucketSchema,
  })
  .passthrough();

export type LbcShippingPredictResponse = z.infer<
  typeof LbcShippingPredictResponseSchema
>;

// ─── Step 6 : submit ad ────────────────────────────────────────────────────
// POST /api/adsubmit/v2/classifieds?with_variation=true
// → { status, ad_id, action_id?, step?, transaction_step? }

export const LbcSubmitAdResponseSchema = z
  .object({
    status: z.string(),
    ad_id: z.number(),
    action_id: z.number().optional(),
    step: z.string().optional(),
    transaction_step: z.string().optional(),
  })
  .passthrough();

export type LbcSubmitAdResponse = z.infer<typeof LbcSubmitAdResponseSchema>;

// ─── Step 7 : pricing ──────────────────────────────────────────────────────
// POST /api/options/v5/pricing/classifieds
// → { pricing_id, prices: [...] }. On ne lit que pricing_id (requis par le confirm).

export const LbcPricingResponseSchema = z
  .object({
    pricing_id: z.string(),
  })
  .passthrough();

export type LbcPricingResponse = z.infer<typeof LbcPricingResponseSchema>;

// ─── Step 8 : confirm submit ───────────────────────────────────────────────
// POST /api/services/v4/submit
// → confirme le dépôt avec les options gratuites. Réponse passthrough (on ne
//   lit rien de précis, on vérifie juste le 2xx).

export const LbcConfirmSubmitResponseSchema = z.object({}).passthrough();

export type LbcConfirmSubmitResponse = z.infer<
  typeof LbcConfirmSubmitResponseSchema
>;

import { z } from 'zod';

/**
 * Zod schemas pour les réponses API Vinted du flow publish.
 * Chaque step ajoute ici le schema de SA réponse, au fur et à mesure des curls
 * partagés. `.passthrough()` partout pour absorber les champs additionnels.
 */

// ─── Erreurs Vinted ─────────────────────────────────────────────────────────
// Enveloppe d'erreur standard : `{ code: number, message: string, message_code: string }`.

/**
 * `code: 106` / `message_code: "access_denied"` — état métier non auth :
 * l'annonce est verrouillée par Vinted (vente en cours non validée par
 * l'acheteur, etc.). HTTP 403 mais le compte est OK.
 */
export const VintedAccessDeniedSchema = z
  .object({
    code: z.literal(106),
    message_code: z.literal('access_denied'),
  })
  .passthrough();

// ─── Step 1 : upload photo ─────────────────────────────────────────────────
// POST /api/v2/photos (multipart/form-data, 1 image)
// → { id, temp_uuid, url, thumbnails, ... } — on ne lit que ce dont on a besoin
//   pour référencer la photo dans le submit final.

export const VintedUploadPhotoResponseSchema = z
  .object({
    id: z.number(),
    temp_uuid: z.string(),
    url: z.string(),
  })
  .passthrough();

export type VintedUploadPhotoResponse = z.infer<
  typeof VintedUploadPhotoResponseSchema
>;

// ─── Step 2 : resolve category ─────────────────────────────────────────────
// Plus de schema HTTP ici — la catégorie est résolue via LLM cascade sur
// l'arbre du catalogue mis en cache (cf. `catalog/` module).

// ─── Step 3 : attributes schema ────────────────────────────────────────────
// POST /api/v2/item_upload/attributes  body {attributes:[{code:"category", value:[catId]}]}
// → array d'attributs requis pour la catégorie. Chaque attribut a soit un
//   `configuration.options[]` inline (enum), soit `configuration: null` →
//   catalogue à fetch séparément (colors, brands, sizes…).
//
// Tout est `.passthrough()` parce que Vinted peut renvoyer des champs
// supplémentaires selon la catégorie (banner, sorting_order, etc.).

const VintedAttributeOptionLeafSchema = z
  .object({
    id: z.number(),
    title: z.string(),
  })
  .passthrough();

// Niveau "group" qui contient les vraies options dans .options[].
const VintedAttributeOptionGroupSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    type: z.string().optional(),
    options: z.array(VintedAttributeOptionLeafSchema).optional(),
  })
  .passthrough();

export const VintedAttributeConfigurationSchema = z
  .object({
    title: z.string().optional(),
    required: z.boolean().optional(),
    selection_type: z.string().optional(),
    selection_limit: z.number().optional(),
    display_type: z.string().optional(),
    options: z.array(VintedAttributeOptionGroupSchema).optional(),
  })
  .passthrough();

export const VintedAttributeSchema = z
  .object({
    code: z.string(),
    has_children: z.boolean().optional(),
    value_ids: z.array(z.number()).nullable().optional(),
    value: z.unknown().nullable().optional(),
    configuration: VintedAttributeConfigurationSchema.nullable().optional(),
  })
  .passthrough();

export const VintedAttributesResponseSchema = z
  .object({
    attributes: z.array(VintedAttributeSchema),
  })
  .passthrough();

export type VintedAttribute = z.infer<typeof VintedAttributeSchema>;
export type VintedAttributesResponse = z.infer<
  typeof VintedAttributesResponseSchema
>;

// ─── Step 4 (conditionnel) : brands catalog ────────────────────────────────
// GET /api/v2/item_upload/brands?category_id=<catId>  header `mda-brand: true`
// → liste curatée des marques fréquentes pour la catégorie + flag custom.
//   Appelé uniquement si le schéma d'attributs contient un attr `brand`.

export const VintedBrandSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    requires_authenticity_check: z.boolean().optional(),
    is_luxury: z.boolean().optional(),
    is_hvf: z.boolean().optional(),
  })
  .passthrough();

export const VintedBrandsResponseSchema = z
  .object({
    brands: z.array(VintedBrandSchema),
    disable_custom_brands: z.boolean().optional(),
  })
  .passthrough();

export type VintedBrand = z.infer<typeof VintedBrandSchema>;
export type VintedBrandsResponse = z.infer<typeof VintedBrandsResponseSchema>;

// ─── Step 5 (conditionnel) : colors catalog ────────────────────────────────
// GET /api/v2/item_upload/colors  → ~29 couleurs (catalogue global).
// Appelé uniquement si le schéma d'attributs contient un attr `color`.

export const VintedColorSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    hex: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export const VintedColorsResponseSchema = z
  .object({
    colors: z.array(VintedColorSchema),
  })
  .passthrough();

export type VintedColor = z.infer<typeof VintedColorSchema>;
export type VintedColorsResponse = z.infer<typeof VintedColorsResponseSchema>;

// ─── Step : fetch package sizes ────────────────────────────────────────────
// GET https://api.vinted.fr/shipping-estimation/external/catalogs/{id}/package_sizes
// → liste des tailles de colis valides pour la catégorie, triée par capacité
//   croissante. Le nombre et les ids varient selon la catégorie (ex: jeux vidéo
//   = [HEAVY_SMALL/MEDIUM/LARGE], vêtements = autres codes/ids).

export const VintedPackageSizeSchema = z
  .object({
    id: z.number(),
    code: z.string(),
    title: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

export const VintedPackageSizesResponseSchema = z
  .object({
    package_sizes: z.array(VintedPackageSizeSchema),
  })
  .passthrough();

export type VintedPackageSize = z.infer<typeof VintedPackageSizeSchema>;
export type VintedPackageSizesResponse = z.infer<
  typeof VintedPackageSizesResponseSchema
>;

// ─── Step 7 : submit item ──────────────────────────────────────────────────
// POST /api/v2/item_upload/items
// Réponse : echo du body envoyé. L'`id` peut être null à ce stade (Vinted
// retourne parfois l'id après un follow-up). Le step warn si c'est le cas.

export const VintedSubmitItemResponseSchema = z
  .object({
    item: z
      .object({
        id: z.number().nullable(),
        temp_uuid: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type VintedSubmitItemResponse = z.infer<
  typeof VintedSubmitItemResponseSchema
>;

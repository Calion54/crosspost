import { z } from 'zod';

/**
 * Arbre des catégories Vinted (ontologie publique).
 *
 * Renvoyé par GET /api/v2/item_upload/catalogs. Récursif via `catalogs[]` :
 *  - nœud feuille = catalogs vide → utilisable comme `catalog_id` au submit
 *  - nœud interne = catalogs non vide → uniquement navigation
 *
 * `.passthrough()` partout (Vinted ajoute régulièrement des champs : badge,
 * photo, restricted_to_status_id, etc.).
 */

export interface VintedCatalogNode {
  id: number;
  title: string;
  path?: string;
  catalogs: VintedCatalogNode[];
}

export const VintedCatalogNodeSchema: z.ZodType<VintedCatalogNode> = z.lazy(
  () =>
    z
      .object({
        id: z.number(),
        title: z.string(),
        path: z.string().optional(),
        catalogs: z.array(VintedCatalogNodeSchema),
      })
      .passthrough(),
);

export const VintedCatalogsResponseSchema = z
  .object({
    catalogs: z.array(VintedCatalogNodeSchema),
  })
  .passthrough();

export type VintedCatalogsResponse = z.infer<
  typeof VintedCatalogsResponseSchema
>;

import { z } from 'zod';

/**
 * Schemas Zod pour les réponses de l'API Leboncoin.
 *
 * Important : tous les objets utilisent `.passthrough()` → on accepte les champs
 * inconnus (LBC peut en ajouter), on valide seulement ceux qu'on utilise.
 * Tous les champs sont optionnels sauf ceux dont on a besoin pour identifier
 * de manière unique une annonce (`list_id`, `subject`).
 */

const LbcImagesSchema = z
  .object({
    nb_images: z.number().optional(),
    thumb_url: z.string().optional(),
    small_url: z.string().optional(),
    urls: z.array(z.string()).optional(),
    urls_thumb: z.array(z.string()).optional(),
    urls_large: z.array(z.string()).optional(),
  })
  .passthrough();

const LbcLocationSchema = z
  .object({
    city: z.string().optional(),
    zipcode: z.string().optional(),
    region_name: z.string().optional(),
    country_id: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .passthrough();

const LbcAttributeSchema = z
  .object({
    key: z.string(),
    value: z.string().optional(),
    value_label: z.string().optional(),
  })
  .passthrough();

export const LbcAdSchema = z
  .object({
    list_id: z.number(),
    subject: z.string(),
    body: z.string().optional(),
    price: z.union([z.number(), z.array(z.number())]).optional(),
    category_id: z.union([z.number(), z.string()]).optional(),
    category_name: z.string().optional(),
    url: z.string().optional(),
    index_date: z.string().optional(),
    first_publication_date: z.string().optional(),
    status: z.string().optional(),
    images: LbcImagesSchema.optional(),
    location: LbcLocationSchema.optional(),
    attributes: z.array(LbcAttributeSchema).optional(),
  })
  .passthrough();

export type LbcAd = z.infer<typeof LbcAdSchema>;

export const LbcDashboardSearchResponseSchema = z
  .object({
    total: z.number().optional(),
    ads: z.array(LbcAdSchema).default([]),
  })
  .passthrough();

export type LbcDashboardSearchResponse = z.infer<
  typeof LbcDashboardSearchResponseSchema
>;

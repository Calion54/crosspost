import { z } from 'zod';

/**
 * Schemas Zod (partiels, `.passthrough()`) pour l'API wardrobe Vinted.
 * GET /api/v2/wardrobe/{userId}/items?page=&per_page=&order=relevance
 */

const VintedPhotoSchema = z
  .object({
    url: z.string().optional(),
    full_size_url: z.string().optional(),
  })
  .passthrough();

const VintedPriceSchema = z
  .object({
    amount: z.string().optional(),
    currency_code: z.string().optional(),
  })
  .passthrough();

export const VintedItemSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    price: VintedPriceSchema.optional(),
    url: z.string().optional(),
    status: z.string().optional(),
    brand: z.string().optional(),
    photos: z.array(VintedPhotoSchema).default([]),
  })
  .passthrough();

export type VintedItem = z.infer<typeof VintedItemSchema>;

const VintedPaginationSchema = z
  .object({
    current_page: z.number(),
    total_pages: z.number(),
    per_page: z.number().optional(),
    total_entries: z.number().optional(),
  })
  .passthrough();

export const VintedWardrobeItemsResponseSchema = z
  .object({
    items: z.array(VintedItemSchema).default([]),
    pagination: VintedPaginationSchema,
  })
  .passthrough();

export type VintedWardrobeItemsResponse = z.infer<
  typeof VintedWardrobeItemsResponseSchema
>;

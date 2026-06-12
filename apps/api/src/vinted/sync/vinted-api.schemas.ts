import { z } from 'zod';

/**
 * Schemas Zod (partiels, `.passthrough()`) pour l'API wardrobe Vinted.
 * GET /api/v2/wardrobe/{userId}/items?page=&per_page=&order=relevance
 */

/**
 * `high_resolution.timestamp` (Unix seconds) = upload time of the photo.
 * Sur le flow normal de publication Vinted, les photos sont uploadées juste
 * avant le submit → le timestamp de la 1ère photo est un excellent proxy
 * de la date de publication de l'annonce (vérifié à <1min près vs LBC).
 */
const VintedPhotoHighResSchema = z
  .object({
    timestamp: z.number().optional(),
  })
  .passthrough();

const VintedPhotoSchema = z
  .object({
    url: z.string().optional(),
    full_size_url: z.string().optional(),
    high_resolution: VintedPhotoHighResSchema.optional(),
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
    is_closed: z.boolean().optional(),
    is_reserved: z.boolean().optional(),
    /** `null` when active. Sale signal : `'sold'`. */
    item_closing_action: z.string().nullable().optional(),
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

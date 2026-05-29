import { z } from 'zod';
import { ListingCategory } from '../enums/listing-category.enum';
import { ListingColor } from '../enums/listing-color.enum';
import { ListingCondition } from '../enums/listing-condition.enum';
import { PackageSize } from '../enums/package-size.enum';
import { Platform } from '../enums/platform.enum';

export const listingMediaSchema = z.object({
  key: z.string(),
  contentType: z.string(),
});

export type ListingMedia = z.infer<typeof listingMediaSchema>;

/**
 * Location structurée (5 champs génériques). Si le frontend a déjà géocodé
 * (Google Places autocomplete ?), on accepte direct le shape complet.
 */
export const listingLocationSchema = z.object({
  city: z.string(),
  zipcode: z.string(),
  country: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type ListingLocation = z.infer<typeof listingLocationSchema>;

/**
 * Input location pour create/update : soit string libre (qu'on géocode côté backend),
 * soit objet structuré (déjà géocodé côté frontend).
 */
export const listingLocationInputSchema = z.union([
  z.string(),
  listingLocationSchema,
]);

export const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(4000),
  price: z.number().positive(),
  category: z.nativeEnum(ListingCategory).optional(),
  condition: z.nativeEnum(ListingCondition).optional(),
  color: z.nativeEnum(ListingColor).optional(),
  packageSize: z.nativeEnum(PackageSize),
  media: z.array(listingMediaSchema).default([]),
});

export type CreateListingDto = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.partial();

export type UpdateListingDto = z.infer<typeof updateListingSchema>;

export const listingSortSchema = z.enum([
  'createdAt:desc',
  'createdAt:asc',
  'publishedAt:desc',
  'publishedAt:asc',
]);
export type ListingSort = z.infer<typeof listingSortSchema>;
export const DEFAULT_LISTING_SORT: ListingSort = 'createdAt:desc';

/** Accept array, single value, or undefined (URL `?p=a&p=b` vs `?p=a`). */
const arrayQueryParam = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (v) => (v === undefined || v === null ? undefined : Array.isArray(v) ? v : [v]),
    z.array(item).optional(),
  );

export const listingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
  sort: listingSortSchema.default(DEFAULT_LISTING_SORT),
  platforms: arrayQueryParam(z.nativeEnum(Platform)),
  accountIds: arrayQueryParam(z.string()),
  unpublishedOnly: z.coerce.boolean().optional(),
});

export type ListingQueryDto = z.infer<typeof listingQuerySchema>;

export interface PaginatedListings {
  items: unknown[];
  total: number;
}

export const autoFillSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
});

export type AutoFillDto = z.infer<typeof autoFillSchema>;

export interface AutoFillResult {
  description?: string;
  category?: ListingCategory;
  condition?: ListingCondition;
  color?: ListingColor;
  packageSize?: PackageSize;
  suggestedPrice?: number;
}

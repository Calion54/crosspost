import { z } from 'zod';
import { ListingCategory } from '../enums/listing-category.enum';
import { ListingColor } from '../enums/listing-color.enum';
import { ListingCondition } from '../enums/listing-condition.enum';
import { PackageSize } from '../enums/package-size.enum';

export const listingMediaSchema = z.object({
  key: z.string(),
  contentType: z.string(),
});

export type ListingMedia = z.infer<typeof listingMediaSchema>;

export const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(4000),
  price: z.number().positive(),
  category: z.nativeEnum(ListingCategory).optional(),
  condition: z.nativeEnum(ListingCondition).optional(),
  color: z.nativeEnum(ListingColor).optional(),
  packageSize: z.nativeEnum(PackageSize),
  location: z.string().optional(),
  media: z.array(listingMediaSchema).default([]),
});

export type CreateListingDto = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.partial();

export type UpdateListingDto = z.infer<typeof updateListingSchema>;

export const listingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

import { z } from 'zod';
import { ListingCondition } from '../enums/listing-condition.enum';

export const listingMediaSchema = z.object({
  key: z.string(),
  contentType: z.string(),
});

export type ListingMedia = z.infer<typeof listingMediaSchema>;

export const createListingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(4000),
  price: z.number().positive(),
  category: z.string().optional(),
  condition: z.nativeEnum(ListingCondition).optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  location: z.string().optional(),
  media: z.array(listingMediaSchema).default([]),
});

export type CreateListingDto = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.partial();

export type UpdateListingDto = z.infer<typeof updateListingSchema>;

export const autoFillSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
});

export type AutoFillDto = z.infer<typeof autoFillSchema>;

export interface AutoFillResult {
  category?: string;
  condition?: ListingCondition;
  brand?: string;
  size?: string;
  color?: string;
  suggestedPrice?: number;
}

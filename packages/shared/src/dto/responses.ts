import { z } from 'zod';
import { Platform } from '../enums/platform.enum';
import { PublicationStatus } from '../enums/publication-status.enum';
import { listingMediaSchema } from './listing.dto';

/** Account summary as embedded in populated publication responses. */
export const accountSummaryResponseSchema = z.object({
  _id: z.string(),
  platform: z.nativeEnum(Platform),
  email: z.string(),
});
export type AccountSummaryResponse = z.infer<typeof accountSummaryResponseSchema>;

export const accountResponseSchema = accountSummaryResponseSchema.extend({
  isConnected: z.boolean(),
});
export type AccountResponse = z.infer<typeof accountResponseSchema>;

/** Publication as returned by listing endpoints (accountId is always populated). */
export const publicationResponseSchema = z.object({
  _id: z.string(),
  listingId: z.string(),
  accountId: accountSummaryResponseSchema,
  platform: z.nativeEnum(Platform),
  status: z.nativeEnum(PublicationStatus),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type PublicationResponse = z.infer<typeof publicationResponseSchema>;

export const listingResponseSchema = z.object({
  _id: z.string(),
  title: z.string(),
  price: z.number(),
  media: z.array(listingMediaSchema),
  mediaUrls: z.array(z.string()),
  publications: z.array(publicationResponseSchema),
});
export type ListingResponse = z.infer<typeof listingResponseSchema>;

export const paginatedListingsResponseSchema = z.object({
  items: z.array(listingResponseSchema),
  total: z.number(),
});
export type PaginatedListingsResponse = z.infer<typeof paginatedListingsResponseSchema>;

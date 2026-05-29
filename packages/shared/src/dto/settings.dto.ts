import { z } from 'zod';
import { listingLocationSchema } from './listing.dto.js';

/**
 * Input pour mettre à jour les settings. Location accepte string libre
 * (géocodée côté backend via Google Maps) OU objet déjà structuré.
 */
export const updateSettingsSchema = z.object({
  location: z.union([z.string(), listingLocationSchema]).optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

export interface SettingsResponse {
  defaultLocation?: {
    city: string;
    zipcode: string;
    country: string;
    lat: number;
    lng: number;
  };
}

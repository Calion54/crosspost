import { z } from 'zod';
import { listingLocationSchema } from './listing.dto.js';

/**
 * Config de remontée automatique (auto-bump), globale par utilisateur.
 * Le scheduler supprime puis recrée les annonces dues tous les `intervalHours`
 * (min 24h), en appliquant optionnellement une réduction de prix cumulative.
 */
export const bumpConfigSchema = z.object({
  enabled: z.boolean(),
  /** Intervalle en jours entre 2 remontées d'une même annonce. Min 1 jour. */
  intervalDays: z.number().int().min(1),
  /** Réduction appliquée au prix à chaque remontée (0 = aucune). */
  priceReductionPercent: z.number().min(0).max(100),
});

export type BumpConfig = z.infer<typeof bumpConfigSchema>;

/**
 * Input pour mettre à jour les settings. Location accepte string libre
 * (géocodée côté backend via Google Maps) OU objet déjà structuré.
 */
export const updateSettingsSchema = z.object({
  location: z.union([z.string(), listingLocationSchema]).optional(),
  bump: bumpConfigSchema.optional(),
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
  bump: BumpConfig;
}

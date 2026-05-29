import { z } from 'zod';

/**
 * Représentation générique d'une location géocodée — partagée entre toutes les
 * plateformes (LBC, Vinted, etc.). Chaque platform-service mappe ces 5 champs
 * vers son propre format au moment du publish.
 */
export const GeocodedLocationSchema = z.object({
  city: z.string(),
  zipcode: z.string(),
  /** Code ISO-3166-1 alpha-2, ex: "FR". */
  country: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export type GeocodedLocation = z.infer<typeof GeocodedLocationSchema>;

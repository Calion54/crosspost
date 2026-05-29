import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { HttpService } from '../http/http.service.js';
import {
  GeocodedLocationSchema,
  type GeocodedLocation,
} from './geocode.types.js';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Schéma minimal de la réponse Google Maps Geocoding API.
 * On extrait juste ce qu'on stocke : city / zipcode / country / lat / lng.
 * Documentation : https://developers.google.com/maps/documentation/geocoding/overview
 */
const GoogleAddressComponentSchema = z
  .object({
    long_name: z.string(),
    short_name: z.string(),
    types: z.array(z.string()),
  })
  .passthrough();

const GoogleGeocodeResponseSchema = z
  .object({
    status: z.string(),
    error_message: z.string().optional(),
    results: z
      .array(
        z
          .object({
            address_components: z.array(GoogleAddressComponentSchema),
            formatted_address: z.string().optional(),
            geometry: z
              .object({
                location: z.object({
                  lat: z.number(),
                  lng: z.number(),
                }),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

type GoogleAddressComponent = z.infer<typeof GoogleAddressComponentSchema>;

/**
 * Service de géocodage générique — basé sur Google Maps Geocoding API.
 *
 * Pas de logique platform-specific. Retourne un objet `GeocodedLocation`
 * minimal (5 champs) que chaque plateforme map à son format au publish time.
 *
 * Exige la variable d'env `GOOGLE_MAPS_API_KEY`. Throw clair si absente.
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  /**
   * Géocode un input libre (ex: "Laneuveville-devant-Nancy 54410") en
   * `GeocodedLocation` structuré. Préfère les résultats français (region=fr).
   *
   * Throw `InternalServerErrorException` si :
   *   - GOOGLE_MAPS_API_KEY non configurée
   *   - Google répond avec status != OK (ZERO_RESULTS, OVER_QUERY_LIMIT, etc.)
   *   - Pas d'address_components exploitables (locality + postal_code manquants)
   */
  async geocode(query: string): Promise<GeocodedLocation> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GOOGLE_MAPS_API_KEY non configurée — impossible de géocoder',
      );
    }

    const url = new URL(GOOGLE_GEOCODE_URL);
    url.searchParams.set('address', query);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'fr');
    url.searchParams.set('region', 'fr');

    const res = await this.http.request({
      method: 'GET',
      url: url.toString(),
      label: 'geocode:google',
      timeout: 10_000,
    });

    // Validation Zod manuelle ici (vs responseSchema sur le request) — évite des
    // gymnastiques de variance entre les types `passthrough + default` de Zod.
    const body = GoogleGeocodeResponseSchema.parse(res.data);
    if (body.status !== 'OK' || body.results.length === 0) {
      throw new InternalServerErrorException(
        `Google geocode "${query}" → ${body.status}${
          body.error_message ? ` (${body.error_message})` : ''
        }`,
      );
    }

    const result = body.results[0];
    const city =
      pickComponent(result.address_components, 'locality') ??
      pickComponent(result.address_components, 'postal_town') ??
      pickComponent(result.address_components, 'administrative_area_level_2');
    const zipcode = pickComponent(result.address_components, 'postal_code');
    const country =
      pickComponentShort(result.address_components, 'country') ?? 'FR';

    if (!city || !zipcode) {
      throw new InternalServerErrorException(
        `Google geocode "${query}" → address_components incomplets (city=${city}, zipcode=${zipcode})`,
      );
    }

    const location: GeocodedLocation = {
      city,
      zipcode,
      country,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    };
    // Validation finale — garantit le shape
    return GeocodedLocationSchema.parse(location);
  }
}

function pickComponent(
  components: GoogleAddressComponent[],
  type: string,
): string | undefined {
  return components.find((c) => c.types.includes(type))?.long_name;
}

function pickComponentShort(
  components: GoogleAddressComponent[],
  type: string,
): string | undefined {
  return components.find((c) => c.types.includes(type))?.short_name;
}

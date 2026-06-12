import { Injectable, Logger } from '@nestjs/common';
import type { ListingLocation, UpdateSettingsDto } from '@crosspost/shared';
import { UsersService } from '../users/users.service.js';
import { GeocodeService } from '../common/geocode/geocode.service.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly usersService: UsersService,
    private geocodeService: GeocodeService,
  ) {}

  async getSettings(userId: string) {
    const defaultLocation =
      await this.usersService.getDefaultLocationOrThrow(userId);
    return { defaultLocation };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    // location non fournie → on ne touche pas à la valeur existante.
    if (dto.location === undefined) {
      const defaultLocation =
        await this.usersService.getDefaultLocationOrThrow(userId);
      return { defaultLocation };
    }

    // La géolocalisation reste ici (logique métier Settings) ; la persistance
    // passe par UsersService.
    const location = await this.resolveLocation(dto.location);
    const defaultLocation = await this.usersService.setDefaultLocation(
      userId,
      location,
    );

    this.logger.log(
      `Settings mis à jour pour user ${userId} — location: ${
        defaultLocation
          ? `${defaultLocation.city} (${defaultLocation.zipcode})`
          : 'aucune'
      }`,
    );
    return { defaultLocation };
  }

  /** String libre → geocode (Google), objet structuré → utilisé direct. */
  private async resolveLocation(
    input: string | ListingLocation,
  ): Promise<ListingLocation | undefined> {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) return undefined;
      return this.geocodeService.geocode(trimmed);
    }
    return input;
  }
}

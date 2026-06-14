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
    const [defaultLocation, bump] = await Promise.all([
      this.usersService.getDefaultLocationOrThrow(userId),
      this.usersService.getBumpConfig(userId),
    ]);
    return { defaultLocation, bump };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    // Chaque champ est optionnel : non fourni → valeur existante inchangée.
    if (dto.bump !== undefined) {
      await this.usersService.setBumpConfig(userId, dto.bump);
      this.logger.log(
        `Bump config mise à jour pour user ${userId} — ${
          dto.bump.enabled
            ? `tous les ${dto.bump.intervalDays}j, -${dto.bump.priceReductionPercent}%`
            : 'désactivée'
        }`,
      );
    }

    if (dto.location !== undefined) {
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
    }

    return this.getSettings(userId);
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

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ListingLocation, UpdateSettingsDto } from '@crosspost/shared';
import { User, type UserDocument } from '../users/schemas/user.schema.js';
import { GeocodeService } from '../common/geocode/geocode.service.js';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private geocodeService: GeocodeService,
  ) {}

  async getSettings(userId: string) {
    const user = await this.userModel
      .findById(new Types.ObjectId(userId))
      .select('defaultLocation')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return { defaultLocation: user.defaultLocation };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const patch: Partial<User> = {};
    if (dto.location !== undefined) {
      patch.defaultLocation = await this.resolveLocation(dto.location);
    }

    const user = await this.userModel
      .findByIdAndUpdate(new Types.ObjectId(userId), patch, { new: true })
      .select('defaultLocation')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');

    this.logger.log(
      `Settings mis à jour pour user ${userId} — location: ${
        user.defaultLocation
          ? `${user.defaultLocation.city} (${user.defaultLocation.zipcode})`
          : 'aucune'
      }`,
    );
    return { defaultLocation: user.defaultLocation };
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

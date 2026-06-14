import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_BUMP_CONFIG,
  User,
  UserBumpConfig,
  UserDefaultLocation,
  type UserDocument,
} from './schemas/user.schema.js';

/**
 * Seule porte d'accès au modèle User. Les autres modules (auth, settings,
 * publish) passent par ce service plutôt que d'injecter le modèle Mongoose.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(new Types.ObjectId(id)).exec();
  }

  /** Premier user (résolution de l'utilisateur par défaut — auth provisoire). */
  findFirst(): Promise<UserDocument | null> {
    return this.userModel.findOne().exec();
  }

  /** Location par défaut du user (publication). `undefined` si user/loc absent. */
  async getDefaultLocation(
    id: string,
  ): Promise<UserDefaultLocation | undefined> {
    const user = await this.userModel
      .findById(new Types.ObjectId(id))
      .select('defaultLocation')
      .lean()
      .exec();
    return user?.defaultLocation;
  }

  /** Lecture pour la page Settings. 404 si le user n'existe pas. */
  async getDefaultLocationOrThrow(
    id: string,
  ): Promise<UserDefaultLocation | undefined> {
    const user = await this.userModel
      .findById(new Types.ObjectId(id))
      .select('defaultLocation')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user.defaultLocation;
  }

  /** Écrit la location par défaut (déjà géocodée par l'appelant). 404 si absent. */
  async setDefaultLocation(
    id: string,
    location: UserDefaultLocation | undefined,
  ): Promise<UserDefaultLocation | undefined> {
    const user = await this.userModel
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        { defaultLocation: location },
        { new: true },
      )
      .select('defaultLocation')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user.defaultLocation;
  }

  // ─── Auto-bump (remontée automatique) ──────────────────────────────────────

  /** Config de remontée du user (defaults si jamais configurée). 404 si absent. */
  async getBumpConfig(id: string): Promise<UserBumpConfig> {
    const user = await this.userModel
      .findById(new Types.ObjectId(id))
      .select('bumpConfig')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user.bumpConfig ?? { ...DEFAULT_BUMP_CONFIG };
  }

  /** Écrit la config de remontée. 404 si user absent. */
  async setBumpConfig(
    id: string,
    config: UserBumpConfig,
  ): Promise<UserBumpConfig> {
    const user = await this.userModel
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        { bumpConfig: config },
        { new: true },
      )
      .select('bumpConfig')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user.bumpConfig ?? { ...DEFAULT_BUMP_CONFIG };
  }

  /** Ids des users ayant la remontée activée (parcours par le scheduler). */
  async findIdsWithBumpEnabled(): Promise<string[]> {
    const users = await this.userModel
      .find({ 'bumpConfig.enabled': true })
      .select('_id')
      .lean()
      .exec();
    return users.map((u) => u._id.toString());
  }

  /** Seed l'utilisateur par défaut si la collection est vide. Retourne true si créé. */
  async seedDefaultIfEmpty(): Promise<boolean> {
    const count = await this.userModel.countDocuments().exec();
    if (count > 0) return false;
    await this.userModel.create({
      email: 'default@crosspost.local',
      password: 'not-used',
    });
    this.logger.log('Default user seeded');
    return true;
  }
}

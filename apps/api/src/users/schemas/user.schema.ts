import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

/**
 * Location par défaut du user — utilisée pour toutes ses publications.
 * Configurée via la page Settings. Géocodée une fois au save.
 */
export class UserDefaultLocation {
  city: string;
  zipcode: string;
  country: string;
  lat: number;
  lng: number;
}

/**
 * Config de remontée automatique (auto-bump), globale au user. Appliquée à
 * toutes ses annonces publiées par le scheduler. Voir `bumpConfigSchema`
 * (@crosspost/shared) pour les contraintes de validation côté API.
 */
export class UserBumpConfig {
  enabled: boolean;
  intervalDays: number;
  priceReductionPercent: number;
}

/** Valeurs par défaut : remontée désactivée, 2 jours, sans réduction. */
export const DEFAULT_BUMP_CONFIG: UserBumpConfig = {
  enabled: false,
  intervalDays: 2,
  priceReductionPercent: 0,
};

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: {
      city: String,
      zipcode: String,
      country: String,
      lat: Number,
      lng: Number,
    },
    _id: false,
  })
  defaultLocation?: UserDefaultLocation;

  @Prop({
    type: {
      enabled: Boolean,
      intervalDays: Number,
      priceReductionPercent: Number,
    },
    _id: false,
    default: () => ({ ...DEFAULT_BUMP_CONFIG }),
  })
  bumpConfig: UserBumpConfig;
}

export const UserSchema = SchemaFactory.createForClass(User);

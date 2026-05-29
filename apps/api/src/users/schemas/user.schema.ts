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
}

export const UserSchema = SchemaFactory.createForClass(User);

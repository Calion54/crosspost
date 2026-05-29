import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Platform } from '@crosspost/shared';

export type AccountDocument = HydratedDocument<Account>;

@Schema({ timestamps: true })
export class Account {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true, type: String, enum: Object.values(Platform) })
  platform: Platform;

  // Identité humaine du compte (saisie au login)
  @Prop({ required: true })
  email: string;

  /**
   * Téléphone du vendeur côté plateforme (capturé via /me/account après login pour LBC).
   * Utilisé dans le body du publish. Optionnel — null si pas disponible.
   */
  @Prop()
  phone?: string;

  // ID du compte côté plateforme (account_id du JWT pour LBC, user_id pour Vinted, etc.)
  @Prop({ required: true })
  externalUserId: string;

  // Blob chiffré AES-256-GCM. Shape par plateforme (LeboncoinCredentialsSchema, etc.)
  @Prop({ required: true })
  credentialsEnc: string;

  // Quand le credential principal (access token) expire. Permet check rapide sans décrypter.
  @Prop({ required: true })
  tokenExpiresAt: Date;

  @Prop({ required: true, default: true })
  isConnected: boolean;

  @Prop({ required: true, default: false })
  needsReconnect: boolean;

  @Prop({ required: true, default: () => new Date() })
  connectedAt: Date;

  @Prop()
  lastRefreshedAt?: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

// Un user ne peut avoir qu'un compte LBC par identité externe — index unique
AccountSchema.index(
  { userId: 1, platform: 1, externalUserId: 1 },
  { unique: true },
);

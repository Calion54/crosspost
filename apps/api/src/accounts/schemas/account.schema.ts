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

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  encryptedCookies: string;

  @Prop({ required: true })
  userAgent: string;

  @Prop({ required: true, default: true })
  isConnected: boolean;

  @Prop()
  lastCheckedAt?: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

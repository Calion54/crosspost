import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Platform } from '@crosspost/shared';

export type AccountDocument = HydratedDocument<Account>;

@Schema({ timestamps: true })
export class Account {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true, type: String })
  platform: Platform;

  @Prop({ required: true })
  username: string;

  @Prop()
  encryptedCookies?: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: false })
  isConnected: boolean;

  @Prop()
  lastCheckedAt?: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);

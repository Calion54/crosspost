import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Platform, PublicationStatus } from '@crosspost/shared';

export type PublicationDocument = HydratedDocument<Publication>;

@Schema({ timestamps: true })
export class Publication {
  @Prop({ type: Types.ObjectId, ref: 'Listing', required: true })
  listingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ required: true, type: String, enum: Object.values(Platform) })
  platform: Platform;

  @Prop({ required: true, type: String, enum: Object.values(PublicationStatus), default: PublicationStatus.DRAFT })
  status: PublicationStatus;

  @Prop()
  externalId?: string;

  @Prop()
  externalUrl?: string;

  @Prop()
  errorMessage?: string;

  /** Set every time the publication transitions to PUBLISHED (incl. re-publish). */
  @Prop()
  publishedAt?: Date;

  /** Number of successful publishes (incremented on every re-publish bump). */
  @Prop({ required: true, default: 0 })
  publishCount: number;

  @Prop({ type: Object })
  platformPayload?: Record<string, unknown>;
}

export const PublicationSchema = SchemaFactory.createForClass(Publication);

PublicationSchema.index(
  { listingId: 1, accountId: 1, platform: 1 },
  { unique: true },
);

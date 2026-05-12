import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ListingCondition, PackageSize } from '@crosspost/shared';

export type ListingDocument = HydratedDocument<Listing>;

export class ListingMedia {
  key: string;
  contentType: string;
}

@Schema({ timestamps: true })
export class Listing {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  category?: string;

  @Prop({ type: String })
  condition?: ListingCondition;

  @Prop()
  brand?: string;

  @Prop()
  size?: string;

  @Prop()
  color?: string;

  @Prop({ type: String, required: true })
  packageSize: PackageSize;

  @Prop()
  location?: string;

  @Prop({ type: [{ key: String, contentType: String }], default: [] })
  media: ListingMedia[];
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  ListingCategory,
  ListingColor,
  ListingCondition,
  PackageSize,
} from '@crosspost/shared';

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

  @Prop({ type: String, enum: Object.values(ListingCategory) })
  category?: ListingCategory;

  @Prop({ type: String, enum: Object.values(ListingCondition) })
  condition?: ListingCondition;

  @Prop({ type: String, enum: Object.values(ListingColor) })
  color?: ListingColor;

  @Prop({ type: String, required: true, enum: Object.values(PackageSize) })
  packageSize: PackageSize;

  @Prop()
  location?: string;

  @Prop({ type: [{ key: String, contentType: String }], default: [] })
  media: ListingMedia[];
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

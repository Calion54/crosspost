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
  category?: ListingCategory | null;

  @Prop({ type: String, enum: Object.values(ListingCondition) })
  condition?: ListingCondition | null;

  @Prop({ type: String, enum: Object.values(ListingColor) })
  color?: ListingColor | null;

  @Prop({ type: String, required: true, enum: Object.values(PackageSize) })
  packageSize: PackageSize;

  @Prop({ type: [{ key: String, contentType: String }], default: [] })
  media: ListingMedia[];

  /**
   * Dénormalisé : true si au moins une publication est SOLD. Maintenu par le
   * sync — permet de filtrer / trier directement sur le Listing sans `$lookup`.
   * Une annonce ne se vend qu'une fois → un seul booléen global suffit.
   */
  @Prop({ required: true, default: false })
  sold: boolean;

  /**
   * Date de mise en ligne sur la plateforme (Vinted: 1ère photo ; LBC:
   * first_publication_date ; création manuelle: now). Sert au tri — plus
   * fiable que createdAt (identique pour tout un batch de sync).
   */
  @Prop({ required: true, default: () => new Date() })
  publishedAt: Date;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
ListingSchema.index({ userId: 1, sold: 1, publishedAt: -1 });

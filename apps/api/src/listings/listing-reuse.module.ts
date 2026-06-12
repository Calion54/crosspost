import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Listing, ListingSchema } from './schemas/listing.schema.js';
import {
  Publication,
  PublicationSchema,
} from '../publications/schemas/publication.schema.js';
import { MediaModule } from '../media/media.module.js';
import { ListingReuseService } from './listing-reuse.service.js';

/**
 * Module léger exposant la dédup cross-plateforme aux syncs (LBC, Vinted, …),
 * sans tirer tout le ListingsModule (controller, etc.).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Listing.name, schema: ListingSchema },
      { name: Publication.name, schema: PublicationSchema },
    ]),
    MediaModule,
  ],
  providers: [ListingReuseService],
  exports: [ListingReuseService],
})
export class ListingReuseModule {}

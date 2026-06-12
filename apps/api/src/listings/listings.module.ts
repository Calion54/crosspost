import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { AutoFillService } from './auto-fill.service.js';
import { Listing, ListingSchema } from './schemas/listing.schema.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]),
    MediaModule,
    PublicationsModule,
  ],
  controllers: [ListingsController],
  providers: [ListingsService, AutoFillService],
  exports: [ListingsService],
})
export class ListingsModule {}

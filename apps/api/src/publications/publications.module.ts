import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicationsController } from './publications.controller.js';
import { PublicationsService } from './publications.service.js';
import {
  Publication,
  PublicationSchema,
} from './schemas/publication.schema.js';
import {
  Listing,
  ListingSchema,
} from '../listings/schemas/listing.schema.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { PlatformPublishModule } from '../publish/platform-publish.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Publication.name, schema: PublicationSchema },
      { name: Listing.name, schema: ListingSchema },
    ]),
    AccountsModule,
    PlatformPublishModule,
  ],
  controllers: [PublicationsController],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}

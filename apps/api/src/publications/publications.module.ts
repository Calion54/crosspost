import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicationsController } from './publications.controller.js';
import { PublicationsService } from './publications.service.js';
import {
  Publication,
  PublicationSchema,
} from './schemas/publication.schema.js';
import {
  Account,
  AccountSchema,
} from '../accounts/schemas/account.schema.js';
import {
  Listing,
  ListingSchema,
} from '../listings/schemas/listing.schema.js';
import { PublishModule } from '../publish/publish.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Publication.name, schema: PublicationSchema },
      { name: Account.name, schema: AccountSchema },
      { name: Listing.name, schema: ListingSchema },
    ]),
    PublishModule,
  ],
  controllers: [PublicationsController],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}

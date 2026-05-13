import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublishController } from './publish.controller.js';
import { PublishService } from './publish.service.js';
import { SelectorRegistryService } from './registry/selector-registry.service.js';
import { Account, AccountSchema } from '../accounts/schemas/account.schema.js';
import { Listing, ListingSchema } from '../listings/schemas/listing.schema.js';
import {
  Publication,
  PublicationSchema,
} from '../publications/schemas/publication.schema.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Publication.name, schema: PublicationSchema },
    ]),
    MediaModule,
  ],
  controllers: [PublishController],
  providers: [PublishService, SelectorRegistryService],
})
export class PublishModule {}

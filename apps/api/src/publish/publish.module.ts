import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublishController } from './publish.controller.js';
import { PublishService } from './publish.service.js';
import { PlatformPublishDispatcher } from './platform-publish.dispatcher.js';
import { LeboncoinModule } from '../leboncoin/leboncoin.module.js';
import { VintedModule } from '../vinted/vinted.module.js';
import {
  Account,
  AccountSchema,
} from '../accounts/schemas/account.schema.js';
import {
  Listing,
  ListingSchema,
} from '../listings/schemas/listing.schema.js';
import {
  Publication,
  PublicationSchema,
} from '../publications/schemas/publication.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Publication.name, schema: PublicationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    LeboncoinModule,
    VintedModule,
  ],
  controllers: [PublishController],
  providers: [PublishService, PlatformPublishDispatcher],
  exports: [PlatformPublishDispatcher],
})
export class PublishModule {}

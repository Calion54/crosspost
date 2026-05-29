import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EncryptionModule } from '../common/crypto/encryption.module.js';
import { HttpModule } from '../common/http/http.module.js';
import { BrowserModule } from '../browser/browser.module.js';
import { MediaModule } from '../media/media.module.js';
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
import { AccountCredentialsStore } from '../accounts/account-credentials.store.js';
import { LeboncoinAuthService } from './auth/leboncoin-auth.service.js';
import { LeboncoinHttpClient } from './http/leboncoin-http.client.js';
import { LeboncoinSyncService } from './sync/leboncoin-sync.service.js';
import { LeboncoinCategoryMapper } from './sync/leboncoin-category.mapper.js';
import { LeboncoinAttributeMapper } from './sync/leboncoin-attribute.mapper.js';
import { LeboncoinPublishService } from './publish/leboncoin-publish.service.js';
import { LbcClassifyCategoryStep } from './publish/steps/lbc-classify-category.step.js';
import { LbcFetchDepositSchemaStep } from './publish/steps/lbc-fetch-deposit-schema.step.js';
import { LbcUploadImagesStep } from './publish/steps/lbc-upload-images.step.js';
import { LbcResolveAttributesStep } from './publish/steps/lbc-resolve-attributes.step.js';
import { LbcPredictShippingStep } from './publish/steps/lbc-predict-shipping.step.js';
import { LbcSubmitAdStep } from './publish/steps/lbc-submit-ad.step.js';
import { LbcFetchPricingStep } from './publish/steps/lbc-fetch-pricing.step.js';
import { LbcConfirmAdStep } from './publish/steps/lbc-confirm-ad.step.js';

@Module({
  imports: [
    EncryptionModule,
    BrowserModule,
    HttpModule,
    MediaModule,
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Publication.name, schema: PublicationSchema },
    ]),
  ],
  providers: [
    AccountCredentialsStore,
    LeboncoinAuthService,
    LeboncoinHttpClient,
    LeboncoinCategoryMapper,
    LeboncoinAttributeMapper,
    LeboncoinSyncService,
    LeboncoinPublishService,
    LbcClassifyCategoryStep,
    LbcFetchDepositSchemaStep,
    LbcUploadImagesStep,
    LbcResolveAttributesStep,
    LbcPredictShippingStep,
    LbcSubmitAdStep,
    LbcFetchPricingStep,
    LbcConfirmAdStep,
  ],
  exports: [
    AccountCredentialsStore,
    LeboncoinAuthService,
    LeboncoinHttpClient,
    LeboncoinSyncService,
    LeboncoinPublishService,
  ],
})
export class LeboncoinModule {}

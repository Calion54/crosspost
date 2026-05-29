import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrowserModule } from '../browser/browser.module.js';
import { HttpModule } from '../common/http/http.module.js';
import { EncryptionModule } from '../common/crypto/encryption.module.js';
import { MediaModule } from '../media/media.module.js';
import { Account, AccountSchema } from '../accounts/schemas/account.schema.js';
import {
  Listing,
  ListingSchema,
} from '../listings/schemas/listing.schema.js';
import {
  Publication,
  PublicationSchema,
} from '../publications/schemas/publication.schema.js';
import { AccountCredentialsStore } from '../accounts/account-credentials.store.js';
import { VintedAuthService } from './auth/vinted-auth.service.js';
import { VintedHttpClient } from './http/vinted-http.client.js';
import { VintedCatalogCache } from './catalog/vinted-catalog-cache.service.js';
import { VintedCategoryResolver } from './catalog/vinted-category-resolver.service.js';
import { VintedSyncService } from './sync/vinted-sync.service.js';
import { VintedPublishService } from './publish/vinted-publish.service.js';
import { VintedUploadPhotosStep } from './publish/steps/vinted-upload-photos.step.js';
import { VintedResolveCategoryStep } from './publish/steps/vinted-resolve-category.step.js';
import { VintedFetchPackageSizesStep } from './publish/steps/vinted-fetch-package-sizes.step.js';
import { VintedFetchAttributeSchemaStep } from './publish/steps/vinted-fetch-attribute-schema.step.js';
import { VintedFetchBrandsStep } from './publish/steps/vinted-fetch-brands.step.js';
import { VintedFetchColorsStep } from './publish/steps/vinted-fetch-colors.step.js';
import { VintedResolveAttributesStep } from './publish/steps/vinted-resolve-attributes.step.js';
import { VintedSubmitItemStep } from './publish/steps/vinted-submit-item.step.js';

@Module({
  imports: [
    BrowserModule,
    HttpModule,
    EncryptionModule,
    MediaModule,
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Listing.name, schema: ListingSchema },
      { name: Publication.name, schema: PublicationSchema },
    ]),
  ],
  providers: [
    AccountCredentialsStore,
    VintedAuthService,
    VintedHttpClient,
    VintedCatalogCache,
    VintedCategoryResolver,
    VintedSyncService,
    VintedPublishService,
    VintedUploadPhotosStep,
    VintedResolveCategoryStep,
    VintedFetchPackageSizesStep,
    VintedFetchAttributeSchemaStep,
    VintedFetchBrandsStep,
    VintedFetchColorsStep,
    VintedResolveAttributesStep,
    VintedSubmitItemStep,
  ],
  exports: [VintedAuthService, VintedSyncService, VintedPublishService],
})
export class VintedModule {}

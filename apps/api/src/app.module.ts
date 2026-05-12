import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EncryptionModule } from './common/crypto/encryption.module.js';
import { ScrapeDebugModule } from './common/debug/scrape-debug.module.js';
import { BrowserModule } from './browser/browser.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { PublicationsModule } from './publications/publications.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { SyncModule } from './sync/sync.module.js';
import { MediaModule } from './media/media.module.js';
import { PublishModule } from './publish/publish.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/crosspost'),
      }),
    }),
    EncryptionModule,
    ScrapeDebugModule,
    BrowserModule,
    ListingsModule,
    PublicationsModule,
    AccountsModule,
    SyncModule,
    MediaModule,
    PublishModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}

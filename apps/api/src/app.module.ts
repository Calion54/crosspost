import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { LlmModule } from './common/llm/llm.module.js';
import { EncryptionModule } from './common/crypto/encryption.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { PublicationsModule } from './publications/publications.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { SyncModule } from './sync/sync.module.js';
import { MediaModule } from './media/media.module.js';
import { PublishModule } from './publish/publish.module.js';
import { BumpModule } from './bump/bump.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { SettingsModule } from './settings/settings.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/crosspost'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    // Dashboard de monitoring des queues BullMQ. Monté en dehors de /api parce
    // que c'est un outil ops, pas une API métier. Chaque module qui enregistre
    // une queue doit ajouter BullBoardModule.forFeature pour qu'elle apparaisse.
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    LlmModule,
    EncryptionModule,
    UsersModule,
    ListingsModule,
    PublicationsModule,
    AccountsModule,
    SyncModule,
    MediaModule,
    PublishModule,
    BumpModule,
    AuthModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

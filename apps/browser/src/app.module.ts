import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BROWSER_QUEUE } from '@crosspost/shared';
import { BrowserModule } from './browser/browser.module.js';
import { VncModule } from './vnc/vnc.module.js';
import { ProcessorsModule } from './processors/processors.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: BROWSER_QUEUE }),
    BrowserModule,
    VncModule,
    ProcessorsModule,
  ],
})
export class AppModule {}

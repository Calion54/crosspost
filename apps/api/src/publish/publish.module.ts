import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { PublishController } from './publish.controller.js';
import { PublishService } from './publish.service.js';
import { PublishProcessor } from './publish.processor.js';
import { PublishEventBus } from './publish-event-bus.service.js';
import { PUBLISH_QUEUE } from './publish.queue.js';
import { PlatformPublishModule } from './platform-publish.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { UsersModule } from '../users/users.module.js';
import { PublicationsModule } from '../publications/publications.module.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUBLISH_QUEUE }),
    BullBoardModule.forFeature({
      name: PUBLISH_QUEUE,
      adapter: BullMQAdapter,
    }),
    PlatformPublishModule,
    AccountsModule,
    ListingsModule,
    UsersModule,
    PublicationsModule,
  ],
  controllers: [PublishController],
  providers: [PublishService, PublishProcessor, PublishEventBus],
})
export class PublishModule {}

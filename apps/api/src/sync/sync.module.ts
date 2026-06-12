import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { SyncProcessor } from './sync.processor.js';
import { SyncEventBus } from './sync-event-bus.service.js';
import { PlatformSyncDispatcher } from './platform-sync.dispatcher.js';
import { SYNC_QUEUE } from './sync.queue.js';
import {
  Account,
  AccountSchema,
} from '../accounts/schemas/account.schema.js';
import { LeboncoinModule } from '../leboncoin/leboncoin.module.js';
import { VintedModule } from '../vinted/vinted.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
    ]),
    BullModule.registerQueue({ name: SYNC_QUEUE }),
    BullBoardModule.forFeature({
      name: SYNC_QUEUE,
      adapter: BullMQAdapter,
    }),
    LeboncoinModule,
    VintedModule,
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncProcessor,
    SyncEventBus,
    PlatformSyncDispatcher,
  ],
  exports: [SyncService],
})
export class SyncModule {}

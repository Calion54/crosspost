import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BUMP_SCHEDULER_QUEUE } from './bump.queue.js';
import { BumpController } from './bump.controller.js';
import { BumpService } from './bump.service.js';
import { BumpScheduler } from './bump.scheduler.js';
import { BumpProcessor } from './bump.processor.js';
import { UsersModule } from '../users/users.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { PublishModule } from '../publish/publish.module.js';

/**
 * Remontée automatique (auto-bump). Un job répétable (BumpScheduler) alimente
 * la queue `bump-scheduler` ; BumpProcessor sélectionne les annonces dues et
 * délègue la remontée à la queue `publish` via PublishService.enqueueBump.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: BUMP_SCHEDULER_QUEUE }),
    BullBoardModule.forFeature({
      name: BUMP_SCHEDULER_QUEUE,
      adapter: BullMQAdapter,
    }),
    UsersModule,
    ListingsModule,
    PublicationsModule,
    PublishModule,
  ],
  controllers: [BumpController],
  providers: [BumpService, BumpScheduler, BumpProcessor],
})
export class BumpModule {}

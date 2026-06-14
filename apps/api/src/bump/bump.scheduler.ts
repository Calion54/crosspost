import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BUMP_SCHEDULER_QUEUE } from './bump.queue.js';

/** Intervalle du tick scheduler : 1h. La granularité de remontée par annonce
 * (≥ 24h) est portée par la config user, pas par ce tick. */
const TICK_EVERY_MS = 60 * 60 * 1000;

/**
 * Enregistre (idempotent) le job répétable du scheduler de remontée au boot.
 * BullMQ garantit qu'un seul tick s'exécute même en multi-instance.
 */
@Injectable()
export class BumpScheduler implements OnModuleInit {
  private readonly logger = new Logger(BumpScheduler.name);

  constructor(
    @InjectQueue(BUMP_SCHEDULER_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'bump-tick',
      { every: TICK_EVERY_MS },
      { name: 'tick' },
    );
    this.logger.log(
      `Scheduler de remontée enregistré (tick toutes les ${TICK_EVERY_MS / 60000} min)`,
    );
  }
}

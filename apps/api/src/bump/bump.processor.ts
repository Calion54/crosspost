import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BumpService } from './bump.service.js';
import {
  BUMP_SCHEDULER_QUEUE,
  type BumpTickResult,
} from './bump.queue.js';

/**
 * Worker du tick horaire de remontée auto. Délègue toute la logique de
 * sélection/délégation à BumpService (partagée avec le déclencheur manuel).
 */
@Processor(BUMP_SCHEDULER_QUEUE, { concurrency: 1 })
export class BumpProcessor extends WorkerHost {
  private readonly logger = new Logger(BumpProcessor.name);

  constructor(private readonly bumpService: BumpService) {
    super();
  }

  process(_job: Job): Promise<BumpTickResult> {
    return this.bumpService.runTick();
  }

  @OnWorkerEvent('failed')
  onFailed(_job: Job, err: Error) {
    this.logger.error(`Tick remontée échoué : ${err.message}`);
  }
}

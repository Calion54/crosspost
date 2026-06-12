import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PublishService } from './publish.service.js';
import { PublishEventBus } from './publish-event-bus.service.js';
import { PUBLISH_QUEUE, type PublishJobData } from './publish.queue.js';
import type { PublishResult } from './platform-publish.types.js';

/**
 * Worker BullMQ de publication. Queue unique : l'aiguillage par plateforme est
 * fait dans `PublishService.execute()` via le dispatcher (même pattern que sync).
 *
 * Concurrency volontairement basse : publier déclenche une chaîne d'appels aux
 * APIs marketplace (protégées DataDome) — on évite d'en lancer trop en parallèle.
 */
@Processor(PUBLISH_QUEUE, { concurrency: 3 })
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    private readonly publishService: PublishService,
    private readonly bus: PublishEventBus,
  ) {
    super();
  }

  async process(job: Job<PublishJobData>): Promise<PublishResult> {
    return this.publishService.execute(job.data);
  }

  @OnWorkerEvent('active')
  onActive(job: Job<PublishJobData>) {
    this.logger.log(
      `Publish job ${job.id} démarré (listing=${job.data.listingId}, account=${job.data.accountId}, ${job.data.platform})`,
    );
    this.bus.emit({ type: 'started', ...eventBase(job.data) });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PublishJobData>, result: PublishResult) {
    this.logger.log(`Publish job ${job.id} terminé → ${result.externalUrl}`);
    this.bus.emit({ type: 'completed', ...eventBase(job.data), result });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PublishJobData>, err: Error) {
    // `failed` se déclenche à CHAQUE tentative. On ne notifie / ne marque ERROR
    // que sur l'échec final (retries épuisés) — sinon un échec transitoire
    // rattrapé par un retry afficherait une erreur alors que le publish a réussi.
    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade >= maxAttempts;
    if (!isFinalAttempt) {
      this.logger.warn(
        `Publish job ${job.id} tentative ${job.attemptsMade}/${maxAttempts} échouée (retry) : ${err.message}`,
      );
      return;
    }
    this.logger.error(`Publish job ${job.id} échoué : ${err.message}`);
    await this.publishService.markFailed(job.data.publicationId, err.message);
    this.bus.emit({
      type: 'failed',
      ...eventBase(job.data),
      error: err.message,
    });
  }
}

/** Champs communs à tous les events, dérivés des données du job. */
function eventBase(data: PublishJobData) {
  return {
    userId: data.userId,
    accountId: data.accountId,
    listingId: data.listingId,
    platform: data.platform,
    publicationId: data.publicationId,
  };
}

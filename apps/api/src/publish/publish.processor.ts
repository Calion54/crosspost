import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { DelayedError, type Job } from 'bullmq';
import { PublishService } from './publish.service.js';
import { PublishLockService } from './publish-lock.service.js';
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
    private readonly lock: PublishLockService,
    private readonly bus: PublishEventBus,
  ) {
    super();
  }

  async process(
    job: Job<PublishJobData>,
    token?: string,
  ): Promise<PublishResult> {
    // Exclusion mutuelle PAR COMPTE : un même compte ne publie jamais 2 fois en
    // parallèle, mais 2 comptes distincts (même user, même plateforme) le
    // peuvent. `accountId` identifie le compte de façon unique (≡ userId +
    // externalUserId + platform). Si le verrou est pris, on renvoie le job en
    // `delayed` (il réessaiera) plutôt que d'occuper un slot.
    const lockKey = job.data.accountId;
    const lock = await this.lock.acquire(lockKey);
    if (!lock.acquired) {
      // Cooldown en cours → on dort exactement la durée restante (1 seul defer,
      // pas de polling). Sinon (publication en cours, courte) → re-test 5–15s.
      const delay = lock.cooldownRemainingMs
        ? lock.cooldownRemainingMs + Math.floor(Math.random() * 3_000)
        : 5_000 + Math.floor(Math.random() * 10_000);
      await job.moveToDelayed(Date.now() + delay, token);
      throw new DelayedError();
    }

    // 'started' émis seulement au vrai démarrage (après le verrou), pas à chaque
    // tentative différée — sinon l'UI clignote et les logs spamment.
    this.bus.emit({ type: 'started', ...eventBase(job.data) });

    try {
      const result = await this.publishService.execute(job.data);
      // Après une remontée réussie, on garde la plateforme en refroidissement
      // 1–2 min (aléatoire) pour espacer les annonces et limiter l'anti-bot.
      // La publication manuelle, elle, libère tout de suite.
      if (job.data.mode === 'bump') {
        const cooldown = 60_000 + Math.floor(Math.random() * 60_000);
        await this.lock.cooldown(lockKey, cooldown);
        const nextAt = new Date(Date.now() + cooldown).toLocaleString('fr-FR', {
          timeZone: 'Europe/Paris',
        });
        this.logger.log(
          `Prochaine publication ${job.data.userId}:${result.externalId}:${job.data.platform} : ${nextAt}`,
        );
      } else {
        await this.lock.release(lockKey);
      }
      return result;
    } catch (err) {
      // En cas d'échec, on libère immédiatement (pas de cooldown) pour ne pas
      // bloquer les retries / les autres annonces.
      await this.lock.release(lockKey);
      throw err;
    }
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

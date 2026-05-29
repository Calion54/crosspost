import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SyncEventBus } from './sync-event-bus.service.js';
import {
  SYNC_QUEUE,
  type SyncEvent,
  type SyncJobData,
} from './sync.queue.js';

interface MessageEvent {
  data: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue<SyncJobData>,
    private readonly bus: SyncEventBus,
  ) {}

  /**
   * Enqueue un sync. Retourne immédiatement le jobId.
   * Pas de dedup : si l'user spam-clique, plusieurs jobs partent — leur résultat
   * sera quasi identique (dedup au niveau Publication par externalId).
   */
  async enqueueSync(
    accountId: string,
    userId: string,
    trigger: 'login' | 'manual',
  ): Promise<string> {
    const job = await this.queue.add(
      'sync',
      { accountId, userId, trigger },
      { attempts: 2, backoff: { type: 'exponential', delay: 5_000 } },
    );
    this.bus.emit({ type: 'queued', userId, accountId, trigger });
    this.logger.log(
      `Sync job ${job.id} enqueued (account=${accountId}, trigger=${trigger})`,
    );
    return job.id ?? '';
  }

  /** Stream SSE des events de sync pour un utilisateur donné. */
  streamForUser(userId: string): Observable<MessageEvent> {
    return this.bus.forUser(userId).pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }
}

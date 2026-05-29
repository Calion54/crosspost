import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';
import type { SyncEvent } from './sync.queue.js';

/**
 * Bus d'événements process-wide pour les syncs. Le worker publie via emit(),
 * les abonnés SSE écoutent un sous-ensemble filtré par userId.
 *
 * Note multi-instance : à l'échelle, si on a plusieurs nodes API, ce bus
 * deviendra local à chaque process. Il faudra alors le remplacer par Redis
 * Pub/Sub (ou écouter les events BullMQ via QueueEvents directement). Pour la
 * v1 single-instance, le Subject suffit.
 */
@Injectable()
export class SyncEventBus {
  private readonly subject = new Subject<SyncEvent>();

  emit(event: SyncEvent): void {
    this.subject.next(event);
  }

  forUser(userId: string): Observable<SyncEvent> {
    return this.subject.pipe(filter((e) => e.userId === userId));
  }
}

import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter } from 'rxjs';
import type { PublishEvent } from './publish.queue.js';

/**
 * Bus d'événements process-wide pour les publications. Le worker publie via
 * emit(), les abonnés SSE écoutent un sous-ensemble filtré par userId.
 *
 * Note multi-instance : identique à `SyncEventBus`. À l'échelle (plusieurs nodes
 * API), ce Subject devient local au process — il faudra alors passer par Redis
 * Pub/Sub ou les `QueueEvents` BullMQ. Suffisant pour la v1 single-instance.
 */
@Injectable()
export class PublishEventBus {
  private readonly subject = new Subject<PublishEvent>();

  emit(event: PublishEvent): void {
    this.subject.next(event);
  }

  forUser(userId: string): Observable<PublishEvent> {
    return this.subject.pipe(filter((e) => e.userId === userId));
  }
}

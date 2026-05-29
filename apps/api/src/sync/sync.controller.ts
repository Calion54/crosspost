import { Controller, Param, Post, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { SyncService } from './sync.service.js';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

interface MessageEvent {
  data: string;
}

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /** Déclenche manuellement un sync depuis le front. Retourne le jobId. */
  @Post(':accountId')
  async startSync(
    @CurrentUser() user: AuthUser,
    @Param('accountId') accountId: string,
  ) {
    const jobId = await this.syncService.enqueueSync(
      accountId,
      user.userId,
      'manual',
    );
    return { jobId };
  }

  /**
   * Stream SSE de tous les events de sync de l'utilisateur courant.
   * Le front ouvre une seule connexion EventSource et reçoit en push :
   *   { type: 'queued' | 'started' | 'completed' | 'failed', accountId, ... }
   */
  @Sse('events')
  events(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.syncService.streamForUser(user.userId);
  }
}

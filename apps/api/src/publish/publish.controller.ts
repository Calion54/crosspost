import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PublishService } from './publish.service.js';
import { PublishEventBus } from './publish-event-bus.service.js';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

interface MessageEvent {
  data: string;
}

@Controller('publish')
export class PublishController {
  constructor(
    private readonly publishService: PublishService,
    private readonly bus: PublishEventBus,
  ) {}

  /**
   * Met une publication en file (BullMQ) et rend la main immédiatement.
   * Le client suit l'avancement via le flux SSE `/publish/events`.
   */
  @Post()
  publish(
    @CurrentUser() user: AuthUser,
    @Body() body: { listingId: string; accountId: string },
  ) {
    if (!body.listingId || !body.accountId) {
      throw new BadRequestException('listingId and accountId required');
    }
    return this.publishService.enqueue(
      body.listingId,
      body.accountId,
      user.userId,
    );
  }

  /**
   * Stream SSE de tous les events de publication de l'utilisateur courant.
   * Le front ouvre une seule connexion EventSource et reçoit en push :
   *   { type: 'queued' | 'started' | 'completed' | 'failed', accountId, ... }
   */
  @Sse('events')
  events(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.bus
      .forUser(user.userId)
      .pipe(map((event) => ({ data: JSON.stringify(event) })));
  }
}

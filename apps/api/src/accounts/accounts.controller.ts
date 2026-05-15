import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Sse,
  NotFoundException,
} from '@nestjs/common';
import { Observable, map, startWith } from 'rxjs';
import { AccountsService } from './accounts.service.js';
import type { Platform } from '@crosspost/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

interface MessageEvent {
  data: string;
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.accountsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.findOne(user.userId, id);
  }

  @Post('connect')
  connect(@CurrentUser() user: AuthUser, @Body('platform') platform: Platform) {
    const sessionId = this.accountsService.startConnect(user.userId, platform);
    return { sessionId };
  }

  @Sse('connect/:sessionId/events')
  connectEvents(
    @Param('sessionId') sessionId: string,
  ): Observable<MessageEvent> {
    console.log('DEBUG print')
    const subject = this.accountsService.getSessionSubject(sessionId);
    if (!subject) throw new NotFoundException('Connect session not found');

    const current = this.accountsService.getConnectStatus(sessionId);

    return subject.pipe(
      startWith(current),
      map((session) => ({
        data: JSON.stringify(session),
      })),
    );
  }

  @Post(':id/check-session')
  checkSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.checkSession(user.userId, id);
  }

  @Post(':id/reconnect')
  async reconnect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.userId, id);
    const sessionId = this.accountsService.startConnect(
      user.userId,
      account.platform,
    );
    return { sessionId };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.remove(user.userId, id);
  }
}

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import type { Platform } from '@crosspost/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

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

  @Get('connect/:sessionId/status')
  getConnectStatus(@Param('sessionId') sessionId: string) {
    const session = this.accountsService.getConnectStatus(sessionId);
    if (!session) throw new NotFoundException('Connect session not found');
    return session;
  }

  @Post(':id/check-session')
  checkSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.checkSession(user.userId, id);
  }

  @Post(':id/reconnect')
  async reconnect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.userId, id);
    const sessionId = this.accountsService.startConnect(user.userId, account.platform);
    return { sessionId };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.remove(user.userId, id);
  }
}

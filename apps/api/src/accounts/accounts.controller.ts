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

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Post('connect')
  connect(@Body('platform') platform: Platform) {
    const sessionId = this.accountsService.startConnect(platform);
    return { sessionId };
  }

  @Get('connect/:sessionId/status')
  getConnectStatus(@Param('sessionId') sessionId: string) {
    const session = this.accountsService.getConnectStatus(sessionId);
    if (!session) throw new NotFoundException('Connect session not found');
    return session;
  }

  @Post(':id/check-session')
  checkSession(@Param('id') id: string) {
    return this.accountsService.checkSession(id);
  }

  @Post(':id/reconnect')
  async reconnect(@Param('id') id: string) {
    const account = await this.accountsService.findOne(id);
    const sessionId = this.accountsService.startConnect(account.platform);
    return { sessionId };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accountsService.remove(id);
  }
}

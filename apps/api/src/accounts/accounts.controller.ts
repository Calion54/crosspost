import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { ConnectAccountDto } from './dto/connect.dto.js';
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
  connect(@CurrentUser() user: AuthUser, @Body() body: ConnectAccountDto) {
    return this.accountsService.connect(user.userId, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.accountsService.remove(user.userId, id);
  }
}

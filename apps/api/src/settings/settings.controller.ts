import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/settings.dto.js';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settingsService.getSettings(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(user.userId, dto);
  }
}

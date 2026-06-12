import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';
import { UsersModule } from '../users/users.module.js';
import { GeocodeModule } from '../common/geocode/geocode.module.js';

@Module({
  imports: [UsersModule, GeocodeModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

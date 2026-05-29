import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { GeocodeModule } from '../common/geocode/geocode.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    GeocodeModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

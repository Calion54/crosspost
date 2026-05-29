import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { ImageImporterService } from './image-importer.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, ImageImporterService],
  exports: [MediaService, ImageImporterService],
})
export class MediaModule {}

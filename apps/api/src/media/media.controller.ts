import {
  Controller,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { MediaService } from './media.service.js';

// TODO: get userId from JWT token once auth is implemented
const DEFAULT_USER_ID = 'default';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  async presign(
    @Body() body: { filename: string; contentType: string; userId?: string },
  ) {
    if (!body.filename || !body.contentType) {
      throw new BadRequestException('filename and contentType required');
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(body.contentType)) {
      throw new BadRequestException(
        `contentType must be one of: ${allowed.join(', ')}`,
      );
    }

    const userId = body.userId || DEFAULT_USER_ID;

    return this.mediaService.createPresignedUpload(
      userId,
      body.filename,
      body.contentType,
    );
  }
}

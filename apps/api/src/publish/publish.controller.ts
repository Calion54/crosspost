import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PublishService } from './publish.service.js';

@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post()
  async publish(@Body() body: { listingId: string; accountId: string }) {
    if (!body.listingId || !body.accountId) {
      throw new BadRequestException('listingId and accountId required');
    }

    const sessionId = this.publishService.startPublish(
      body.listingId,
      body.accountId,
    );

    return { sessionId };
  }

  @Get(':sessionId/status')
  getStatus(@Param('sessionId') sessionId: string) {
    const session = this.publishService.getPublishStatus(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }
}

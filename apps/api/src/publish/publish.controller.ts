import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PublishService } from './publish.service.js';

@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  /**
   * Étape 4 : publish synchrone (~10-30s d'attente côté client).
   * Étape 5 : sera remplacé par enqueue BullMQ + SSE pour les events.
   */
  @Post()
  publish(@Body() body: { listingId: string; accountId: string }) {
    if (!body.listingId || !body.accountId) {
      throw new BadRequestException('listingId and accountId required');
    }
    return this.publishService.publish(body.listingId, body.accountId);
  }
}

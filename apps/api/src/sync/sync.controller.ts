import {
  Controller,
  Post,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post(':accountId')
  startSync(@Param('accountId') accountId: string) {
    const sessionId = this.syncService.startSync(accountId);
    return { sessionId };
  }

  @Get(':sessionId/status')
  getSyncStatus(@Param('sessionId') sessionId: string) {
    const session = this.syncService.getSyncStatus(sessionId);
    if (!session) throw new NotFoundException('Sync session not found');
    return session;
  }
}

import { Global, Module } from '@nestjs/common';
import { ScrapeDebugService } from './scrape-debug.service.js';

@Global()
@Module({
  providers: [ScrapeDebugService],
  exports: [ScrapeDebugService],
})
export class ScrapeDebugModule {}

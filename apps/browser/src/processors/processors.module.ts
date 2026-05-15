import { Module } from '@nestjs/common';
import { ScrapeDebugModule } from '../common/debug/scrape-debug.module.js';
import { SelectorRegistryService } from '../publish/registry/selector-registry.service.js';
import { BrowserProcessor } from './browser.processor.js';
import { ConnectHandler } from './connect.handler.js';
import { SyncHandler } from './sync.handler.js';
import { CheckSessionHandler } from './check-session.handler.js';
import { LogoutHandler } from './logout.handler.js';
import { PublishHandler } from './publish.handler.js';

@Module({
  imports: [ScrapeDebugModule],
  providers: [
    SelectorRegistryService,
    BrowserProcessor,
    ConnectHandler,
    SyncHandler,
    CheckSessionHandler,
    LogoutHandler,
    PublishHandler,
  ],
})
export class ProcessorsModule {}

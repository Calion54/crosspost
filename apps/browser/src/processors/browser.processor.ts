import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BROWSER_QUEUE, BrowserJobName } from '@crosspost/shared';
import { ConnectHandler } from './connect.handler.js';
import { SyncHandler } from './sync.handler.js';
import { CheckSessionHandler } from './check-session.handler.js';
import { LogoutHandler } from './logout.handler.js';
import { PublishHandler } from './publish.handler.js';

@Processor(BROWSER_QUEUE)
export class BrowserProcessor extends WorkerHost {
  private readonly logger = new Logger(BrowserProcessor.name);

  constructor(
    private connectHandler: ConnectHandler,
    private syncHandler: SyncHandler,
    private checkSessionHandler: CheckSessionHandler,
    private logoutHandler: LogoutHandler,
    private publishHandler: PublishHandler,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.name} (${job.id})`);

    switch (job.name) {
      case BrowserJobName.CONNECT:
        return this.connectHandler.handle(job);
      case BrowserJobName.SYNC:
        return this.syncHandler.handle(job);
      case BrowserJobName.CHECK_SESSION:
        return this.checkSessionHandler.handle(job);
      case BrowserJobName.LOGOUT:
        return this.logoutHandler.handle(job);
      case BrowserJobName.PUBLISH:
        return this.publishHandler.handle(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}

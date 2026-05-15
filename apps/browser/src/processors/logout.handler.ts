import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  type LogoutJobData,
  type LogoutJobResult,
} from '@crosspost/shared';
import { BrowserService } from '../browser/browser.service.js';

@Injectable()
export class LogoutHandler {
  private readonly logger = new Logger(LogoutHandler.name);

  constructor(private browserService: BrowserService) {}

  async handle(
    job: Job<LogoutJobData, LogoutJobResult>,
  ): Promise<LogoutJobResult> {
    const { cookies, userAgent, logoutUrl } = job.data;

    try {
      const context = await this.browserService.createContext(cookies, userAgent);
      const page = await context.newPage();

      await page.goto(logoutUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });

      await context.close();
      await this.browserService.closeBrowser();
      return { ok: true };
    } catch (error: any) {
      this.logger.warn(`Logout failed: ${error.message}`);
      return { ok: false };
    }
  }
}

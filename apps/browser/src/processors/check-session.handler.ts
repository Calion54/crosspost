import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  type CheckSessionJobData,
  type CheckSessionJobResult,
} from '@crosspost/shared';
import { BrowserService } from '../browser/browser.service.js';

@Injectable()
export class CheckSessionHandler {
  private readonly logger = new Logger(CheckSessionHandler.name);

  constructor(private browserService: BrowserService) {}

  async handle(
    job: Job<CheckSessionJobData, CheckSessionJobResult>,
  ): Promise<CheckSessionJobResult> {
    const { cookies, userAgent, checkUrl } = job.data;

    try {
      const context = await this.browserService.createContext(cookies, userAgent);
      const page = await context.newPage();

      await page.goto(checkUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });

      const url = page.url();
      const isValid = !url.includes('connexion') && !url.includes('login');

      await context.close();
      return { isValid };
    } catch {
      return { isValid: false };
    } finally {
      await this.browserService.closeBrowser();
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  type ConnectJobData,
  type ConnectJobProgress,
  type ConnectJobResult,
} from '@crosspost/shared';
import { BrowserService } from '../browser/browser.service.js';
import { VncSessionService } from '../vnc/vnc-session.service.js';

@Injectable()
export class ConnectHandler {
  private readonly logger = new Logger(ConnectHandler.name);

  constructor(
    private browserService: BrowserService,
    private vncSessionService: VncSessionService,
  ) {}

  async handle(job: Job<ConnectJobData, ConnectJobResult>): Promise<ConnectJobResult> {
    const { platform, loginUrl, authCookie } = job.data;
    const sessionId = job.id!;

    const vncSession = await this.vncSessionService.create(sessionId);
    const vncUrl = `/api/vnc/${sessionId}?token=${vncSession.token}`;

    await job.updateProgress({
      status: 'browser_ready',
      vncUrl,
      vncToken: vncSession.token,
      wsPort: vncSession.wsPort,
    } satisfies ConnectJobProgress);

    const browser = await this.browserService.launchBrowserOnDisplay(vncSession.display);
    const context = await browser.newContext({
      locale: 'fr-FR',
      viewport: { width: vncSession.width, height: vncSession.height },
    });
    const page = await context.newPage();

    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

      await job.updateProgress({
        status: 'waiting_for_login',
        vncUrl,
        vncToken: vncSession.token,
        wsPort: vncSession.wsPort,
      } satisfies ConnectJobProgress);

      let email = '';
      page.on('request', (request) => {
        try {
          const postData = request.postData();
          if (postData && request.url().includes('auth')) {
            const parsed = JSON.parse(postData);
            if (parsed.email) email = parsed.email;
          }
        } catch {}
      });

      this.logger.log(`Waiting for manual login on ${platform}...`);

      const deadline = Date.now() + 300_000;
      let authenticated = false;

      while (Date.now() < deadline) {
        await page.waitForTimeout(2000);
        const cookies = await context.cookies();
        if (cookies.some((c) => c.name === authCookie)) {
          authenticated = true;
          break;
        }
      }

      if (!authenticated) {
        throw new Error('Login timed out after 5 minutes');
      }

      await page.waitForTimeout(2000);

      const cookies = await context.cookies();
      const userAgent = await page.evaluate(() => navigator.userAgent);

      return {
        cookies: cookies as unknown as Record<string, unknown>[],
        userAgent,
        email,
      };
    } finally {
      await context.close();
      await browser.close();
      this.vncSessionService.cleanup(sessionId);
    }
  }
}

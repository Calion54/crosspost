import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser, type BrowserContext } from 'playwright';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser: Browser | null = null;

  async onModuleDestroy() {
    await this.closeBrowser();
  }

  async launchBrowser(headless = false): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }
    this.browser = await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    });
    return this.browser;
  }

  async createContext(
    cookies?: Record<string, unknown>[],
    userAgent?: string,
  ): Promise<BrowserContext> {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      userAgent:
        userAgent ??
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1280, height: 800 },
    });

    if (cookies?.length) {
      await context.addCookies(cookies as any);
    }

    return context;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

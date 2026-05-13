import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { join } from 'path';
import { mkdir } from 'fs/promises';

const PROFILES_DIR = join(process.cwd(), 'browser-profiles');

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private persistentContexts = new Map<string, BrowserContext>();

  async onModuleDestroy() {
    for (const [, ctx] of this.persistentContexts) {
      await ctx.close().catch(() => {});
    }
    this.persistentContexts.clear();
    await this.closeBrowser();
  }

  // ─── Legacy API (used by accounts & sync) ────────────────────

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

  // ─── Persistent context API (used by publish) ────────────────

  async getPersistentContext(
    accountId: string,
    userAgent?: string,
  ): Promise<BrowserContext> {
    const existing = this.persistentContexts.get(accountId);
    if (existing) {
      try {
        await existing.pages();
        return existing;
      } catch {
        this.persistentContexts.delete(accountId);
      }
    }

    const profileDir = join(PROFILES_DIR, accountId);
    await mkdir(profileDir, { recursive: true });

    this.logger.log(`[browser] Launching persistent context for ${accountId}`);

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      userAgent:
        userAgent ??
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1280, height: 800 },
    });

    this.persistentContexts.set(accountId, context);
    return context;
  }

  async injectCookies(accountId: string, cookies: Record<string, unknown>[]) {
    const context = this.persistentContexts.get(accountId);
    if (context && cookies?.length) {
      await context.addCookies(cookies as any);
    }
  }

  async closePersistentContext(accountId: string) {
    const context = this.persistentContexts.get(accountId);
    if (context) {
      await context.close().catch(() => {});
      this.persistentContexts.delete(accountId);
    }
  }
}

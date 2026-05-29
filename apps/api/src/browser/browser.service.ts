import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  chromium,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from 'playwright';

/**
 * Options pour configurer le contexte du browser (UA, viewport, locale, etc.).
 * Type-alias direct de Playwright pour ne pas avoir à les recopier.
 */
export type BrowserPageOptions = BrowserContextOptions;

/**
 * Service générique d'orchestration browser. Mutualise :
 *  - le lancement/arrêt de Chromium (headless contrôlé par PLAYWRIGHT_HEADLESS)
 *  - les flags anti-automation de base
 *  - l'init script stealth minimum (masque navigator.webdriver)
 *  - les helpers de debug (screenshot sur erreur)
 *
 * Les platform services (Leboncoin, Vinted, …) ne dépendent pas de `playwright`
 * en runtime — ils appellent `withPage()` et reçoivent juste une `Page`
 * (importée en `import type` uniquement).
 */
@Injectable()
export class BrowserService {
  private readonly logger = new Logger(BrowserService.name);

  constructor(private readonly config: ConfigService) {}

  private get headless(): boolean {
    return this.config.get<string>('PLAYWRIGHT_HEADLESS', 'true') !== 'false';
  }

  /**
   * Screenshots de debug : on les pose dans `.debug/browser/` au CWD (typiquement
   * la racine du projet quand `pnpm dev` est lancé). Pattern dans .gitignore.
   * Surcharge possible via env var DEBUG_DIR.
   */
  private get debugDir(): string {
    const dir =
      this.config.get<string>('DEBUG_DIR') ??
      join(process.cwd(), '.debug', 'browser');
    try {
      mkdirSync(dir, { recursive: true });
    } catch {}
    return dir;
  }

  /**
   * Lance un browser, crée un context+page configuré, exécute callback, et
   * nettoie tout en finally. Pattern recommandé pour toute opération browser.
   */
  async withPage<T>(
    options: BrowserPageOptions,
    callback: (page: Page) => Promise<T>,
  ): Promise<T> {
    this.logger.log(`Launching Chromium (headless=${this.headless})`);
    const browser: Browser = await chromium.launch({
      headless: this.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    try {
      const context = await browser.newContext(options);
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      const page = await context.newPage();
      return await callback(page);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  /** Screenshot full-page + log de l'URL — pour debug d'un timeout ou d'une erreur. */
  async dumpDebug(page: Page, label: string): Promise<string | null> {
    try {
      const stamp = Date.now();
      const base = join(this.debugDir, `${label}-${stamp}`);
      this.logger.warn(`[debug] URL au moment de l'erreur: ${page.url()}`);
      await page.screenshot({ path: `${base}.png`, fullPage: true });
      this.logger.warn(`[debug] Screenshot: ${base}.png`);
      return base;
    } catch (e) {
      this.logger.warn(`[debug] Échec dump: ${(e as Error).message}`);
      return null;
    }
  }
}

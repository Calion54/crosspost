import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import type { Page } from 'playwright';

interface ScrapeSnapshot {
  url: string;
  platform: string;
  externalId: string;
  timestamp: string;
  jsonLd: unknown[];
  nextData: unknown | null;
  extractedData: Record<string, unknown>;
  criteriaHtml: string;
  bodySnippets: Record<string, string>;
  fullHtml?: string;
}

const DEBUG_DIR = join(process.cwd(), 'debug-snapshots');
const MAX_SNAPSHOTS = 200;

@Injectable()
export class ScrapeDebugService {
  private readonly logger = new Logger(ScrapeDebugService.name);

  async captureSnapshot(
    page: Page,
    opts: {
      platform: string;
      externalId: string;
      extractedData: Record<string, unknown>;
      saveFullHtml?: boolean;
    },
  ): Promise<string> {
    await mkdir(DEBUG_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${opts.platform}_${opts.externalId}_${timestamp}`;
    const snapshotDir = join(DEBUG_DIR, filename);
    await mkdir(snapshotDir, { recursive: true });

    const jsonLd = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const results: unknown[] = [];
      for (const script of scripts) {
        try { results.push(JSON.parse(script.textContent || '')); } catch {}
      }
      return results;
    });

    const nextData = await page.evaluate(() => {
      const script = document.querySelector('#__NEXT_DATA__');
      if (script) {
        try { return JSON.parse(script.textContent || ''); } catch {}
      }
      return null;
    });

    const bodySnippets = await page.evaluate(() => {
      const snippets: Record<string, string> = {};
      const breadcrumb =
        document.querySelector('[data-qa-id="breadcrumb"]') ||
        document.querySelector('[aria-label*="readcrumb"]') ||
        document.querySelector('[aria-label*="fil"]') ||
        document.querySelector('nav ol');
      if (breadcrumb) snippets['breadcrumb'] = breadcrumb.outerHTML.slice(0, 3000);

      for (const sel of [
        '[data-qa-id*="criteria"]', '[data-qa-id*="attribute"]',
        '[class*="criteria"]', '[class*="Criteria"]',
        '[class*="attribute"]', '[class*="Attribute"]',
      ]) {
        const el = document.querySelector(sel);
        if (el) snippets[`criteria(${sel})`] = el.outerHTML.slice(0, 5000);
      }

      const descEl =
        document.querySelector('[data-qa-id="adview_description_container"]') ||
        document.querySelector('[class*="Description"]') ||
        document.querySelector('[class*="description"]');
      if (descEl) snippets['description'] = descEl.outerHTML.slice(0, 3000);

      const priceEl = document.querySelector('[data-qa-id*="price"]');
      if (priceEl) snippets['price'] = priceEl.outerHTML.slice(0, 1000);

      const allText = document.body.innerHTML;
      for (const label of ['État', 'Marque', 'Catégorie']) {
        const idx = allText.indexOf(label);
        if (idx > 0) {
          snippets[`context(${label})`] = allText.slice(
            Math.max(0, idx - 300),
            Math.min(allText.length, idx + 500),
          );
        }
      }

      const qaIds: string[] = [];
      for (const el of document.querySelectorAll('[data-qa-id]')) {
        qaIds.push(el.getAttribute('data-qa-id') || '');
      }
      snippets['data-qa-ids'] = JSON.stringify(qaIds);
      return snippets;
    });

    const snapshot: ScrapeSnapshot = {
      url: page.url(),
      platform: opts.platform,
      externalId: opts.externalId,
      timestamp: new Date().toISOString(),
      jsonLd,
      nextData: nextData ? '(captured in next-data.json)' : null,
      extractedData: opts.extractedData,
      criteriaHtml: bodySnippets['criteria'] || '',
      bodySnippets,
    };

    await writeFile(join(snapshotDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
    if (nextData) await writeFile(join(snapshotDir, 'next-data.json'), JSON.stringify(nextData, null, 2));
    if (jsonLd.length > 0) await writeFile(join(snapshotDir, 'json-ld.json'), JSON.stringify(jsonLd, null, 2));
    if (opts.saveFullHtml) {
      const fullHtml = await page.content();
      await writeFile(join(snapshotDir, 'page.html'), fullHtml);
    }
    try { await page.screenshot({ path: join(snapshotDir, 'screenshot.png'), fullPage: false }); } catch {}

    this.logger.log(`Debug snapshot saved: ${snapshotDir}`);
    await this.cleanupOldSnapshots();
    return snapshotDir;
  }

  private async cleanupOldSnapshots() {
    try {
      const entries = await readdir(DEBUG_DIR);
      if (entries.length <= MAX_SNAPSHOTS) return;
      const sorted = await Promise.all(
        entries.map(async (name) => {
          const path = join(DEBUG_DIR, name);
          const s = await stat(path).catch(() => null);
          return { name, path, mtime: s?.mtime?.getTime() || 0 };
        }),
      );
      sorted.sort((a, b) => a.mtime - b.mtime);
      for (const entry of sorted.slice(0, sorted.length - MAX_SNAPSHOTS)) {
        await unlink(entry.path).catch(() => {});
      }
    } catch {}
  }
}

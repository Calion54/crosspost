import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ListingCondition,
  type SyncJobData,
  type SyncJobResult,
  type ScrapedListing,
} from '@crosspost/shared';
import type { Page } from 'playwright';
import { BrowserService } from '../browser/browser.service.js';
import { ScrapeDebugService } from '../common/debug/scrape-debug.service.js';

const CONDITION_MAP: Record<string, ListingCondition> = {
  'neuf': ListingCondition.NEW_WITH_TAGS,
  'très bon état': ListingCondition.VERY_GOOD,
  'bon état': ListingCondition.GOOD,
  'état correct': ListingCondition.FAIR,
};

@Injectable()
export class SyncHandler {
  private readonly logger = new Logger(SyncHandler.name);

  constructor(
    private browserService: BrowserService,
    private scrapeDebug: ScrapeDebugService,
  ) {}

  async handle(job: Job<SyncJobData, SyncJobResult>): Promise<SyncJobResult> {
    const { platform, cookies, userAgent } = job.data;

    if (platform === 'leboncoin') {
      const listings = await this.scrapeLeboncoin(cookies, userAgent);
      return { listings };
    }

    if (platform === 'vinted') {
      this.logger.warn('Vinted sync not implemented yet');
      return { listings: [] };
    }

    return { listings: [] };
  }

  private async scrapeLeboncoin(
    cookies: Record<string, unknown>[],
    userAgent?: string,
  ): Promise<ScrapedListing[]> {
    const context = await this.browserService.createContext(cookies, userAgent);
    const page = await context.newPage();

    try {
      await page.goto('https://www.leboncoin.fr/compte/mes-annonces', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      await page.waitForTimeout(5000);

      let previousCount = 0;
      for (let i = 0; i < 20; i++) {
        const currentCount = await page.evaluate(
          () => document.querySelectorAll('a[href*="/ad/"]').length,
        );
        if (currentCount === previousCount && i > 0) break;
        previousCount = currentCount;
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
      }

      const adUrls = await page.evaluate(() => {
        const seen = new Set<string>();
        const results: { externalId: string; externalUrl: string }[] = [];
        for (const el of document.querySelectorAll('a[href*="/ad/"]')) {
          const href = (el as HTMLAnchorElement).href;
          const match = href.match(/\/ad\/[^/]+\/(\d+)/);
          if (!match) continue;
          if (seen.has(match[1])) continue;
          seen.add(match[1]);
          results.push({ externalId: match[1], externalUrl: href });
        }
        return results;
      });

      this.logger.log(`[leboncoin] Found ${adUrls.length} ad URLs, scraping details...`);

      const listings: ScrapedListing[] = [];

      for (let i = 0; i < adUrls.length; i++) {
        const ad = adUrls[i];
        try {
          const detail = await this.scrapeLeboncoinDetail(page, ad.externalUrl, { isFirst: i === 0 });
          listings.push({ ...ad, ...detail });
          if ((i + 1) % 10 === 0) {
            this.logger.debug(`[leboncoin] Scraped ${i + 1}/${adUrls.length} ads`);
          }
        } catch (error: any) {
          this.logger.warn(`[leboncoin] Failed to scrape ad ${ad.externalId}: ${error.message}`);
        }
      }

      return listings;
    } finally {
      await context.close();
      await this.browserService.closeBrowser();
    }
  }

  private async scrapeLeboncoinDetail(
    page: Page,
    url: string,
    opts: { isFirst: boolean },
  ): Promise<Omit<ScrapedListing, 'externalId' | 'externalUrl'>> {
    const externalId = url.match(/\/(\d+)/)?.[1] || 'unknown';

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(2000);

    const ad = await page.evaluate(() => {
      const script = document.querySelector('#__NEXT_DATA__');
      if (!script) return null;
      try {
        const data = JSON.parse(script.textContent || '');
        return data?.props?.pageProps?.ad || null;
      } catch { return null; }
    });

    if (!ad) {
      this.logger.warn(`[leboncoin] No __NEXT_DATA__ for ${externalId}`);
      await this.scrapeDebug.captureSnapshot(page, {
        platform: 'leboncoin',
        externalId,
        extractedData: { error: 'No __NEXT_DATA__ found' },
        saveFullHtml: true,
      });
      return {
        title: '', description: '', price: 0,
        category: 'Autre', condition: ListingCondition.GOOD, imageUrls: [],
      };
    }

    const title: string = ad.subject || '';
    const description: string = ad.body || '';
    const price: number = Array.isArray(ad.price) ? ad.price[0] : ad.price || 0;
    const category: string = ad.category_name || 'Autre';
    const imageUrls: string[] = ad.images?.urls || [];

    const loc = ad.location || {};
    const location = loc.city && loc.zipcode ? `${loc.city} (${loc.zipcode})` : loc.city || '';

    const attributes: { key: string; value_label: string }[] = ad.attributes || [];
    const attrMap = new Map(attributes.map((a) => [a.key, a.value_label]));

    const brand =
      attrMap.get('brand') ||
      [...attrMap.entries()].find(([k]) => k.endsWith('_brand'))?.[1] || '';

    const conditionText = attrMap.get('item_condition') || attrMap.get('clothing_st') || '';
    let mappedCondition: ListingCondition = ListingCondition.GOOD;
    if (conditionText) {
      for (const [key, value] of Object.entries(CONDITION_MAP)) {
        if (conditionText.toLowerCase().includes(key)) {
          mappedCondition = value;
          break;
        }
      }
    }

    const result = {
      title, description, price, category,
      condition: mappedCondition,
      brand: brand || undefined,
      location: location || undefined,
      imageUrls,
    };

    const hasGaps = !title || !description || price === 0;
    if (opts.isFirst || hasGaps) {
      await this.scrapeDebug.captureSnapshot(page, {
        platform: 'leboncoin',
        externalId,
        extractedData: { ...result, attributes: Object.fromEntries(attrMap) },
        saveFullHtml: opts.isFirst,
      });
    }

    return result;
  }
}

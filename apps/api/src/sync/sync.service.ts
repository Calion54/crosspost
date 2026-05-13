import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Page } from 'playwright';
import { ListingCondition, Platform, PublicationStatus } from '@crosspost/shared';
import { Account, type AccountDocument } from '../accounts/schemas/account.schema.js';
import { Listing, type ListingDocument } from '../listings/schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { BrowserService } from '../browser/browser.service.js';
import { EncryptionService } from '../common/crypto/encryption.service.js';
import { ScrapeDebugService } from '../common/debug/scrape-debug.service.js';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncSession {
  status: SyncStatus;
  accountId: string;
  found?: number;
  created?: number;
  error?: string;
}

interface ScrapedListing {
  externalId: string;
  externalUrl: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: ListingCondition;
  brand?: string;
  location?: string;
  imageUrls: string[];
}

const CONDITION_MAP: Record<string, ListingCondition> = {
  'neuf': ListingCondition.NEW_WITH_TAGS,
  'très bon état': ListingCondition.VERY_GOOD,
  'bon état': ListingCondition.GOOD,
  'état correct': ListingCondition.FAIR,
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private syncSessions = new Map<string, SyncSession>();

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    private browserService: BrowserService,
    private encryptionService: EncryptionService,
    private scrapeDebug: ScrapeDebugService,
  ) {}

  getSyncStatus(sessionId: string): SyncSession | null {
    return this.syncSessions.get(sessionId) ?? null;
  }

  startSync(accountId: string): string {
    const sessionId = crypto.randomUUID();
    this.syncSessions.set(sessionId, {
      status: 'syncing',
      accountId,
    });

    this.runSync(sessionId, accountId).catch((error) => {
      this.logger.error(`Sync ${sessionId} failed: ${error.message}`);
      this.syncSessions.set(sessionId, {
        status: 'error',
        accountId,
        error: error.message,
      });
    });

    return sessionId;
  }

  private async runSync(sessionId: string, accountId: string) {
    const account = await this.accountModel.findById(accountId).exec();
    if (!account) throw new NotFoundException('Account not found');
    if (!account.encryptedCookies) throw new Error('Account not connected');

    const cookies = JSON.parse(
      this.encryptionService.decrypt(account.encryptedCookies),
    );

    this.logger.log(
      `Starting sync for ${account.platform} (${account.username})...`,
    );

    let scraped: ScrapedListing[] = [];

    if (account.platform === 'leboncoin') {
      scraped = await this.scrapeLeboncoin(cookies, account.userAgent);
    } else if (account.platform === 'vinted') {
      scraped = await this.scrapeVinted(cookies, account.userAgent);
    }

    this.logger.log(`Found ${scraped.length} listings on ${account.platform}`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of scraped) {
      // Skip items with missing required fields
      if (!item.title || !item.description || !item.price) {
        this.logger.warn(
          `[sync] Skipping ${item.externalId}: missing title/description/price`,
        );
        skipped++;
        continue;
      }

      const existing = await this.publicationModel
        .findOne({
          externalId: item.externalId,
          platform: account.platform,
        } as any)
        .exec();

      if (existing) {
        skipped++;
        continue;
      }

      try {
        const listing = await this.listingModel.create({
          title: item.title,
          description: item.description,
          price: item.price,
          category: item.category as any,
          condition: item.condition,
          location: item.location,
          media: [],
        });

        await this.publicationModel.create({
          listingId: listing._id,
          accountId: new Types.ObjectId(accountId),
          platform: account.platform,
          status: PublicationStatus.PUBLISHED,
          externalId: item.externalId,
          externalUrl: item.externalUrl,
        });

        created++;
      } catch (err: any) {
        this.logger.error(
          `[sync] Failed to save ${item.externalId}: ${err.message}`,
        );
        errors++;
      }
    }

    this.logger.log(
      `Sync complete: ${created} created, ${skipped} skipped, ${errors} errors (${scraped.length} total)`,
    );

    this.syncSessions.set(sessionId, {
      status: 'success',
      accountId,
      found: scraped.length,
      created,
    });
  }

  private async scrapeLeboncoin(
    cookies: Record<string, unknown>[],
    userAgent?: string,
  ): Promise<ScrapedListing[]> {
    const context = await this.browserService.createContext(cookies, userAgent);
    const page = await context.newPage();

    try {
      // Step 1: Get all ad URLs from listing page
      await page.goto('https://www.leboncoin.fr/compte/mes-annonces', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      await page.waitForTimeout(5000);

      // Scroll to load all listings
      let previousCount = 0;
      for (let i = 0; i < 20; i++) {
        const currentCount = await page.evaluate(
          () => document.querySelectorAll('a[href*="/ad/"]').length,
        );
        if (currentCount === previousCount && i > 0) break;
        previousCount = currentCount;
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
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

      this.logger.log(
        `[leboncoin] Found ${adUrls.length} ad URLs, scraping details...`,
      );

      // Step 2: Scrape each ad detail using the same page
      const listings: ScrapedListing[] = [];

      for (let i = 0; i < adUrls.length; i++) {
        const ad = adUrls[i];
        try {
          const detail = await this.scrapeLeboncoinDetail(page, ad.externalUrl, {
            isFirst: i === 0,
          });

          listings.push({
            ...ad,
            ...detail,
          });

          if ((i + 1) % 10 === 0) {
            this.logger.debug(
              `[leboncoin] Scraped ${i + 1}/${adUrls.length} ads`,
            );
          }
        } catch (error: any) {
          this.logger.warn(
            `[leboncoin] Failed to scrape ad ${ad.externalId}: ${error.message}`,
          );
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

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    await page.waitForTimeout(2000);

    // Primary source: __NEXT_DATA__ contains the full ad object
    const ad = await page.evaluate(() => {
      const script = document.querySelector('#__NEXT_DATA__');
      if (!script) return null;
      try {
        const data = JSON.parse(script.textContent || '');
        return data?.props?.pageProps?.ad || null;
      } catch {
        return null;
      }
    });

    if (!ad) {
      this.logger.warn(
        `[leboncoin] No __NEXT_DATA__ for ${externalId}, saving debug snapshot`,
      );
      await this.scrapeDebug.captureSnapshot(page, {
        platform: 'leboncoin',
        externalId,
        extractedData: { error: 'No __NEXT_DATA__ found' },
        saveFullHtml: true,
      });
      return {
        title: '',
        description: '',
        price: 0,
        category: 'Autre',
        condition: ListingCondition.GOOD,
        imageUrls: [],
      };
    }

    const title: string = ad.subject || '';
    const description: string = ad.body || '';
    const price: number = Array.isArray(ad.price) ? ad.price[0] : ad.price || 0;
    const category: string = ad.category_name || 'Autre';
    const imageUrls: string[] = ad.images?.urls || [];

    // Location: build "city (zipcode)" from ad.location
    const loc = ad.location || {};
    const location = loc.city && loc.zipcode
      ? `${loc.city} (${loc.zipcode})`
      : loc.city || '';

    // Extract condition and brand from attributes array
    const attributes: { key: string; value_label: string }[] =
      ad.attributes || [];
    const attrMap = new Map(attributes.map((a) => [a.key, a.value_label]));

    // Brand: look for category-specific brand keys or generic "brand"
    const brand =
      attrMap.get('brand') ||
      [...attrMap.entries()].find(([k]) => k.endsWith('_brand'))?.[1] ||
      '';

    // Condition: look for item_condition or état
    const conditionText =
      attrMap.get('item_condition') ||
      attrMap.get('clothing_st') ||
      '';

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
      title,
      description,
      price,
      category,
      condition: mappedCondition,
      brand: brand || undefined,
      location: location || undefined,
      imageUrls,
    };

    // Save debug snapshot for first ad or when extraction looks incomplete
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

  private async scrapeVinted(
    cookies: Record<string, unknown>[],
    userAgent?: string,
  ): Promise<ScrapedListing[]> {
    this.logger.warn('Vinted sync not implemented yet');
    return [];
  }
}

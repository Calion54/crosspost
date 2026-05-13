import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PublicationStatus } from '@crosspost/shared';
import { Account, type AccountDocument } from '../accounts/schemas/account.schema.js';
import { Listing, type ListingDocument } from '../listings/schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { BrowserService } from '../browser/browser.service.js';
import { EncryptionService } from '../common/crypto/encryption.service.js';
import { ScrapeDebugService } from '../common/debug/scrape-debug.service.js';
import { MediaService } from '../media/media.service.js';
import { SelectorRegistryService } from './registry/selector-registry.service.js';
import { waitForPageSettle } from './helpers/page.helpers.js';
import type { StepResult } from './helpers/form.helpers.js';
import type { PlatformPublisher, ListingData } from './platforms/platform-publisher.js';
import { LeboncoinPublisher } from './platforms/leboncoin/leboncoin.publisher.js';

export type PublishStatus = 'idle' | 'publishing' | 'success' | 'error';

export interface PublishSession {
  status: PublishStatus;
  listingId: string;
  accountId: string;
  step?: string;
  externalUrl?: string;
  error?: string;
}

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);
  private publishSessions = new Map<string, PublishSession>();
  private publishers: Record<string, PlatformPublisher>;

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    private browserService: BrowserService,
    private encryptionService: EncryptionService,
    private scrapeDebug: ScrapeDebugService,
    private mediaService: MediaService,
    private registry: SelectorRegistryService,
  ) {
    const leboncoin = new LeboncoinPublisher(this.registry);
    this.registry.registerDefaults('leboncoin', leboncoin.defaultRegistry);

    this.publishers = {
      leboncoin,
    };
  }

  getPublishStatus(sessionId: string): PublishSession | null {
    return this.publishSessions.get(sessionId) ?? null;
  }

  startPublish(listingId: string, accountId: string): string {
    const sessionId = crypto.randomUUID();
    this.publishSessions.set(sessionId, {
      status: 'publishing',
      listingId,
      accountId,
      step: 'starting',
    });

    this.runPublish(sessionId, listingId, accountId).catch((error) => {
      this.logger.error(`Publish ${sessionId} failed: ${error.message}`);
      this.publishSessions.set(sessionId, {
        status: 'error',
        listingId,
        accountId,
        error: error.message,
      });
    });

    return sessionId;
  }

  private async runPublish(
    sessionId: string,
    listingId: string,
    accountId: string,
  ) {
    const account = await this.accountModel.findById(accountId).exec();
    if (!account) throw new NotFoundException('Account not found');
    if (!account.encryptedCookies) throw new Error('Account not connected');

    const publisher = this.publishers[account.platform];
    if (!publisher) {
      throw new Error(`No publisher for platform: ${account.platform}`);
    }

    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Listing not found');

    // Load registry (with overrides if file exists)
    await this.registry.load(account.platform);

    const cookies = JSON.parse(
      this.encryptionService.decrypt(account.encryptedCookies),
    );

    const imagePaths = await this.downloadImages(listing.media || []);

    const context = await this.browserService.getPersistentContext(
      accountId,
      account.userAgent,
    );
    await this.browserService.injectCookies(accountId, cookies);

    const page = await context.newPage();
    let snapshotCount = 0;

    try {
      // Navigate
      this.updateSession(sessionId, { step: 'navigating' });
      await page.goto(publisher.startUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await waitForPageSettle(page);

      // Initial snapshot
      await this.scrapeDebug.captureSnapshot(page, {
        platform: account.platform,
        externalId: `publish_start_${listingId}`,
        extractedData: { listingId },
        saveFullHtml: true,
      });

      // Build listing data
      const listingData: ListingData = {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        color: listing.color,
        packageSize: listing.packageSize,
        location: listing.location,
      };

      // Run deterministic workflow
      for (const step of publisher.steps) {
        this.updateSession(sessionId, { step: step.name });
        this.logger.debug(`[publish] Step: ${step.name}`);

        try {
          await step.run({ page, listing: listingData, imagePaths });
        } catch (err: any) {
          this.logger.warn(`[publish] Step "${step.name}" failed: ${err.message}`);
          // Take snapshot on failure
          await this.scrapeDebug.captureSnapshot(page, {
            platform: account.platform,
            externalId: `publish_fail_${step.name}_${listingId}`,
            extractedData: { step: step.name, error: err.message },
          });
          throw err;
        }

        // Snapshot after each step (full HTML for first 3 steps to debug)
        await this.scrapeDebug.captureSnapshot(page, {
          platform: account.platform,
          externalId: `publish_step_${step.name}_${listingId}`,
          extractedData: { step: step.name },
          saveFullHtml: snapshotCount < 15,
        });
        snapshotCount++;
      }

      // Extract result
      this.updateSession(sessionId, { step: 'verifying' });
      const result = await publisher.extractResult(page);

      // Save publication
      await this.publicationModel.findOneAndUpdate(
        {
          listingId: new Types.ObjectId(listingId),
          accountId: new Types.ObjectId(accountId),
          platform: account.platform,
        },
        {
          status: PublicationStatus.PUBLISHED,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          errorMessage: undefined,
        },
        { upsert: true, new: true },
      );

      this.publishSessions.set(sessionId, {
        status: 'success',
        listingId,
        accountId,
        externalUrl: result.externalUrl,
      });

      this.logger.log(
        `Published listing ${listingId} on ${account.platform} → ${result.externalUrl}`,
      );
    } catch (error: any) {
      try {
        await this.scrapeDebug.captureSnapshot(page, {
          platform: account.platform,
          externalId: `publish_error_${listingId}`,
          extractedData: { error: error.message, listingId },
          saveFullHtml: true,
        });
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      await page.close();
      this.cleanupImages(imagePaths);
    }
  }

  // ─── Image helpers ─────────────────────────────────────────────

  private async downloadImages(
    media: { key: string; contentType: string }[],
  ): Promise<string[]> {
    if (media.length === 0) return [];

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crosspost-'));
    const filePaths: string[] = [];

    for (let i = 0; i < media.length; i++) {
      const { key } = media[i];
      const ext = key.split('.').pop() || 'jpg';
      try {
        const url = await this.mediaService.getSignedUrl(key);
        const response = await fetch(url);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const filePath = path.join(tmpDir, `image_${i}.${ext}`);
          fs.writeFileSync(filePath, buffer);
          filePaths.push(filePath);
        }
      } catch {
        this.logger.warn(`[publish] Could not download image: ${key}`);
      }
    }

    this.logger.debug(
      `[publish] Downloaded ${filePaths.length}/${media.length} images`,
    );
    return filePaths;
  }

  private cleanupImages(filePaths: string[]) {
    for (const fp of filePaths) {
      try {
        fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
    if (filePaths.length > 0) {
      try {
        fs.rmdirSync(path.dirname(filePaths[0]));
      } catch {
        /* ignore */
      }
    }
  }

  private updateSession(sessionId: string, update: Partial<PublishSession>) {
    const current = this.publishSessions.get(sessionId);
    if (current) {
      this.publishSessions.set(sessionId, { ...current, ...update });
    }
  }
}

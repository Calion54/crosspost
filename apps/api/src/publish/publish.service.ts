import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
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
import { BrowserAgent } from './browser-agent.js';
import type { PlatformPublisher } from './platforms/platform-publisher.js';
import { LeboncoinPublisher } from './platforms/leboncoin.publisher.js';

export type PublishStatus = 'idle' | 'publishing' | 'success' | 'error';

export interface PublishSession {
  status: PublishStatus;
  listingId: string;
  accountId: string;
  step?: string;
  externalUrl?: string;
  error?: string;
}

const PUBLISHERS: Record<string, PlatformPublisher> = {
  leboncoin: new LeboncoinPublisher(),
};

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);
  private publishSessions = new Map<string, PublishSession>();
  private agent: BrowserAgent;

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    private browserService: BrowserService,
    private encryptionService: EncryptionService,
    private scrapeDebug: ScrapeDebugService,
    private mediaService: MediaService,
    private configService: ConfigService,
  ) {
    this.agent = new BrowserAgent(
      this.configService.get<string>('ANTHROPIC_API_KEY')!,
    );
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

    const publisher = PUBLISHERS[account.platform];
    if (!publisher) {
      throw new Error(`No publisher for platform: ${account.platform}`);
    }

    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Listing not found');

    const cookies = JSON.parse(
      this.encryptionService.decrypt(account.encryptedCookies),
    );

    const imagePaths = await this.downloadImages(listing.media || []);

    const context = await this.browserService.createContext(
      cookies,
      account.userAgent,
    );
    const page = await context.newPage();

    try {
      // Navigate to the form
      this.updateSession(sessionId, { step: 'navigating' });
      await page.goto(publisher.getStartUrl(), {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForSelector('input, textarea, button, [role]', {
        timeout: 15_000,
      });

      // Build listing data for the agent
      const listingData: Record<string, unknown> = {
        title: listing.title,
        description: listing.description,
        price: listing.price,
      };
      if (listing.category) listingData.category = listing.category;
      if (listing.condition) listingData.condition = listing.condition;
      if (listing.brand) listingData.brand = listing.brand;
      if (listing.size) listingData.size = listing.size;
      if (listing.color) listingData.color = listing.color;
      if (listing.location) listingData.location = listing.location;

      // Run the agent
      this.updateSession(sessionId, { step: 'filling_form' });
      await this.agent.run({
        page,
        imagePaths,
        listingData,
        imageCount: imagePaths.length,
        systemPrompt: publisher.getSystemPrompt(),
        scrapeDebug: this.scrapeDebug,
        platform: account.platform,
        onStep: (step) => this.updateSession(sessionId, { step }),
      });

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
          externalId: `publish_fail_${listingId}`,
          extractedData: { error: error.message, listingId },
          saveFullHtml: true,
        });
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      await context.close();
      await this.browserService.closeBrowser();
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

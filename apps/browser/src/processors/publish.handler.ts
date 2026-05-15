import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  type PublishJobData,
  type PublishJobProgress,
  type PublishJobResult,
} from '@crosspost/shared';
import { BrowserService } from '../browser/browser.service.js';
import { ScrapeDebugService } from '../common/debug/scrape-debug.service.js';
import { SelectorRegistryService } from '../publish/registry/selector-registry.service.js';
import { waitForPageSettle } from '../publish/helpers/page.helpers.js';
import type { PlatformPublisher, ListingData } from '../publish/platforms/platform-publisher.js';
import { LeboncoinPublisher } from '../publish/platforms/leboncoin/leboncoin.publisher.js';

@Injectable()
export class PublishHandler {
  private readonly logger = new Logger(PublishHandler.name);
  private publishers: Record<string, PlatformPublisher>;

  constructor(
    private browserService: BrowserService,
    private scrapeDebug: ScrapeDebugService,
    private registry: SelectorRegistryService,
  ) {
    const leboncoin = new LeboncoinPublisher(this.registry);
    this.registry.registerDefaults('leboncoin', leboncoin.defaultRegistry);
    this.publishers = { leboncoin };
  }

  async handle(job: Job<PublishJobData, PublishJobResult>): Promise<PublishJobResult> {
    const { platform, cookies, userAgent, accountId, listing, imageUrls } = job.data;

    const publisher = this.publishers[platform];
    if (!publisher) throw new Error(`No publisher for platform: ${platform}`);

    await this.registry.load(platform);

    const imagePaths = await this.downloadImages(imageUrls);

    const context = await this.browserService.getPersistentContext(accountId, userAgent);
    await this.browserService.injectCookies(accountId, cookies);

    const page = await context.newPage();
    let snapshotCount = 0;

    try {
      await job.updateProgress({ step: 'navigating' } satisfies PublishJobProgress);
      await page.goto(publisher.startUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await waitForPageSettle(page);

      await this.scrapeDebug.captureSnapshot(page, {
        platform,
        externalId: `publish_start_${job.id}`,
        extractedData: { jobId: job.id },
        saveFullHtml: true,
      });

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

      for (const step of publisher.steps) {
        await job.updateProgress({ step: step.name } satisfies PublishJobProgress);
        this.logger.debug(`[publish] Step: ${step.name}`);

        try {
          await step.run({ page, listing: listingData, imagePaths });
        } catch (err: any) {
          this.logger.warn(`[publish] Step "${step.name}" failed: ${err.message}`);
          await this.scrapeDebug.captureSnapshot(page, {
            platform,
            externalId: `publish_fail_${step.name}_${job.id}`,
            extractedData: { step: step.name, error: err.message },
          });
          throw err;
        }

        await this.scrapeDebug.captureSnapshot(page, {
          platform,
          externalId: `publish_step_${step.name}_${job.id}`,
          extractedData: { step: step.name },
          saveFullHtml: snapshotCount < 15,
        });
        snapshotCount++;
      }

      await job.updateProgress({ step: 'verifying' } satisfies PublishJobProgress);
      const result = await publisher.extractResult(page);

      this.logger.log(`Published on ${platform} → ${result.externalUrl}`);
      return result;
    } finally {
      await page.close();
      this.cleanupImages(imagePaths);
    }
  }

  private async downloadImages(urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crosspost-'));
    const filePaths: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const response = await fetch(urls[i]);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
          const filePath = path.join(tmpDir, `image_${i}.${ext}`);
          fs.writeFileSync(filePath, buffer);
          filePaths.push(filePath);
        }
      } catch {
        this.logger.warn(`[publish] Could not download image ${i}`);
      }
    }

    return filePaths;
  }

  private cleanupImages(filePaths: string[]) {
    for (const fp of filePaths) {
      try { fs.unlinkSync(fp); } catch {}
    }
    if (filePaths.length > 0) {
      try { fs.rmdirSync(path.dirname(filePaths[0])); } catch {}
    }
  }
}

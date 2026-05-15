import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { Queue, QueueEvents } from 'bullmq';
import {
  PublicationStatus,
  BROWSER_QUEUE,
  BrowserJobName,
  type SyncJobData,
  type SyncJobResult,
} from '@crosspost/shared';
import { Account, type AccountDocument } from '../accounts/schemas/account.schema.js';
import { Listing, type ListingDocument } from '../listings/schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { EncryptionService } from '../common/crypto/encryption.service.js';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncSession {
  status: SyncStatus;
  accountId: string;
  found?: number;
  created?: number;
  error?: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private syncSessions = new Map<string, SyncSession>();

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectQueue(BROWSER_QUEUE) private browserQueue: Queue,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    this.redisConnection = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };
  }

  private readonly redisConnection: { host: string; port: number };

  getSyncStatus(sessionId: string): SyncSession | null {
    return this.syncSessions.get(sessionId) ?? null;
  }

  startSync(accountId: string): string {
    const sessionId = crypto.randomUUID();
    this.syncSessions.set(sessionId, { status: 'syncing', accountId });

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

    // Enqueue browser job
    const job = await this.browserQueue.add(
      BrowserJobName.SYNC,
      {
        platform: account.platform,
        cookies,
        userAgent: account.userAgent,
      } satisfies SyncJobData,
    );

    const queueEvents = new QueueEvents(BROWSER_QUEUE, {
      connection: this.redisConnection,
    });

    const result = await job.waitUntilFinished(queueEvents, 300_000) as SyncJobResult;
    await queueEvents.close();

    const scraped = result.listings;
    this.logger.log(`Found ${scraped.length} listings on ${account.platform}`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of scraped) {
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
}

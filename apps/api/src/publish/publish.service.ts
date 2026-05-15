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
  type PublishJobData,
  type PublishJobResult,
} from '@crosspost/shared';
import { Account, type AccountDocument } from '../accounts/schemas/account.schema.js';
import { Listing, type ListingDocument } from '../listings/schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { EncryptionService } from '../common/crypto/encryption.service.js';
import { MediaService } from '../media/media.service.js';

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

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectQueue(BROWSER_QUEUE) private browserQueue: Queue,
    private encryptionService: EncryptionService,
    private mediaService: MediaService,
    private configService: ConfigService,
  ) {
    this.redisConnection = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };
  }

  private readonly redisConnection: { host: string; port: number };

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

    const listing = await this.listingModel.findById(listingId).exec();
    if (!listing) throw new NotFoundException('Listing not found');

    const cookies = JSON.parse(
      this.encryptionService.decrypt(account.encryptedCookies),
    );

    // Get presigned URLs for images
    const imageUrls: string[] = [];
    for (const media of listing.media || []) {
      try {
        const url = await this.mediaService.getSignedUrl(media.key);
        imageUrls.push(url);
      } catch {
        this.logger.warn(`[publish] Could not get signed URL for ${media.key}`);
      }
    }

    // Enqueue browser job
    const job = await this.browserQueue.add(
      BrowserJobName.PUBLISH,
      {
        platform: account.platform,
        cookies,
        userAgent: account.userAgent,
        accountId,
        listing: {
          title: listing.title,
          description: listing.description,
          price: listing.price,
          category: listing.category,
          condition: listing.condition,
          color: listing.color,
          packageSize: listing.packageSize,
          location: listing.location,
        },
        imageUrls,
      } satisfies PublishJobData,
    );

    const queueEvents = new QueueEvents(BROWSER_QUEUE, {
      connection: this.redisConnection,
    });

    // Listen for progress (step updates)
    const onProgress = ({ jobId, data }: { jobId: string; data: any }) => {
      if (jobId !== job.id) return;
      this.updateSession(sessionId, { step: data.step });
    };
    queueEvents.on('progress', onProgress);

    try {
      const result = await job.waitUntilFinished(queueEvents, 300_000) as PublishJobResult;

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
      throw error;
    } finally {
      queueEvents.off('progress', onProgress);
      await queueEvents.close();
    }
  }

  private updateSession(sessionId: string, update: Partial<PublishSession>) {
    const current = this.publishSessions.get(sessionId);
    if (current) {
      this.publishSessions.set(sessionId, { ...current, ...update });
    }
  }
}

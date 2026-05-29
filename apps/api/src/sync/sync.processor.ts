import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Model, Types } from 'mongoose';
import type { Job } from 'bullmq';
import {
  Account,
  type AccountDocument,
} from '../accounts/schemas/account.schema.js';
import { PlatformSyncDispatcher } from './platform-sync.dispatcher.js';
import { SyncEventBus } from './sync-event-bus.service.js';
import { SYNC_QUEUE, type SyncJobData } from './sync.queue.js';
import type { SyncResult } from './platform-sync.types.js';

@Processor(SYNC_QUEUE, { concurrency: 5 })
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    private readonly dispatcher: PlatformSyncDispatcher,
    private readonly bus: SyncEventBus,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<SyncResult> {
    const { accountId } = job.data;
    const account = await this.accountModel
      .findById(new Types.ObjectId(accountId))
      .exec();
    if (!account) {
      throw new Error(`Account ${accountId} introuvable`);
    }
    const adapter = this.dispatcher.forPlatform(account.platform);
    return adapter.sync(account);
  }

  @OnWorkerEvent('active')
  onActive(job: Job<SyncJobData>) {
    this.logger.log(
      `Sync job ${job.id} démarré (account=${job.data.accountId}, trigger=${job.data.trigger})`,
    );
    this.bus.emit({
      type: 'started',
      userId: job.data.userId,
      accountId: job.data.accountId,
      trigger: job.data.trigger,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<SyncJobData>, result: SyncResult) {
    this.logger.log(
      `Sync job ${job.id} terminé : ${JSON.stringify(result)}`,
    );
    this.bus.emit({
      type: 'completed',
      userId: job.data.userId,
      accountId: job.data.accountId,
      trigger: job.data.trigger,
      result,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SyncJobData>, err: Error) {
    this.logger.error(`Sync job ${job.id} échoué : ${err.message}`);
    this.bus.emit({
      type: 'failed',
      userId: job.data.userId,
      accountId: job.data.accountId,
      trigger: job.data.trigger,
      error: err.message,
    });
  }
}

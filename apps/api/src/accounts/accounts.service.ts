import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Queue, QueueEvents } from 'bullmq';
import { Subject } from 'rxjs';
import {
  Platform,
  BROWSER_QUEUE,
  BrowserJobName,
  type ConnectJobData,
  type ConnectJobResult,
  type ConnectJobProgress,
  type CheckSessionJobData,
  type CheckSessionJobResult,
  type LogoutJobData,
} from '@crosspost/shared';
import { Account, type AccountDocument } from './schemas/account.schema.js';
import { EncryptionService } from '../common/crypto/encryption.service.js';

const PLATFORM_CONFIG: Record<
  Platform,
  {
    loginUrl: string;
    authCookie: string;
    checkUrl: string;
    logoutUrl: string;
  }
> = {
  [Platform.LEBONCOIN]: {
    loginUrl: 'https://www.leboncoin.fr/compte',
    authCookie: '__Secure-Login',
    checkUrl: 'https://www.leboncoin.fr',
    logoutUrl: 'https://www.leboncoin.fr/compte/deconnexion',
  },
  [Platform.VINTED]: {
    loginUrl: 'https://www.vinted.fr/member/login',
    authCookie: '_vinted_fr_session',
    checkUrl: 'https://www.vinted.fr',
    logoutUrl: 'https://www.vinted.fr/member/logout',
  },
};

export type ConnectStatus =
  | 'starting'
  | 'browser_ready'
  | 'waiting_for_login'
  | 'success'
  | 'error';

export interface ConnectSession {
  status: ConnectStatus;
  platform: Platform;
  error?: string;
  accountId?: string;
  vncUrl?: string;
  vncToken?: string;
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private connectSessions = new Map<string, ConnectSession>();
  private sessionSubjects = new Map<string, Subject<ConnectSession>>();
  private queueEvents: QueueEvents;

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectQueue(BROWSER_QUEUE) private browserQueue: Queue,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    this.redisConnection = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    };
    console.log(`>>> QueueEvents connecting to Redis ${this.redisConnection.host}:${this.redisConnection.port}`);
    this.queueEvents = new QueueEvents(BROWSER_QUEUE, {
      connection: this.redisConnection,
    });
    this.queueEvents.on('error', (err) => {
      this.logger.error(`[QueueEvents] error: ${err.message}`);
    });

    // Debug: listen to ALL events
    const origEmit = this.queueEvents.emit.bind(this.queueEvents);
    this.queueEvents.emit = (event: any, ...args: any[]) => {
      if (event !== 'error') {
        console.log(`>>> QueueEvents event: "${event}"`, JSON.stringify(args[0])?.slice(0, 200));
      }
      return origEmit(event, ...args);
    };
  }

  private readonly redisConnection: { host: string; port: number };

  findAll(userId: string) {
    return this.accountModel
      .find({ userId })
      .select('-encryptedCookies')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(userId: string, id: string) {
    const account = await this.accountModel
      .findOne({ _id: id, userId })
      .select('-encryptedCookies')
      .exec();
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  getConnectStatus(sessionId: string): ConnectSession | null {
    return this.connectSessions.get(sessionId) ?? null;
  }

  getSessionSubject(sessionId: string): Subject<ConnectSession> | undefined {
    return this.sessionSubjects.get(sessionId);
  }

  startConnect(userId: string, platform: Platform): string {
    const sessionId = crypto.randomUUID();
    const config = PLATFORM_CONFIG[platform];

    const initial: ConnectSession = { status: 'starting', platform };
    this.connectSessions.set(sessionId, initial);
    this.sessionSubjects.set(sessionId, new Subject<ConnectSession>());

    this.enqueueConnect(sessionId, userId, platform, config).catch((error) => {
      this.logger.error(`Connect ${sessionId} failed: ${error.message}`);
      this.updateSession(sessionId, {
        status: 'error',
        platform,
        error: error.message,
      });
    });

    return sessionId;
  }

  private async enqueueConnect(
    sessionId: string,
    userId: string,
    platform: Platform,
    config: (typeof PLATFORM_CONFIG)[Platform],
  ) {
    console.log(`>>> enqueueConnect: adding job ${sessionId}`);
    console.log(`>>> QueueEvents name: ${this.queueEvents.name}`);

    const job = await this.browserQueue.add(
      BrowserJobName.CONNECT,
      {
        platform,
        loginUrl: config.loginUrl,
        authCookie: config.authCookie,
      } satisfies ConnectJobData,
      { jobId: sessionId },
    );

    console.log(`>>> Job added: ${job.id}`);

    // Test: is QueueEvents actually receiving anything?
    await this.queueEvents.waitUntilReady();
    console.log(`>>> QueueEvents is ready, listening for progress on queue "${this.queueEvents.name}"`);

    // Listen for progress updates (VNC ready, waiting for login)
    const onProgress = async ({ jobId, data }: { jobId: string; data: any }) => {
      console.log(`>>> onProgress: jobId=${jobId}, data=${JSON.stringify(data)}`);
      if (jobId !== sessionId) return;
      const progress = data as ConnectJobProgress;

      this.updateSession(sessionId, {
        status: progress.status,
        platform,
        vncUrl: progress.vncUrl,
        vncToken: progress.vncToken,
      });
    };

    this.queueEvents.on('progress', onProgress);

    try {
      const result = await job.waitUntilFinished(this.queueEvents, 310_000) as ConnectJobResult;

      const username = result.email || `${platform} account`;
      const encryptedCookies = this.encryptionService.encrypt(
        JSON.stringify(result.cookies),
      );

      const account = await this.accountModel
        .findOneAndUpdate(
          { userId, platform },
          {
            userId,
            platform,
            username,
            encryptedCookies,
            userAgent: result.userAgent,
            isConnected: true,
            lastCheckedAt: new Date(),
          },
          { upsert: true, new: true },
        )
        .exec();

      this.logger.log(`Successfully connected ${platform} account (${username})`);

      this.updateSession(sessionId, {
        status: 'success',
        platform,
        accountId: account._id.toString(),
      });
    } catch (error: any) {
      this.logger.error(`Connect failed for ${platform}: ${error.message}`);
      this.updateSession(sessionId, {
        status: 'error',
        platform,
        error: error.message,
      });
    } finally {
      this.queueEvents.off('progress', onProgress);
    }
  }

  private updateSession(sessionId: string, session: ConnectSession) {
    this.connectSessions.set(sessionId, session);
    const subject = this.sessionSubjects.get(sessionId);
    if (subject) {
      subject.next(session);
      if (session.status === 'success' || session.status === 'error') {
        subject.complete();
        this.sessionSubjects.delete(sessionId);
      }
    }
  }

  async checkSession(
    userId: string,
    id: string,
  ): Promise<{ isValid: boolean }> {
    const account = await this.accountModel.findOne({ _id: id, userId }).exec();
    if (!account?.encryptedCookies) return { isValid: false };

    let cookies: Record<string, unknown>[];
    try {
      cookies = JSON.parse(
        this.encryptionService.decrypt(account.encryptedCookies),
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to decrypt cookies for account ${id}: ${err.message}. Marking as disconnected.`,
      );
      await this.accountModel.findByIdAndUpdate(id, {
        isConnected: false,
        lastCheckedAt: new Date(),
      });
      return { isValid: false };
    }

    const config = PLATFORM_CONFIG[account.platform];

    try {
      const job = await this.browserQueue.add(
        BrowserJobName.CHECK_SESSION,
        {
          cookies,
          userAgent: account.userAgent,
          checkUrl: config.checkUrl,
        } satisfies CheckSessionJobData,
      );

      const queueEvents = new QueueEvents(BROWSER_QUEUE, {
        connection: this.redisConnection,
      });

      const result = await job.waitUntilFinished(queueEvents, 30_000) as CheckSessionJobResult;
      await queueEvents.close();

      await this.accountModel.findByIdAndUpdate(id, {
        isConnected: result.isValid,
        lastCheckedAt: new Date(),
      });

      return result;
    } catch {
      await this.accountModel.findByIdAndUpdate(id, {
        isConnected: false,
        lastCheckedAt: new Date(),
      });
      return { isValid: false };
    }
  }

  async remove(userId: string, id: string) {
    const account = await this.accountModel.findOne({ _id: id, userId }).exec();
    if (!account) throw new NotFoundException('Account not found');

    // Try to logout via browser service
    try {
      const cookies = JSON.parse(
        this.encryptionService.decrypt(account.encryptedCookies),
      );
      await this.browserQueue.add(
        BrowserJobName.LOGOUT,
        {
          cookies,
          userAgent: account.userAgent,
          logoutUrl: PLATFORM_CONFIG[account.platform].logoutUrl,
        } satisfies LogoutJobData,
      );
    } catch (error: any) {
      this.logger.warn(
        `Could not logout from ${account.platform}: ${error.message}`,
      );
    }

    await this.accountModel.findOneAndDelete({ _id: id, userId }).exec();
    return { message: 'Account removed' };
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Platform } from '@crosspost/shared';
import { Account, type AccountDocument } from './schemas/account.schema.js';
import { BrowserService } from '../browser/browser.service.js';
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

export type ConnectStatus = 'idle' | 'waiting_for_login' | 'success' | 'error';

export interface ConnectSession {
  status: ConnectStatus;
  platform: Platform;
  error?: string;
  accountId?: string;
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private connectSessions = new Map<string, ConnectSession>();

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    private browserService: BrowserService,
    private encryptionService: EncryptionService,
  ) {}

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

  startConnect(userId: string, platform: Platform): string {
    const config = PLATFORM_CONFIG[platform];

    const sessionId = crypto.randomUUID();
    this.connectSessions.set(sessionId, {
      status: 'waiting_for_login',
      platform,
    });

    // Fire and forget — browser stays open until user logs in
    this.runConnect(sessionId, userId, platform, config.loginUrl).catch(
      (error) => {
        this.logger.error(
          `Connect session ${sessionId} failed: ${error.message}`,
        );
        this.connectSessions.set(sessionId, {
          status: 'error',
          platform,
          error: error.message,
        });
      },
    );

    return sessionId;
  }

  private async runConnect(
    sessionId: string,
    userId: string,
    platform: Platform,
    loginUrl: string,
  ) {
    this.logger.log(`Launching browser for ${platform} login...`);

    const browser = await this.browserService.launchBrowser(false);
    const context = await browser.newContext({
      locale: 'fr-FR',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

      // Capture email from login form before user submits
      let email = '';
      page.on('request', (request) => {
        try {
          const postData = request.postData();
          if (postData && request.url().includes('auth')) {
            const parsed = JSON.parse(postData);
            if (parsed.email) email = parsed.email;
          }
        } catch {
          // Not JSON, ignore
        }
      });

      this.logger.log(`Waiting for manual login on ${platform}...`);

      // Poll for auth cookie presence (max 5 min)
      const authCookieName = PLATFORM_CONFIG[platform].authCookie;
      const deadline = Date.now() + 300_000;
      let authenticated = false;

      while (Date.now() < deadline) {
        await page.waitForTimeout(2000);
        const cookies = await context.cookies();
        const cookieNames = cookies.map((c) => c.name);
        this.logger.debug(
          `[${platform}] Cookies found: ${cookieNames.join(', ')}`,
        );
        if (cookies.some((c) => c.name === authCookieName)) {
          authenticated = true;
          break;
        }
      }

      if (!authenticated) {
        throw new Error('Login timed out after 5 minutes');
      }

      // Give time for session to fully settle
      await page.waitForTimeout(2000);

      const cookies = await context.cookies();
      const userAgent = await page.evaluate(() => navigator.userAgent);

      const username = email || `${platform} account`;

      const encryptedCookies = this.encryptionService.encrypt(
        JSON.stringify(cookies),
      );

      const account = await this.accountModel
        .findOneAndUpdate(
          { userId, platform },
          {
            userId,
            platform,
            username,
            encryptedCookies,
            userAgent,
            isConnected: true,
            lastCheckedAt: new Date(),
          },
          { upsert: true, new: true },
        )
        .exec();

      this.logger.log(
        `Successfully connected ${platform} account (${username})`,
      );

      this.connectSessions.set(sessionId, {
        status: 'success',
        platform,
        accountId: account._id.toString(),
      });
    } catch (error: any) {
      this.logger.error(`Login failed for ${platform}: ${error.message}`);
      this.connectSessions.set(sessionId, {
        status: 'error',
        platform,
        error: error.message,
      });
    } finally {
      await context.close();
      await this.browserService.closeBrowser();
    }
  }

  async checkSession(
    userId: string,
    id: string,
  ): Promise<{ isValid: boolean }> {
    const account = await this.accountModel.findOne({ _id: id, userId }).exec();
    if (!account?.encryptedCookies) {
      return { isValid: false };
    }

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
      const context = await this.browserService.createContext(
        cookies,
        account.userAgent,
      );
      const page = await context.newPage();

      await page.goto(config.checkUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });

      const url = page.url();
      const isValid = !url.includes('connexion') && !url.includes('login');

      await this.accountModel.findByIdAndUpdate(id, {
        isConnected: isValid,
        lastCheckedAt: new Date(),
      });

      await context.close();
      return { isValid };
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

    // Try to logout on the platform
    try {
      const cookies = JSON.parse(
        this.encryptionService.decrypt(account.encryptedCookies),
      );
      const context = await this.browserService.createContext(
        cookies,
        account.userAgent,
      );
      const page = await context.newPage();
      await page.goto(PLATFORM_CONFIG[account.platform].logoutUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });
      await context.close();
      await this.browserService.closeBrowser();
    } catch (error: any) {
      this.logger.warn(
        `Could not logout from ${account.platform}: ${error.message}`,
      );
    }

    await this.accountModel.findOneAndDelete({ _id: id, userId }).exec();
    return { message: 'Account removed' };
  }
}

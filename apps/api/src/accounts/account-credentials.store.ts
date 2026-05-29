import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Platform } from '@crosspost/shared';
import { Account, type AccountDocument } from './schemas/account.schema.js';
import { EncryptionService } from '../common/crypto/encryption.service.js';

/**
 * Persistance des credentials d'un Account.
 * Générique : ne connaît rien du shape — chaque platform service serialise + parse avec son propre Zod schema.
 */
@Injectable()
export class AccountCredentialsStore {
  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  /** Upsert d'un account avec ses credentials fraîches (utilisé au login). */
  async upsertConnected<T>(params: {
    userId: string;
    platform: Platform;
    email: string;
    phone?: string;
    externalUserId: string;
    credentials: T;
    tokenExpiresAt: Date;
  }): Promise<AccountDocument> {
    const credentialsEnc = this.encryption.encrypt(
      JSON.stringify(params.credentials),
    );
    const now = new Date();
    return this.accountModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(params.userId),
          platform: params.platform,
          externalUserId: params.externalUserId,
        },
        {
          userId: new Types.ObjectId(params.userId),
          platform: params.platform,
          email: params.email,
          phone: params.phone,
          externalUserId: params.externalUserId,
          credentialsEnc,
          tokenExpiresAt: params.tokenExpiresAt,
          isConnected: true,
          needsReconnect: false,
          connectedAt: now,
          lastRefreshedAt: now,
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  /** Décrypte le blob — le caller le parse avec son Zod schema. */
  decryptCredentials(account: AccountDocument): unknown {
    return JSON.parse(this.encryption.decrypt(account.credentialsEnc));
  }

  /** Update partiel après refresh : nouveau blob + nouvelle expiration. */
  async updateCredentials<T>(
    accountId: Types.ObjectId | string,
    credentials: T,
    tokenExpiresAt: Date,
  ): Promise<void> {
    const credentialsEnc = this.encryption.encrypt(JSON.stringify(credentials));
    await this.accountModel
      .findByIdAndUpdate(accountId, {
        credentialsEnc,
        tokenExpiresAt,
        lastRefreshedAt: new Date(),
        isConnected: true,
        needsReconnect: false,
      })
      .exec();
  }

  /** Marque comme à reconnecter (refresh révoqué, datadome killé). */
  async markNeedsReconnect(accountId: Types.ObjectId | string): Promise<void> {
    await this.accountModel
      .findByIdAndUpdate(accountId, {
        isConnected: false,
        needsReconnect: true,
      })
      .exec();
  }
}

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

  /**
   * Update partiel après refresh : nouveau blob + nouvelle expiration.
   * Mute AUSSI le doc en mémoire : les requêtes suivantes qui réutilisent ce
   * même `account` (ex: pagination de sync, refresh proactif) relisent
   * `credentialsEnc`/`tokenExpiresAt` dessus. Sans ça, elles renverraient
   * l'ancien token/datadome (le doc en mémoire divergerait de la DB) → 401.
   */
  async updateCredentials<T>(
    account: AccountDocument,
    credentials: T,
    tokenExpiresAt: Date,
  ): Promise<void> {
    const credentialsEnc = this.encryption.encrypt(JSON.stringify(credentials));
    const now = new Date();
    account.credentialsEnc = credentialsEnc;
    account.tokenExpiresAt = tokenExpiresAt;
    account.lastRefreshedAt = now;
    account.isConnected = true;
    account.needsReconnect = false;
    await this.accountModel
      .findByIdAndUpdate(account._id, {
        credentialsEnc,
        tokenExpiresAt,
        lastRefreshedAt: now,
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

  /**
   * Reset le flag `needsReconnect` quand un appel HTTP réel a réussi : preuve
   * que les creds marchent. Appelé par les HTTP clients après chaque réponse
   * non-401, et uniquement si le flag était à true (évite une écriture DB
   * inutile sur le cas nominal).
   */
  async markConnected(accountId: Types.ObjectId | string): Promise<void> {
    await this.accountModel
      .findByIdAndUpdate(accountId, {
        isConnected: true,
        needsReconnect: false,
      })
      .exec();
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Platform } from '@crosspost/shared';
import {
  Account,
  type AccountDocument,
} from './schemas/account.schema.js';
import { AccountCredentialsStore } from './account-credentials.store.js';
import { PlatformAuthDispatcher } from './platform-auth.dispatcher.js';
import { SyncService } from '../sync/sync.service.js';

/** Champs renvoyés au frontend — jamais de credentials. */
const PUBLIC_PROJECTION = {
  email: 1,
  platform: 1,
  externalUserId: 1,
  isConnected: 1,
  needsReconnect: 1,
  connectedAt: 1,
  lastRefreshedAt: 1,
  tokenExpiresAt: 1,
} as const;

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectModel(Account.name)
    private readonly accountModel: Model<AccountDocument>,
    private readonly store: AccountCredentialsStore,
    private readonly authDispatcher: PlatformAuthDispatcher,
    private readonly syncService: SyncService,
  ) {}

  findAll(userId: string) {
    return this.accountModel
      .find({ userId: new Types.ObjectId(userId) })
      .select(PUBLIC_PROJECTION)
      .sort({ connectedAt: -1 })
      .lean()
      .exec();
  }

  async findOne(userId: string, id: string) {
    const account = await this.accountModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .select(PUBLIC_PROJECTION)
      .lean()
      .exec();
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  /**
   * Récupère le document Account complet (credentials inclus) par id, sans
   * scope user. Réservé aux contextes internes (publish/sync workers) qui ont
   * besoin du document hydraté pour appeler les plateformes — pas exposé au front.
   */
  getById(id: string): Promise<AccountDocument | null> {
    return this.accountModel.findById(new Types.ObjectId(id)).exec();
  }

  /**
   * Connecte un compte : login one-shot via la plateforme + persist credentials chiffrés.
   * Endpoint synchrone — ~3-8s côté client.
   */
  async connect(
    userId: string,
    params: {
      platform: Platform;
      email: string;
      password: string;
    },
  ) {
    const auth = this.authDispatcher.forPlatform(params.platform);

    this.logger.log(`Login ${params.platform} pour ${params.email}...`);
    const result = await auth.loginWithPassword(params.email, params.password);

    const account = await this.store.upsertConnected({
      userId,
      platform: params.platform,
      email: params.email,
      phone: result.phone,
      externalUserId: result.externalUserId,
      credentials: result.credentials,
      tokenExpiresAt: result.tokenExpiresAt,
    });

    this.logger.log(
      `Compte ${params.platform} connecté pour ${params.email} (${result.externalUserId})`,
    );

    // Auto-sync en background (job BullMQ). L'utilisateur recevra le résultat via SSE.
    void this.syncService.enqueueSync(
      account._id.toString(),
      userId,
      'login',
    );

    return {
      _id: account._id.toString(),
      platform: account.platform,
      email: account.email,
      externalUserId: account.externalUserId,
      isConnected: account.isConnected,
      needsReconnect: account.needsReconnect,
      connectedAt: account.connectedAt,
      tokenExpiresAt: account.tokenExpiresAt,
    };
  }

  /**
   * Supprime un compte :
   *  1. Tente le logout best-effort côté plateforme (révoque la session distante)
   *  2. Supprime le doc Mongo dans tous les cas
   */
  async remove(userId: string, id: string) {
    const account = await this.accountModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!account) throw new NotFoundException('Account not found');

    try {
      const auth = this.authDispatcher.forPlatform(account.platform);
      await auth.logout(account);
    } catch (err) {
      this.logger.warn(
        `Logout distant échoué pour ${account.platform} (${account.email}): ${(err as Error).message}`,
      );
    }

    await this.accountModel.deleteOne({ _id: account._id }).exec();
    return { message: 'Account removed' };
  }
}

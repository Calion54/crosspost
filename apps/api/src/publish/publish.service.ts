import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AccountsService } from '../accounts/accounts.service.js';
import { ListingsService } from '../listings/listings.service.js';
import { UsersService } from '../users/users.service.js';
import { PublicationsService } from '../publications/publications.service.js';
import { PlatformPublishDispatcher } from './platform-publish.dispatcher.js';
import { PublishEventBus } from './publish-event-bus.service.js';
import { PUBLISH_QUEUE, type PublishJobData } from './publish.queue.js';
import type { PublishResult } from './platform-publish.types.js';

/**
 * Orchestrateur publish générique, asynchrone via BullMQ (queue unique
 * `publish`). Délègue à la plateforme via dispatcher et passe par les services
 * de domaine (Accounts/Listings/Users/Publications) — aucun accès Mongoose direct.
 *
 *  - `enqueue()`  : valide vite, upsert la Publication en PENDING, met le job en
 *                   file et rend la main immédiatement.
 *  - `execute()`  : exécuté par le worker — publie réellement et passe la
 *                   Publication en PUBLISHED.
 *  - `markFailed()`: passe la Publication en ERROR (appelé par le worker sur
 *                   échec final).
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @InjectQueue(PUBLISH_QUEUE) private readonly queue: Queue<PublishJobData>,
    private readonly dispatcher: PlatformPublishDispatcher,
    private readonly bus: PublishEventBus,
    private readonly accounts: AccountsService,
    private readonly listings: ListingsService,
    private readonly users: UsersService,
    private readonly publications: PublicationsService,
  ) {}

  /**
   * Valide (compte/annonce/location), upsert la Publication en PENDING et met
   * le job en file. Retourne immédiatement.
   */
  async enqueue(
    listingId: string,
    accountId: string,
    userId: string,
  ): Promise<{ jobId: string; publicationId: string }> {
    const account = await this.accounts.getById(accountId);
    if (!account) throw new NotFoundException('Account not found');

    const listing = await this.listings.getById(listingId);
    if (!listing) throw new NotFoundException('Listing not found');

    // Location par défaut obligatoire : on remonte un 400 tout de suite plutôt
    // que de mettre en file un job voué à échouer.
    const defaultLocation = listing.userId
      ? await this.users.getDefaultLocation(listing.userId.toString())
      : undefined;
    if (!defaultLocation) {
      throw new BadRequestException(
        'Aucune location par défaut — configure-la dans /settings avant de publier',
      );
    }

    const publication = await this.publications.upsertPending({
      listingId,
      accountId,
      platform: account.platform,
    });

    const publicationId = publication._id.toString();
    const jobData: PublishJobData = {
      listingId,
      accountId,
      userId,
      platform: account.platform,
      publicationId,
    };

    // Comme pour sync : pas de jobId custom ni de removeOn* — les jobs restent
    // visibles dans le board (complétés ET échoués) et une re-publication
    // (re-clic / bump) repart toujours sur un job neuf. Dedup côté UI (bouton
    // désactivé pendant la publication).
    const job = await this.queue.add('publish', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5_000 },
    });

    this.bus.emit({ type: 'queued', ...jobData });
    this.logger.log(
      `Publish job ${job.id} enqueued (listing=${listingId}, account=${accountId}, ${account.platform})`,
    );

    return { jobId: job.id ?? '', publicationId };
  }

  /**
   * Exécuté par le worker. Recharge le contexte, publie via la plateforme et
   * passe la Publication en PUBLISHED. Lève en cas d'échec → BullMQ retry, puis
   * `markFailed()` sur l'échec final.
   */
  async execute(data: PublishJobData): Promise<PublishResult> {
    const account = await this.accounts.getById(data.accountId);
    if (!account) throw new Error(`Account ${data.accountId} introuvable`);

    const listing = await this.listings.getById(data.listingId);
    if (!listing) throw new Error(`Listing ${data.listingId} introuvable`);

    const defaultLocation = listing.userId
      ? await this.users.getDefaultLocation(listing.userId.toString())
      : undefined;
    if (!defaultLocation) {
      throw new Error('Aucune location par défaut configurée');
    }

    this.logger.log(
      `Publish "${listing.title}" sur ${account.platform} (${account.email})...`,
    );

    const adapter = this.dispatcher.forPlatform(account.platform);
    const result = await adapter.publish(account, listing, { defaultLocation });

    await this.publications.markPublished(data.publicationId, result);

    this.logger.log(`✓ Publié sur ${account.platform} → ${result.externalUrl}`);
    return result;
  }

  /** Passe la Publication en ERROR (échec final d'un job). */
  markFailed(publicationId: string, message: string): Promise<void> {
    return this.publications.markFailed(publicationId, message);
  }
}

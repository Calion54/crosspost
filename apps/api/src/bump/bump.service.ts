import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { ListingsService } from '../listings/listings.service.js';
import { PublicationsService } from '../publications/publications.service.js';
import { PublishService } from '../publish/publish.service.js';
import type { BumpTickResult } from './bump.queue.js';

/** Plafond d'annonces remontées par tick et par user (lisse la charge ;
 * le reliquat est repris au tick suivant). */
const MAX_LISTINGS_PER_USER_PER_TICK = 50;

/**
 * Cœur de la remontée auto : sélectionne les annonces dues et délègue la
 * remontée à la queue `publish` (mode='bump'). Appelé par le tick horaire
 * (BumpProcessor) ET par le déclencheur manuel (BumpController). Ne
 * publie/supprime rien lui-même. La réduction de prix est appliquée une fois
 * par annonce (pas par plateforme).
 */
@Injectable()
export class BumpService {
  private readonly logger = new Logger(BumpService.name);

  constructor(
    private readonly users: UsersService,
    private readonly listings: ListingsService,
    private readonly publications: PublicationsService,
    private readonly publishService: PublishService,
  ) {}

  async runTick(): Promise<BumpTickResult> {
    const userIds = await this.users.findIdsWithBumpEnabled();
    let listingsDue = 0;
    let jobsEnqueued = 0;

    for (const userId of userIds) {
      const cfg = await this.users.getBumpConfig(userId);
      if (!cfg.enabled) continue; // garde-fou (la requête filtre déjà)

      const cutoff = new Date(
        Date.now() - cfg.intervalDays * 24 * 60 * 60 * 1000,
      );
      const due = await this.publications.findDueForBump(
        userId,
        cutoff,
        MAX_LISTINGS_PER_USER_PER_TICK,
      );

      if (due.length === MAX_LISTINGS_PER_USER_PER_TICK) {
        this.logger.warn(
          `User ${userId} : batch plafonné à ${MAX_LISTINGS_PER_USER_PER_TICK} annonces — reliquat au prochain tick`,
        );
      }

      for (const listing of due) {
        if (cfg.priceReductionPercent > 0) {
          const newPrice = await this.listings.applyPriceReduction(
            listing.listingId,
            cfg.priceReductionPercent,
          );
          this.logger.log(
            `Listing ${listing.listingId} : prix réduit à ${newPrice}€ (-${cfg.priceReductionPercent}%)`,
          );
        }

        for (const pub of listing.publications) {
          await this.publishService.enqueueBump({
            listingId: listing.listingId,
            accountId: pub.accountId,
            userId,
            platform: pub.platform,
          });
          jobsEnqueued++;
        }
        listingsDue++;
      }
    }

    const result: BumpTickResult = {
      usersScanned: userIds.length,
      listingsDue,
      jobsEnqueued,
    };
    if (jobsEnqueued > 0) {
      this.logger.log(
        `Remontée : ${listingsDue} annonces dues → ${jobsEnqueued} jobs enqueue (${userIds.length} users)`,
      );
    }
    return result;
  }
}

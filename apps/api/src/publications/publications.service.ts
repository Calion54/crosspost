import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Platform, PublicationStatus } from '@crosspost/shared';
import {
  Publication,
  type PublicationDocument,
} from './schemas/publication.schema.js';
import {
  Listing,
  type ListingDocument,
} from '../listings/schemas/listing.schema.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { PlatformPublishDispatcher } from '../publish/platform-publish.dispatcher.js';
import type { DeletePublicationResult } from '../publish/platform-publish.types.js';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    // Listing reste injecté en direct UNIQUEMENT pour le check d'ownership de
    // `remove()` : passer par ListingsService créerait un cycle DI
    // (ListingsModule importe déjà PublicationsModule). Exception assumée.
    @InjectModel(Listing.name)
    private listingModel: Model<ListingDocument>,
    private readonly accounts: AccountsService,
    private publishDispatcher: PlatformPublishDispatcher,
  ) {}

  findAll() {
    return this.publicationModel
      .find()
      .populate('listingId')
      .sort({ createdAt: -1 })
      .exec();
  }

  findByListing(listingId: string) {
    return this.publicationModel.find({ listingId }).exec();
  }

  async findOne(id: string) {
    const pub = await this.publicationModel.findById(id).exec();
    if (!pub) throw new NotFoundException('Publication not found');
    return pub;
  }

  /** Publications d'une annonce, avec le résumé du compte peuplé (vue détail). */
  findByListingWithAccount(listingId: string | Types.ObjectId) {
    return this.publicationModel
      .find({ listingId })
      .populate('accountId', 'platform email')
      .lean()
      .exec();
  }

  // ─── Persistance du cycle de publication (appelée par le worker publish) ────

  /**
   * Upsert la Publication en PENDING (1 par (listing, account, platform)).
   * Ne touche pas externalId/externalUrl/publishCount : ils gardent l'état du
   * dernier publish réussi tant que celui-ci n'a pas abouti.
   */
  upsertPending(p: {
    listingId: string;
    accountId: string;
    platform: Platform;
  }): Promise<PublicationDocument> {
    const listingId = new Types.ObjectId(p.listingId);
    const accountId = new Types.ObjectId(p.accountId);
    return this.publicationModel
      .findOneAndUpdate(
        { listingId, accountId, platform: p.platform },
        {
          $set: {
            listingId,
            accountId,
            platform: p.platform,
            status: PublicationStatus.PENDING,
            errorMessage: undefined,
          },
        },
        { upsert: true, new: true },
      )
      .exec() as Promise<PublicationDocument>;
  }

  /** Passe la Publication en PUBLISHED (+ externalId/Url, publishedAt, publishCount++). */
  async markPublished(
    id: string,
    result: { externalId: string; externalUrl: string },
  ): Promise<void> {
    await this.publicationModel
      .findByIdAndUpdate(id, {
        $set: {
          status: PublicationStatus.PUBLISHED,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          errorMessage: undefined,
          publishedAt: new Date(),
        },
        $inc: { publishCount: 1 },
      })
      .exec();
  }

  /** Passe la Publication en ERROR (échec final d'un job). */
  async markFailed(id: string, message: string): Promise<void> {
    await this.publicationModel
      .findByIdAndUpdate(id, {
        $set: { status: PublicationStatus.ERROR, errorMessage: message },
      })
      .exec();
  }

  /**
   * Delete a single publication : remove it on the platform side, then drop
   * the DB row on success / soft-success (already_gone). Returns the result
   * for the caller to surface to the user.
   */
  async deletePlatformAndRow(
    pub: PublicationDocument,
  ): Promise<DeletePublicationResult> {
    const account = await this.accounts.getById(pub.accountId.toString());
    if (!account) {
      return {
        status: 'failed',
        message: 'Account introuvable (déjà supprimé ?)',
      };
    }
    let result: DeletePublicationResult;
    try {
      const adapter = this.publishDispatcher.forPlatform(pub.platform);
      result = await adapter.deletePublication(account, pub);
    } catch (err) {
      this.logger.error(
        `Delete ${pub.platform} listing ${pub.externalId} : ${(err as Error).message}`,
      );
      return { status: 'failed', message: (err as Error).message };
    }
    if (result.status !== 'failed') {
      await this.publicationModel.findByIdAndDelete(pub._id).exec();
    }
    return result;
  }

  /** User-scoped single delete : verifies the publication belongs to the user. */
  async remove(userId: string, id: string) {
    const pub = await this.publicationModel.findById(id).exec();
    if (!pub) throw new NotFoundException('Publication not found');
    const listing = await this.listingModel
      .findOne({
        _id: pub.listingId,
        userId: new Types.ObjectId(userId),
      })
      .lean()
      .exec();
    if (!listing) throw new NotFoundException('Publication not found');
    const result = await this.deletePlatformAndRow(pub);
    return {
      publicationId: pub._id.toString(),
      platform: pub.platform,
      externalId: pub.externalId,
      result,
    };
  }
}

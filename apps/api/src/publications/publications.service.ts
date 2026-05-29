import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Publication,
  type PublicationDocument,
} from './schemas/publication.schema.js';
import {
  Account,
  type AccountDocument,
} from '../accounts/schemas/account.schema.js';
import {
  Listing,
  type ListingDocument,
} from '../listings/schemas/listing.schema.js';
import { PlatformPublishDispatcher } from '../publish/platform-publish.dispatcher.js';
import type { DeletePublicationResult } from '../publish/platform-publish.types.js';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectModel(Account.name)
    private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name)
    private listingModel: Model<ListingDocument>,
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

  /**
   * Delete a single publication : remove it on the platform side, then drop
   * the DB row on success / soft-success (already_gone). Returns the result
   * for the caller to surface to the user.
   */
  async deletePlatformAndRow(
    pub: PublicationDocument,
  ): Promise<DeletePublicationResult> {
    const account = await this.accountModel.findById(pub.accountId).exec();
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

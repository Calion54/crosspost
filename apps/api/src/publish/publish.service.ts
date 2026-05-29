import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PublicationStatus } from '@crosspost/shared';
import {
  Account,
  type AccountDocument,
} from '../accounts/schemas/account.schema.js';
import {
  Listing,
  type ListingDocument,
} from '../listings/schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { User, type UserDocument } from '../users/schemas/user.schema.js';
import { PlatformPublishDispatcher } from './platform-publish.dispatcher.js';
import type { PublishResult } from './platform-publish.types.js';

/**
 * Orchestrateur publish générique. Délègue à la plateforme via dispatcher,
 * persiste le résultat dans la collection `publications`.
 *
 * Étape 4 — synchrone (le client attend la réponse complète, ~10-30s).
 * Étape 5 — sera remplacé par enqueue BullMQ throttlé par compte + SSE pour les events.
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly dispatcher: PlatformPublishDispatcher,
  ) {}

  async publish(
    listingId: string,
    accountId: string,
  ): Promise<PublishResult & { publicationId: string }> {
    const account = await this.accountModel
      .findById(new Types.ObjectId(accountId))
      .exec();
    if (!account) throw new NotFoundException('Account not found');

    const listing = await this.listingModel
      .findById(new Types.ObjectId(listingId))
      .exec();
    if (!listing) throw new NotFoundException('Listing not found');

    // Récupère la location par défaut de l'user (configurée via /settings).
    // Sans elle, on ne peut pas publier — on remonte un 400 plutôt qu'un 500.
    const user = listing.userId
      ? await this.userModel.findById(listing.userId).lean().exec()
      : null;
    if (!user?.defaultLocation) {
      throw new BadRequestException(
        'Aucune location par défaut — configure-la dans /settings avant de publier',
      );
    }

    this.logger.log(
      `Publish "${listing.title}" sur ${account.platform} (${account.email})...`,
    );

    const adapter = this.dispatcher.forPlatform(account.platform);
    const result = await adapter.publish(account, listing, {
      defaultLocation: user.defaultLocation,
    });

    // Upsert la Publication (1 par (listing, account, platform)).
    // publishedAt + publishCount sont mis à jour à chaque publish réussi
    // (utile pour "bumper" une annonce en la re-publiant).
    const publication = await this.publicationModel
      .findOneAndUpdate(
        {
          listingId: listing._id,
          accountId: account._id,
          platform: account.platform,
        },
        {
          $set: {
            listingId: listing._id,
            accountId: account._id,
            platform: account.platform,
            status: PublicationStatus.PUBLISHED,
            externalId: result.externalId,
            externalUrl: result.externalUrl,
            errorMessage: undefined,
            publishedAt: new Date(),
          },
          $inc: { publishCount: 1 },
        },
        { upsert: true, new: true },
      )
      .exec();

    this.logger.log(
      `✓ Publié sur ${account.platform} → ${result.externalUrl}`,
    );

    return {
      ...result,
      publicationId: publication._id.toString(),
    };
  }
}

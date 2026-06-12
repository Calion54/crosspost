import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ListingCategory,
  ListingColor,
  ListingCondition,
  PackageSize,
  Platform,
  PublicationStatus,
} from '@crosspost/shared';
import { Listing, type ListingDocument } from './schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { ImageImporterService } from '../media/image-importer.service.js';
import { normalizeTitle } from './listing-title.util.js';

/** Champs d'un Listing propres à la plateforme (utilisés à la création). */
export interface SyncListingFields {
  description: string;
  packageSize: PackageSize;
  category?: ListingCategory | null;
  condition?: ListingCondition | null;
  color?: ListingColor | null;
}

export interface ImportSyncedListingParams {
  userId: string;
  accountId: Types.ObjectId;
  platform: Platform;
  title: string;
  price: number;
  imageUrls: string[];
  fields: SyncListingFields;
  externalId: string;
  externalUrl: string;
  status: PublicationStatus;
  publishedAt?: Date;
}

/**
 * Logique de synchronisation Listing+Publication partagée par TOUS les syncs
 * (Leboncoin, Vinted, …). Strictement identique d'une plateforme à l'autre :
 * un seul service plutôt qu'une copie par sync. Chaque sync ne fait qu'extraire
 * les champs propres à sa plateforme puis délègue ici.
 */
@Injectable()
export class ListingReuseService {
  private readonly logger = new Logger(ListingReuseService.name);

  constructor(
    @InjectModel(Listing.name)
    private readonly listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private readonly publicationModel: Model<PublicationDocument>,
    private readonly imageImporter: ImageImporterService,
  ) {}

  /**
   * Rattache une annonce synchronisée à un Listing puis crée sa Publication.
   *
   * Dédup cross-plateforme : si un Listing identique (même titre normalisé +
   * prix) existe déjà sans publication sur cette plateforme — typiquement
   * importé par l'autre plateforme — on le réutilise et on NE réimporte PAS les
   * images (on garde celles déjà présentes). Sinon on crée un nouveau Listing.
   * Marche quel que soit l'ordre de synchro (LBC→Vinted ou Vinted→LBC).
   */
  async importSyncedListing(p: ImportSyncedListingParams): Promise<void> {
    const reusable = await this.findReusableListing(
      p.userId,
      p.title,
      p.price,
      p.platform,
    );

    let listingId: Types.ObjectId;
    if (reusable) {
      listingId = reusable._id;
      this.logger.log(
        `  ↻ ${p.platform} ${p.externalId} rattachée au listing existant ${listingId.toString()} (titre+prix)`,
      );
    } else {
      const media = p.imageUrls.length
        ? await this.imageImporter.importMany(p.userId, p.imageUrls)
        : [];
      const listing = await this.listingModel.create({
        userId: new Types.ObjectId(p.userId),
        title: p.title,
        price: p.price,
        ...p.fields,
        media,
        publishedAt: p.publishedAt ?? new Date(),
      });
      listingId = listing._id;
    }

    await this.publicationModel.create({
      listingId,
      accountId: p.accountId,
      platform: p.platform,
      status: p.status,
      externalId: p.externalId,
      externalUrl: p.externalUrl,
      publishedAt: p.publishedAt,
      // Annonce déjà en ligne sur la plateforme → publiée au moins 1 fois.
      publishCount: 1,
    });

    await this.reconcileListingSold(listingId);
  }

  /**
   * Recalcule la dénormalisation `Listing.sold` depuis ses publications :
   * true dès qu'une publication est SOLD (une annonce ne se vend qu'une fois).
   * Bidirectionnel — repasse à false si plus aucune n'est vendue.
   */
  async reconcileListingSold(listingId: Types.ObjectId): Promise<void> {
    const soldCount = await this.publicationModel
      .countDocuments({ listingId, status: PublicationStatus.SOLD })
      .exec();
    await this.listingModel
      .findByIdAndUpdate(listingId, { sold: soldCount > 0 })
      .exec();
  }

  /**
   * Cherche un Listing réutilisable : même user, même prix, même titre
   * normalisé, et SANS publication existante sur `platform` (sinon ce serait un
   * doublon intra-plateforme → il faut un nouveau listing).
   */
  private async findReusableListing(
    userId: string,
    title: string,
    price: number,
    platform: Platform,
  ): Promise<ListingDocument | null> {
    const norm = normalizeTitle(title);
    // Le prix filtre fortement ; on compare le titre normalisé en mémoire.
    const candidates = await this.listingModel
      .find({ userId: new Types.ObjectId(userId), price })
      .exec();
    for (const candidate of candidates) {
      if (normalizeTitle(candidate.title) !== norm) continue;
      const hasPub = await this.publicationModel
        .exists({ listingId: candidate._id, platform })
        .exec();
      if (!hasPub) return candidate;
    }
    return null;
  }
}

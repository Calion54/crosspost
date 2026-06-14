import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type {
  CreateListingDto,
  UpdateListingDto,
} from './dto/listing.dto.js';
import {
  ListingStatusFilter,
  type ListingQueryDto,
} from '@crosspost/shared';
import { Listing, type ListingDocument } from './schemas/listing.schema.js';
import { PublicationsService } from '../publications/publications.service.js';
import { MediaService } from '../media/media.service.js';
import type { DeletePublicationResult } from '../publish/platform-publish.types.js';

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    private mediaService: MediaService,
    private publicationsService: PublicationsService,
  ) {}

  create(userId: string, dto: CreateListingDto) {
    return this.listingModel.create({
      ...dto,
      userId: new Types.ObjectId(userId),
    });
  }

  /**
   * Document Listing hydraté par id, sans scope user ni presign média.
   * Réservé aux workers (publish) qui passent le document aux steps plateforme.
   * Les endpoints front utilisent `findOne(userId, id)` (scopé + mediaUrls).
   */
  getById(id: string): Promise<ListingDocument | null> {
    return this.listingModel.findById(new Types.ObjectId(id)).exec();
  }

  /**
   * Réduit le prix de X% (remontée auto). Cumulatif sans plancher métier, mais
   * garde-fou technique à 1€ — un prix ≤ 0 ferait échouer la publication
   * marketplace. Arrondi à l'euro inférieur (pas de centimes) : garantit que le
   * prix baisse réellement à chaque cycle, sinon un petit pourcentage sur un
   * prix bas pourrait être annulé par l'arrondi supérieur. Retourne le nouveau
   * prix. Appelé une seule fois par annonce par cycle de bump (pas par
   * plateforme) pour éviter une double réduction.
   */
  async applyPriceReduction(id: string, percent: number): Promise<number> {
    const listing = await this.listingModel
      .findById(new Types.ObjectId(id))
      .select('price')
      .lean()
      .exec();
    if (!listing) throw new NotFoundException('Listing not found');
    const reduced = Math.max(1, Math.floor(listing.price * (1 - percent / 100)));
    await this.listingModel
      .findByIdAndUpdate(id, { price: reduced })
      .exec();
    return reduced;
  }

  /**
   * Single aggregation pipeline : filter + sort (createdAt or computed
   * earliest publishedAt) + paginate + populate publications (with their
   * account summary). Only the S3 presign step lives outside Mongo.
   */
  async findAll(userId: string, query: ListingQueryDto) {
    const { page, limit, q, sort, platforms, accountIds, statusFilter } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.title = { $regex: escaped, $options: 'i' };
    }

    // Post-lookup match : filters qui dépendent des publications peuplées.
    const postAnd: Record<string, unknown>[] = [];
    if (platforms?.length) {
      postAnd.push({ 'publications.platform': { $in: platforms } });
    }
    if (accountIds?.length) {
      postAnd.push({
        'publications.accountId._id': {
          $in: accountIds.map((id) => new Types.ObjectId(id)),
        },
      });
    }
    // Statut : partition vendu / actif (publié & non vendu) / non publié.
    if (statusFilter === ListingStatusFilter.SOLD) {
      match.sold = true; // dénormalisé sur le Listing → pré-lookup.
    } else if (statusFilter === ListingStatusFilter.ACTIVE) {
      match.sold = { $ne: true };
      postAnd.push({ 'publications.0': { $exists: true } }); // au moins 1 pub.
    } else if (statusFilter === ListingStatusFilter.UNPUBLISHED) {
      postAnd.push({ 'publications.0': { $exists: false } }); // aucune pub.
    }
    const postMatch = postAnd.length ? { $and: postAnd } : null;

    const dir: 1 | -1 = sort.endsWith(':asc') ? 1 : -1;

    const populatePublications = {
      $lookup: {
        from: 'publications',
        let: { listingId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$listingId', '$$listingId'] } } },
          {
            $lookup: {
              from: 'accounts',
              let: { accId: '$accountId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$accId'] } } },
                { $project: { platform: 1, email: 1 } },
              ],
              as: 'accountId',
            },
          },
          { $unwind: { path: '$accountId', preserveNullAndEmptyArrays: true } },
        ],
        as: 'publications',
      },
    };

    // Vendues en dernier (`sold` false avant true), puis date de création.
    // Tri directement sur les champs du Listing.
    const sortStage = {
      $sort: { sold: 1, publishedAt: dir, _id: dir } as Record<string, 1 | -1>,
    };

    const pipeline = [
      { $match: match },
      populatePublications,
      ...(postMatch ? [{ $match: postMatch }] : []),
      sortStage,
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.listingModel.aggregate(pipeline).exec();
    const listings = (result?.items ?? []) as Array<
      ListingDocument & { publications: unknown[] }
    >;
    const total = (result?.total?.[0]?.count as number | undefined) ?? 0;

    // S3 presign — separate concern (not Mongo).
    const allKeys = listings.flatMap((l) => (l.media || []).map((m) => m.key));
    const urlMap = await this.mediaService.getSignedUrls(allKeys);

    // `sold` est déjà sur le document Listing (dénormalisé).
    const items = listings.map((listing) => ({
      ...listing,
      mediaUrls: (listing.media || [])
        .map((m) => urlMap[m.key])
        .filter(Boolean),
    }));

    return { items, total };
  }

  async findOne(userId: string, id: string) {
    const listing = await this.listingModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .lean()
      .exec();
    if (!listing) throw new NotFoundException('Listing not found');

    const keys = (listing.media || []).map((m) => m.key);
    const [publications, urlMap] = await Promise.all([
      this.publicationsService.findByListingWithAccount(listing._id),
      this.mediaService.getSignedUrls(keys),
    ]);

    return {
      ...listing,
      mediaUrls: (listing.media || [])
        .map((m) => urlMap[m.key])
        .filter(Boolean),
      publications,
    };
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    const filter = {
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    };
    const existing = await this.listingModel.findOne(filter).lean().exec();
    if (!existing) throw new NotFoundException('Listing not found');

    const listing = await this.listingModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    // Delete orphaned media from S3
    if (dto.media) {
      const newKeys = new Set(dto.media.map((m) => m.key));
      const removed = (existing.media || []).filter((m) => !newKeys.has(m.key));
      await Promise.all(
        removed.map((m) => this.mediaService.deleteByKey(m.key)),
      );
    }

    return listing!;
  }

  /**
   * Cascade delete : remove every publication from its platform, drop S3
   * media, then remove the listing row. If a platform delete fails, the
   * listing is NOT dropped so the user can retry without losing track of
   * the orphaned publication.
   */
  async remove(userId: string, id: string) {
    const listing = await this.listingModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .lean()
      .exec();
    if (!listing) throw new NotFoundException('Listing not found');

    const publications = await this.publicationsService.findByListing(
      listing._id.toString(),
    );

    const results: Array<{
      platform: string;
      externalId?: string;
      result: DeletePublicationResult;
    }> = [];
    let anyFailed = false;

    for (const pub of publications) {
      const result = await this.publicationsService.deletePlatformAndRow(pub);
      if (result.status === 'failed') anyFailed = true;
      results.push({
        platform: pub.platform,
        externalId: pub.externalId,
        result,
      });
    }

    if (!anyFailed) {
      await Promise.all(
        (listing.media || []).map((m) => this.mediaService.deleteByKey(m.key)),
      );
      await this.listingModel.findByIdAndDelete(listing._id).exec();
    }

    return {
      listingId: listing._id.toString(),
      deleted: !anyFailed,
      results,
    };
  }
}

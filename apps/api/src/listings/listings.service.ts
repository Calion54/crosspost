import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type {
  CreateListingDto,
  UpdateListingDto,
} from './dto/listing.dto.js';
import {
  PublicationStatus,
  type ListingQueryDto,
} from '@crosspost/shared';
import { Listing, type ListingDocument } from './schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { PublicationsService } from '../publications/publications.service.js';
import { MediaService } from '../media/media.service.js';
import type { DeletePublicationResult } from '../publish/platform-publish.types.js';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
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
   * Single aggregation pipeline : filter + sort (createdAt or computed
   * earliest publishedAt) + paginate + populate publications (with their
   * account summary). Only the S3 presign step lives outside Mongo.
   */
  async findAll(userId: string, query: ListingQueryDto) {
    const { page, limit, q, sort, platforms, accountIds, unpublishedOnly } =
      query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.title = { $regex: escaped, $options: 'i' };
    }

    // Post-lookup match : filters that need the populated publications.
    const postMatch: Record<string, unknown> = {};
    if (platforms?.length) {
      postMatch['publications.platform'] = { $in: platforms };
    }
    if (accountIds?.length) {
      postMatch['publications.accountId._id'] = {
        $in: accountIds.map((id) => new Types.ObjectId(id)),
      };
    }
    if (unpublishedOnly) {
      // No publication has reached PUBLISHED status (also matches listings
      // with empty publications array).
      postMatch['publications.status'] = {
        $nin: [PublicationStatus.PUBLISHED],
      };
    }

    const byPublishedAt = sort.startsWith('publishedAt:');
    const dir: 1 | -1 = sort.endsWith(':asc') ? 1 : -1;
    const sentinel = dir === 1 ? new Date('9999-12-31') : new Date(0);

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

    const sortSpec: Record<string, 1 | -1> = byPublishedAt
      ? { _publishedAt: dir, _id: 1 }
      : { createdAt: dir, _id: 1 };
    const sortStage = { $sort: sortSpec };

    const addPublishedAt = {
      $addFields: {
        _publishedAt: {
          $ifNull: [
            {
              $min: {
                $map: {
                  input: {
                    $filter: {
                      input: '$publications',
                      as: 'p',
                      cond: {
                        $eq: ['$$p.status', PublicationStatus.PUBLISHED],
                      },
                    },
                  },
                  as: 'pub',
                  in: '$$pub.publishedAt',
                },
              },
            },
            sentinel,
          ],
        },
      },
    };

    const pipeline = [
      { $match: match },
      populatePublications,
      ...(Object.keys(postMatch).length ? [{ $match: postMatch }] : []),
      ...(byPublishedAt ? [addPublishedAt] : []),
      sortStage,
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            ...(byPublishedAt ? [{ $project: { _publishedAt: 0 } }] : []),
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.listingModel.aggregate(pipeline).exec();
    const listings = (result?.items ?? []) as Array<
      ListingDocument & { publications: unknown[] }
    >;
    const total =
      (result?.total?.[0]?.count as number | undefined) ?? 0;

    // S3 presign — separate concern (not Mongo).
    const allKeys = listings.flatMap((l) => (l.media || []).map((m) => m.key));
    const urlMap = await this.mediaService.getSignedUrls(allKeys);

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
      this.publicationModel
        .find({ listingId: listing._id })
        .populate('accountId', 'platform email')
        .lean()
        .exec(),
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

    const publications = await this.publicationModel
      .find({ listingId: listing._id })
      .exec();

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

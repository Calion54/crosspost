import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreateListingDto, UpdateListingDto } from './dto/listing.dto.js';
import { Listing, type ListingDocument } from './schemas/listing.schema.js';
import {
  Publication,
  type PublicationDocument,
} from '../publications/schemas/publication.schema.js';
import { MediaService } from '../media/media.service.js';

@Injectable()
export class ListingsService {
  constructor(
    @InjectModel(Listing.name) private listingModel: Model<ListingDocument>,
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
    private mediaService: MediaService,
  ) {}

  create(userId: string, dto: CreateListingDto) {
    return this.listingModel.create({ ...dto, userId });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const filter = { userId };

    const [listings, total] = await Promise.all([
      this.listingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.listingModel.countDocuments(filter).exec(),
    ]);

    const listingIds = listings.map((l) => l._id);
    const publications = await this.publicationModel
      .find({ listingId: { $in: listingIds } })
      .populate('accountId', 'platform username')
      .lean()
      .exec();

    const allKeys = listings.flatMap((l) => (l.media || []).map((m) => m.key));
    const urlMap = await this.mediaService.getSignedUrls(allKeys);

    const items = listings.map((listing) => ({
      ...listing,
      mediaUrls: (listing.media || []).map((m) => urlMap[m.key]).filter(Boolean),
      publications: publications.filter(
        (p) => p.listingId.toString() === listing._id.toString(),
      ),
    }));

    return { items, total };
  }

  async findOne(userId: string, id: string) {
    const listing = await this.listingModel.findOne({ _id: id, userId }).lean().exec();
    if (!listing) throw new NotFoundException('Listing not found');

    const keys = (listing.media || []).map((m) => m.key);
    const [publications, urlMap] = await Promise.all([
      this.publicationModel
        .find({ listingId: listing._id })
        .populate('accountId', 'platform username')
        .lean()
        .exec(),
      this.mediaService.getSignedUrls(keys),
    ]);

    return {
      ...listing,
      mediaUrls: (listing.media || []).map((m) => urlMap[m.key]).filter(Boolean),
      publications,
    };
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    const existing = await this.listingModel.findOne({ _id: id, userId }).lean().exec();
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

  async remove(userId: string, id: string) {
    const listing = await this.listingModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!listing) throw new NotFoundException('Listing not found');
    await this.publicationModel.deleteMany({ listingId: listing._id }).exec();
    // Clean up S3
    await Promise.all(
      (listing.media || []).map((m) => this.mediaService.deleteByKey(m.key)),
    );
    return listing;
  }
}

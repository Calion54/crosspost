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

  create(dto: CreateListingDto) {
    return this.listingModel.create(dto);
  }

  async findAll() {
    const listings = await this.listingModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const listingIds = listings.map((l) => l._id);
    const publications = await this.publicationModel
      .find({ listingId: { $in: listingIds } })
      .populate('accountId', 'platform username')
      .lean()
      .exec();

    // Resolve all media keys to signed URLs in one batch
    const allKeys = listings.flatMap((l) => (l.media || []).map((m) => m.key));
    const urlMap = await this.mediaService.getSignedUrls(allKeys);

    return listings.map((listing) => ({
      ...listing,
      mediaUrls: (listing.media || []).map((m) => urlMap[m.key]).filter(Boolean),
      publications: publications.filter(
        (p) => p.listingId.toString() === listing._id.toString(),
      ),
    }));
  }

  async findOne(id: string) {
    const listing = await this.listingModel.findById(id).lean().exec();
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

  async update(id: string, dto: UpdateListingDto) {
    const existing = await this.listingModel.findById(id).lean().exec();
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

  async remove(id: string) {
    const listing = await this.listingModel.findByIdAndDelete(id).exec();
    if (!listing) throw new NotFoundException('Listing not found');
    await this.publicationModel.deleteMany({ listingId: listing._id }).exec();
    // Clean up S3
    await Promise.all(
      (listing.media || []).map((m) => this.mediaService.deleteByKey(m.key)),
    );
    return listing;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Publication,
  type PublicationDocument,
} from './schemas/publication.schema.js';

@Injectable()
export class PublicationsService {
  constructor(
    @InjectModel(Publication.name)
    private publicationModel: Model<PublicationDocument>,
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
}

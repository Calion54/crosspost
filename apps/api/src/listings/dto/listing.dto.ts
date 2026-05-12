import { createZodDto } from 'nestjs-zod';
import {
  createListingSchema,
  updateListingSchema,
  autoFillSchema,
  listingQuerySchema,
} from '@crosspost/shared';

export class CreateListingDto extends createZodDto(createListingSchema) {}
export class UpdateListingDto extends createZodDto(updateListingSchema) {}
export class AutoFillDto extends createZodDto(autoFillSchema) {}
export class ListingQueryDto extends createZodDto(listingQuerySchema) {}

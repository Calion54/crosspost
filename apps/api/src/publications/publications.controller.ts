import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { PublicationsService } from './publications.service.js';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

@Controller('publications')
export class PublicationsController {
  constructor(private readonly publicationsService: PublicationsService) {}

  @Get()
  findAll(@Query('listingId') listingId?: string) {
    if (listingId) {
      return this.publicationsService.findByListing(listingId);
    }
    return this.publicationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.publicationsService.findOne(id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.publicationsService.remove(user.userId, id);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ListingsService } from './listings.service.js';
import { AutoFillService } from './auto-fill.service.js';
import {
  CreateListingDto,
  UpdateListingDto,
  AutoFillDto,
  ListingQueryDto,
} from './dto/listing.dto.js';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator.js';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly autoFillService: AutoFillService,
  ) {}

  @Post('auto-fill')
  autoFill(@Body() dto: AutoFillDto) {
    return this.autoFillService.autoFill(dto);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.listingsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListingQueryDto) {
    return this.listingsService.findAll(user.userId, query.page, query.limit);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.listingsService.findOne(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.listingsService.remove(user.userId, id);
  }
}

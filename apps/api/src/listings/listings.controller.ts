import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { ListingsService } from './listings.service.js';
import { AutoFillService } from './auto-fill.service.js';
import {
  CreateListingDto,
  UpdateListingDto,
  AutoFillDto,
} from './dto/listing.dto.js';

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
  create(@Body() dto: CreateListingDto) {
    return this.listingsService.create(dto);
  }

  @Get()
  findAll() {
    return this.listingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.listingsService.remove(id);
  }
}

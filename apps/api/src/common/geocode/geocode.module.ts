import { Module } from '@nestjs/common';
import { HttpModule } from '../http/http.module.js';
import { GeocodeService } from './geocode.service.js';

@Module({
  imports: [HttpModule],
  providers: [GeocodeService],
  exports: [GeocodeService],
})
export class GeocodeModule {}

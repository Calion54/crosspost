import { Module } from '@nestjs/common';
import { HttpService } from './http.service.js';

@Module({
  providers: [HttpService],
  exports: [HttpService],
})
export class HttpModule {}

import { Global, Module } from '@nestjs/common';
import { VncSessionService } from './vnc-session.service.js';

@Global()
@Module({
  providers: [VncSessionService],
  exports: [VncSessionService],
})
export class VncModule {}

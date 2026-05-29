import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '@crosspost/shared';
import { LeboncoinPublishService } from '../leboncoin/publish/leboncoin-publish.service.js';
import { VintedPublishService } from '../vinted/publish/vinted-publish.service.js';
import type { PlatformPublishAdapter } from './platform-publish.types.js';

/** Aiguillage Platform → service publish. */
@Injectable()
export class PlatformPublishDispatcher {
  constructor(
    private readonly leboncoin: LeboncoinPublishService,
    private readonly vinted: VintedPublishService,
  ) {}

  forPlatform(platform: Platform): PlatformPublishAdapter {
    switch (platform) {
      case Platform.LEBONCOIN:
        return this.leboncoin;
      case Platform.VINTED:
        return this.vinted;
      default:
        throw new BadRequestException(`Platform "${platform}" inconnue`);
    }
  }
}

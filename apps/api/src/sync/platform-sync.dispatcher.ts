import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '@crosspost/shared';
import { LeboncoinSyncService } from '../leboncoin/sync/leboncoin-sync.service.js';
import { VintedSyncService } from '../vinted/sync/vinted-sync.service.js';
import type { PlatformSyncAdapter } from './platform-sync.types.js';

/**
 * Aiguillage Platform → service de sync. Quand on ajoute Vinted :
 *   1. Injecter VintedSyncService dans le constructeur
 *   2. Ajouter un case dans le switch
 */
@Injectable()
export class PlatformSyncDispatcher {
  constructor(
    private readonly leboncoin: LeboncoinSyncService,
    private readonly vinted: VintedSyncService,
  ) {}

  forPlatform(platform: Platform): PlatformSyncAdapter {
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

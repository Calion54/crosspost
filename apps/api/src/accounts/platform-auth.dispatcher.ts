import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '@crosspost/shared';
import { LeboncoinAuthService } from '../leboncoin/auth/leboncoin-auth.service.js';
import { VintedAuthService } from '../vinted/auth/vinted-auth.service.js';
import type { PlatformAuthAdapter } from './platform-auth.types.js';

/**
 * Aiguillage Platform → service d'auth. Quand on ajoute Vinted :
 *   1. Injecter VintedAuthService dans le constructeur
 *   2. Ajouter un case dans le switch
 * Aucun autre endroit du code à modifier.
 */
@Injectable()
export class PlatformAuthDispatcher {
  constructor(
    private readonly leboncoin: LeboncoinAuthService,
    private readonly vinted: VintedAuthService,
  ) {}

  forPlatform(platform: Platform): PlatformAuthAdapter {
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

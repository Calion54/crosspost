import { Module } from '@nestjs/common';
import { LeboncoinModule } from '../leboncoin/leboncoin.module.js';
import { VintedModule } from '../vinted/vinted.module.js';
import { PlatformPublishDispatcher } from './platform-publish.dispatcher.js';

/**
 * Module dédié au dispatcher de publication par plateforme.
 *
 * Extrait de `PublishModule` pour casser le cycle : `PublicationsService`
 * (suppression d'annonce) a besoin du dispatcher, mais `PublishModule` a besoin
 * de `PublicationsService` (persistance). Les deux importent désormais ce module
 * neutre — qui ne dépend que des modules plateformes — au lieu de se référencer
 * mutuellement.
 */
@Module({
  imports: [LeboncoinModule, VintedModule],
  providers: [PlatformPublishDispatcher],
  exports: [PlatformPublishDispatcher],
})
export class PlatformPublishModule {}

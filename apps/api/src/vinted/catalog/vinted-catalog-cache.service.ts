import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { HttpService } from '../../common/http/http.service.js';
import {
  VINTED_CATALOGS_URL,
  VINTED_DEFAULT_USER_AGENT,
  VINTED_NEW_ITEM_PAGE,
  VINTED_WEB_HOST,
} from '../vinted-platform.config.js';
import {
  VintedCatalogsResponseSchema,
  type VintedCatalogNode,
  type VintedCatalogsResponse,
} from './vinted-catalog.schemas.js';

/**
 * Cache du catalogue Vinted (arbre récursif des catégories).
 *
 * - Préchargé en async au démarrage (onModuleInit fire-and-forget) — ne bloque
 *   pas le boot du serveur. Si le préchargement échoue, on retombe sur un fetch
 *   à la demande au 1er `getCatalog()`.
 * - TTL : 24h. Le catalogue Vinted change rarement (quelques évolutions par mois).
 * - Pas d'auth user-specific : c'est l'ontologie publique Vinted.
 * - `inflight` : dedup des appels concurrents pour éviter un thundering herd
 *   si plusieurs publishes démarrent simultanément après expiration du TTL.
 */
@Injectable()
export class VintedCatalogCache implements OnModuleInit {
  private readonly logger = new Logger(VintedCatalogCache.name);
  private static readonly TTL_MS = 24 * 60 * 60 * 1000;

  private catalog: VintedCatalogNode[] | null = null;
  private fetchedAt = 0;
  private inflight: Promise<VintedCatalogNode[]> | null = null;

  constructor(private readonly http: HttpService) {}

  onModuleInit(): void {
    // Fire-and-forget : le serveur démarre sans attendre le catalogue.
    this.refresh().catch((err) => {
      this.logger.warn(
        `Préchargement catalogue échoué (fallback lazy au 1er publish) : ${(err as Error).message}`,
      );
    });
  }

  /**
   * Retourne le catalogue (cache ou refresh selon TTL). Throw si le fetch
   * échoue et qu'on n'a pas de cache valide.
   */
  async getCatalog(): Promise<VintedCatalogNode[]> {
    const fresh =
      this.catalog &&
      Date.now() - this.fetchedAt < VintedCatalogCache.TTL_MS;
    if (fresh) return this.catalog!;
    return this.refresh();
  }

  private async refresh(): Promise<VintedCatalogNode[]> {
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const res = await this.http.request<VintedCatalogsResponse>({
          method: 'GET',
          url: VINTED_CATALOGS_URL,
          label: 'vinted:catalog:fetch',
          responseSchema: VintedCatalogsResponseSchema,
          headers: {
            Accept: 'application/json,text/plain,*/*,image/webp',
            'Accept-Language': 'fr',
            'User-Agent': VINTED_DEFAULT_USER_AGENT,
            locale: 'fr-FR',
            'mda-catalog': 'true',
            Origin: VINTED_WEB_HOST,
            Referer: VINTED_NEW_ITEM_PAGE,
          },
        });

        if (res.status < 200 || res.status >= 300) {
          throw new Error(
            `Catalogue Vinted HTTP ${res.status} — peut-être besoin d'auth ?`,
          );
        }

        this.catalog = res.data.catalogs;
        this.fetchedAt = Date.now();
        this.logger.log(
          `Catalogue Vinted chargé : ${this.catalog.length} catégories racines`,
        );
        return this.catalog;
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }
}

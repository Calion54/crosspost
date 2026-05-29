import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MediaService } from './media.service.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 Mo — guard contre les abuses
const PARALLEL_DOWNLOAD_LIMIT = 5; // par sync — soulage le CDN distant

/**
 * Télécharge une image depuis une URL distante puis la pousse dans notre S3.
 * Utilisé par le sync (LBC, Vinted, …) pour réinjecter les médias des annonces.
 */
@Injectable()
export class ImageImporterService {
  private readonly logger = new Logger(ImageImporterService.name);

  constructor(private readonly media: MediaService) {}

  /**
   * Télécharge + upload une image. Retourne `null` si la download/upload échoue
   * (best-effort — une image cassée ne doit pas faire échouer tout le sync).
   */
  async importFromUrl(
    userId: string,
    url: string,
  ): Promise<{ key: string; contentType: string } | null> {
    try {
      const res = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        maxContentLength: MAX_IMAGE_BYTES,
        validateStatus: () => true,
      });
      if (res.status !== 200) {
        this.logger.warn(
          `Image download ${url} → HTTP ${res.status}, skip`,
        );
        return null;
      }
      const contentType =
        (res.headers['content-type'] as string | undefined) ?? 'image/jpeg';
      const data = Buffer.from(res.data);
      return await this.media.uploadBinary(userId, data, contentType);
    } catch (err) {
      this.logger.warn(
        `Échec import image ${url}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Importe plusieurs URLs en parallèle (limité à PARALLEL_DOWNLOAD_LIMIT).
   * Retourne uniquement les imports réussis (ordre préservé).
   */
  async importMany(
    userId: string,
    urls: string[],
  ): Promise<Array<{ key: string; contentType: string }>> {
    const results: Array<{ key: string; contentType: string } | null> = [];
    for (let i = 0; i < urls.length; i += PARALLEL_DOWNLOAD_LIMIT) {
      const batch = urls.slice(i, i + PARALLEL_DOWNLOAD_LIMIT);
      const batchResults = await Promise.all(
        batch.map((url) => this.importFromUrl(userId, url)),
      );
      results.push(...batchResults);
    }
    return results.filter(
      (r): r is { key: string; contentType: string } => r !== null,
    );
  }
}

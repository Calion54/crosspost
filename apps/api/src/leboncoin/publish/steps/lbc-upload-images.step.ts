import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { LeboncoinHttpClient } from '../../http/leboncoin-http.client.js';
import {
  LBC_DEPOSIT_PAGE,
  LBC_INTERNAL_API_KEY,
  LBC_UPLOAD_IMAGE_URL,
} from '../../leboncoin-platform.config.js';
import { MediaService } from '../../../media/media.service.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { LbcPublishContext } from '../leboncoin-publish.context.js';
import {
  LbcUploadImageResponseSchema,
  type LbcUploadImageResponse,
} from '../leboncoin-publish.schemas.js';

/**
 * Step 2 — Upload chaque image du listing vers LBC.
 *
 * Pour chaque image :
 *  1. Download depuis notre S3 (via signed URL)
 *  2. POST multipart/form-data vers `/api/pintad/v1/public/upload/image`
 *  3. Collecter `{filename, url}` retournés par LBC
 *
 * Sequentiel pour l'instant (parallèle = risque de 429/DataDome). Les
 * références collectées sont stockées dans `ctx.uploadedImages` dans l'ordre
 * des images du listing (l'ordre compte côté LBC pour l'image principale).
 */
@Injectable()
export class LbcUploadImagesStep implements PublishStep<LbcPublishContext> {
  readonly name = 'upload-images';

  private readonly logger = new Logger(LbcUploadImagesStep.name);

  constructor(
    private readonly client: LeboncoinHttpClient,
    private readonly media: MediaService,
  ) {}

  async execute(ctx: LbcPublishContext): Promise<void> {
    const mediaList = ctx.listing.media ?? [];
    if (mediaList.length === 0) {
      throw new Error(
        'Listing sans image — au moins une image est requise pour publier sur LBC',
      );
    }

    const uploaded: Array<{ filename: string; url: string }> = [];

    for (const [index, m] of mediaList.entries()) {
      this.logger.log(
        `Upload image ${index + 1}/${mediaList.length} (${m.key})...`,
      );

      // 1. Download depuis S3
      const signedUrl = await this.media.getSignedUrl(m.key);
      const dl = await axios.get<ArrayBuffer>(signedUrl, {
        responseType: 'arraybuffer',
        timeout: 30_000,
      });
      const buffer = Buffer.from(dl.data);

      // 2. Build multipart/form-data
      const filename = m.key.split('/').pop() ?? `image-${index}.jpg`;
      const form = new FormData();
      form.append('file', buffer, {
        filename,
        contentType: m.contentType,
      });

      // 3. POST vers LBC
      const res = await this.client.request<LbcUploadImageResponse>(
        ctx.account,
        {
          method: 'POST',
          url: LBC_UPLOAD_IMAGE_URL,
          data: form,
          label: `lbc:publish:upload-image[${index}]`,
          responseSchema: LbcUploadImageResponseSchema,
          headers: {
            ...form.getHeaders(), // Content-Type: multipart/form-data; boundary=...
            api_key: LBC_INTERNAL_API_KEY,
            Referer: LBC_DEPOSIT_PAGE,
          },
        },
      );

      uploaded.push({
        filename: res.data.filename,
        url: res.data.url,
      });
    }

    ctx.uploadedImages = uploaded;
    this.logger.log(`${uploaded.length} image(s) uploadée(s) vers LBC ✓`);
  }
}

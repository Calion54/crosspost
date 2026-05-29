import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import axios from 'axios';
import FormData from 'form-data';
import { VintedHttpClient } from '../../http/vinted-http.client.js';
import {
  VINTED_NEW_ITEM_PAGE,
  VINTED_PHOTOS_URL,
  VINTED_WEB_HOST,
} from '../../vinted-platform.config.js';
import { MediaService } from '../../../media/media.service.js';
import type { PublishStep } from '../../../publish/publish-step.interface.js';
import type { VintedPublishContext } from '../vinted-publish.context.js';
import {
  VintedUploadPhotoResponseSchema,
  type VintedUploadPhotoResponse,
} from '../vinted-publish.schemas.js';

/**
 * Step 1 — Upload chaque image du listing vers Vinted.
 *
 * Pour chaque image :
 *  1. Download depuis notre S3 (signed URL)
 *  2. POST multipart vers `/api/v2/photos` avec
 *       photo[type]=item, photo[file]=<bytes>, photo[temp_uuid]=<uuid>
 *  3. Collecter `{id, temp_uuid, url}` retournés par Vinted
 *
 * Séquentiel pour éviter 429/DataDome. L'ordre est conservé — Vinted utilise
 * la première photo comme image principale.
 */
@Injectable()
export class VintedUploadPhotosStep
  implements PublishStep<VintedPublishContext>
{
  readonly name = 'upload-photos';

  private readonly logger = new Logger(VintedUploadPhotosStep.name);

  constructor(
    private readonly client: VintedHttpClient,
    private readonly media: MediaService,
  ) {}

  async execute(ctx: VintedPublishContext): Promise<void> {
    const mediaList = ctx.listing.media ?? [];
    if (mediaList.length === 0) {
      throw new Error(
        'Listing sans image — au moins une image est requise pour publier sur Vinted',
      );
    }

    const uploaded: Array<{ id: number; tempUuid: string; url: string }> = [];

    for (const [index, m] of mediaList.entries()) {
      this.logger.log(
        `Upload photo ${index + 1}/${mediaList.length} (${m.key})...`,
      );

      // 1. Download depuis S3
      const signedUrl = await this.media.getSignedUrl(m.key);
      const dl = await axios.get<ArrayBuffer>(signedUrl, {
        responseType: 'arraybuffer',
        timeout: 30_000,
      });
      const buffer = Buffer.from(dl.data);

      // 2. Build multipart
      const filename = m.key.split('/').pop() ?? `image-${index}.jpg`;
      const tempUuid = randomUUID();
      const form = new FormData();
      form.append('photo[type]', 'item');
      form.append('photo[file]', buffer, {
        filename,
        contentType: m.contentType,
      });
      form.append('photo[temp_uuid]', tempUuid);

      // 3. POST vers Vinted
      const res = await this.client.request<VintedUploadPhotoResponse>(
        ctx.account,
        {
          method: 'POST',
          url: VINTED_PHOTOS_URL,
          data: form,
          label: `vinted:publish:upload-photo[${index}]`,
          responseSchema: VintedUploadPhotoResponseSchema,
          headers: {
            ...form.getHeaders(),
            Accept: 'application/json,text/plain,*/*,image/webp',
            locale: 'fr-FR',
            Origin: VINTED_WEB_HOST,
            Referer: VINTED_NEW_ITEM_PAGE,
          },
        },
      );

      if (res.status < 200 || res.status >= 300) {
        throw new Error(
          `Upload photo Vinted HTTP ${res.status} — body: ${JSON.stringify(res.data)?.slice(0, 300)}`,
        );
      }

      uploaded.push({
        id: res.data.id,
        tempUuid: res.data.temp_uuid,
        url: res.data.url,
      });
    }

    ctx.uploadedPhotos = uploaded;
    this.logger.log(`${uploaded.length} photo(s) uploadée(s) vers Vinted ✓`);
  }
}

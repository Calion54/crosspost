import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_SIZE_BYTES = 9 * 1024 * 1024; // 9 Mo

export interface PresignedUpload {
  key: string;
  contentType: string;
  uploadUrl: string;
  fields: Record<string, string>;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'eu-west-3');
    this.bucket = this.configService.get<string>(
      'AWS_S3_BUCKET',
      'crosspost-media',
    );

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          '',
        ),
      },
    });
  }

  async createPresignedUpload(
    userId: string,
    filename: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    const ext = filename.split('.').pop() || 'jpg';
    const mediaId = crypto.randomUUID();
    const key = `${userId}/listings/${mediaId}.${ext}`;

    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Expires: 300, // 5 minutes
      Conditions: [
        ['content-length-range', 0, MAX_SIZE_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
    });

    this.logger.debug(`Presigned POST created: ${key}`);

    return { key, contentType, uploadUrl: url, fields };
  }

  async deleteByKey(key: string) {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.debug(`Deleted media: ${key}`);
    } catch {
      this.logger.warn(`Failed to delete media: ${key}`);
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  async getSignedUrls(keys: string[]): Promise<Record<string, string>> {
    if (!keys.length) return {};
    const entries = await Promise.all(
      keys.map(async (key) => [key, await this.getSignedUrl(key)] as const),
    );
    return Object.fromEntries(entries);
  }
}

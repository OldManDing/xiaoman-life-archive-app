import { Injectable } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getStorageProviderName } from '../env-config';

@Injectable()
export class StorageService {
  private readonly provider = getStorageProviderName();
  private readonly bucket = process.env.STORAGE_BUCKET ?? 'xiaoman-archive-local';
  private readonly endpoint = process.env.STORAGE_ENDPOINT;
  private readonly expiresIn = Number(process.env.STORAGE_SIGNED_URL_EXPIRES_IN ?? 600);

  private readonly s3Client = this.createS3Client();

  private createS3Client() {
    if (!this.isS3CompatibleProvider()) {
      return null;
    }

    return new S3Client({
      region: process.env.STORAGE_REGION ?? 'auto',
      ...(this.endpoint ? { endpoint: this.endpoint } : {}),
      forcePathStyle: String(process.env.STORAGE_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
      credentials:
        process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY
          ? {
              accessKeyId: process.env.STORAGE_ACCESS_KEY,
              secretAccessKey: process.env.STORAGE_SECRET_KEY,
            }
          : undefined,
    });
  }

  private isS3CompatibleProvider() {
    return ['minio', 's3', 'oss', 'cos', 'r2'].includes(this.provider);
  }

  getProviderName() {
    return this.provider;
  }

  async createUploadToken(objectKey: string, mimeType: string) {
    const expireAt = new Date(Date.now() + this.expiresIn * 1000).toISOString();

    if (this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.expiresIn,
      });

      return {
        upload_url: uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        expires_in: this.expiresIn,
        expire_at: expireAt,
      };
    }

    return {
      upload_url: `${this.endpoint ?? 'http://localhost:9000'}/${this.bucket}/${objectKey}?mock_upload_token=1`,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      mock_upload: true,
      expires_in: this.expiresIn,
      expire_at: expireAt,
    };
  }

  async createAccessUrl(objectKey: string) {
    if (this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });

      const accessUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.expiresIn,
      });

      return {
        access_url: accessUrl,
        expires_in: this.expiresIn,
        expire_at: new Date(Date.now() + this.expiresIn * 1000).toISOString(),
      };
    }

    return {
      access_url: this.createMockImageDataUrl(objectKey),
      expires_in: this.expiresIn,
      expire_at: new Date(Date.now() + this.expiresIn * 1000).toISOString(),
    };
  }

  async objectExists(objectKey: string) {
    if (!this.s3Client) return true;

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return true;
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      const errorName = (error as { name?: string })?.name;
      if (statusCode === 404 || errorName === 'NotFound' || errorName === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  private createMockImageDataUrl(_objectKey: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7efe4"/>
          <stop offset="0.52" stop-color="#eaf4ef"/>
          <stop offset="1" stop-color="#e9eef8"/>
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f8c66c"/>
          <stop offset="1" stop-color="#e58f5c"/>
        </linearGradient>
      </defs>
      <rect width="960" height="720" fill="url(#bg)"/>
      <circle cx="736" cy="168" r="72" fill="url(#sun)" opacity="0.86"/>
      <path d="M0 540 C180 430 300 520 460 430 C610 348 760 394 960 292 L960 720 L0 720 Z" fill="#d9e9dd"/>
      <path d="M0 600 C190 520 330 610 520 505 C650 432 800 472 960 392 L960 720 L0 720 Z" fill="#b9d6c2"/>
      <rect x="166" y="244" width="278" height="286" rx="56" fill="#ffffff" opacity="0.68"/>
      <circle cx="306" cy="340" r="72" fill="#f0c7a7"/>
      <path d="M214 478 C242 410 370 410 398 478" fill="#c9a38d"/>
      <rect x="500" y="322" width="256" height="160" rx="42" fill="#ffffff" opacity="0.56"/>
      <path d="M552 438 L610 382 L656 428 L696 394 L730 438 Z" fill="#8bb99c"/>
    </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
}

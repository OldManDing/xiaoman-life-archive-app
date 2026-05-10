import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getStorageProviderName } from '../env-config';

@Injectable()
export class StorageService {
  private readonly provider = getStorageProviderName();
  private readonly bucket = process.env.STORAGE_BUCKET ?? 'xiaoman-archive-local';
  private readonly publicBaseUrl =
    process.env.STORAGE_PUBLIC_BASE_URL ?? 'http://localhost:9000/xiaoman-archive-local';
  private readonly endpoint = process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000';
  private readonly expiresIn = Number(process.env.STORAGE_SIGNED_URL_EXPIRES_IN ?? 600);

  private readonly s3Client = this.createS3Client();

  private createS3Client() {
    if (!this.isS3CompatibleProvider()) {
      return null;
    }

    return new S3Client({
      region: process.env.STORAGE_REGION ?? 'auto',
      endpoint: this.endpoint,
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
      upload_url: `${this.endpoint}/${this.bucket}/${objectKey}?mock_upload_token=1`,
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
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
      access_url: `${this.publicBaseUrl}/${objectKey}?mock_signed=1`,
      expires_in: this.expiresIn,
      expire_at: new Date(Date.now() + this.expiresIn * 1000).toISOString(),
    };
  }
}

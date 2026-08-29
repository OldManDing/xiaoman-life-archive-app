import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { FamilyMemberRole, MediaType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MEDIA_STATUS_FAILED, MEDIA_STATUS_READY, MEDIA_STATUS_UPLOADING } from '../../shared/constants';
import { getStorageProviderName, getMediaUploadSessionTtlSeconds, getStorageBucket, getUploadImageMaxBytes, getUploadVideoMaxBytes, getUploadAudioMaxBytes } from '../../shared/env-config';
import { AccessControlService } from '../../shared/services/access-control.service';
import { StorageService } from '../../shared/services/storage.service';
import { extFromMime, generateBizNo } from '../../shared/utils';
import { ConfirmMediaDto } from './dto/confirm-media.dto';
import { CreateUploadTokenDto } from './dto/create-upload-token.dto';
import { ensureMediaDurationLimit } from './media-policy';

const normalizeMimeType = (mimeType: string) => mimeType.toLowerCase().split(';', 1)[0].trim();
const GENERIC_UPLOAD_MIME_TYPES = new Set(['application/octet-stream', 'binary/octet-stream']);
const FALLBACK_UPLOAD_MIME_TYPE_BY_WILDCARD: Record<string, string> = {
  'image/*': 'image/jpeg',
  'video/*': 'video/mp4',
  'audio/*': 'audio/mpeg',
};
const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  m4a: 'audio/x-m4a',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  amr: 'audio/amr',
};

const inferMimeTypeFromFileName = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase().split(/[?#]/, 1)[0];
  const match = /\.([a-z0-9]+)$/.exec(normalized);
  if (!match) return null;
  return MIME_TYPE_BY_EXTENSION[match[1]] ?? null;
};

const resolveUploadMimeType = (dto: Pick<CreateUploadTokenDto, 'file_name' | 'mime_type'>) => {
  const mimeType = normalizeMimeType(dto.mime_type || '');
  const inferredMimeType = inferMimeTypeFromFileName(dto.file_name);
  if (!mimeType || GENERIC_UPLOAD_MIME_TYPES.has(mimeType)) return inferredMimeType ?? mimeType;
  if (mimeType.endsWith('/*')) return inferredMimeType ?? FALLBACK_UPLOAD_MIME_TYPE_BY_WILDCARD[mimeType] ?? mimeType;
  return mimeType;
};

const isCompatibleStoredContentType = (expected: string | null | undefined, actual: string | null) => {
  if (!expected || !actual) return true;
  return normalizeMimeType(expected) === normalizeMimeType(actual);
};

const uploadSessionTtlSeconds = () => getMediaUploadSessionTtlSeconds();

const sanitizeOriginalName = (fileName: string) => {
  const normalized = fileName.replace(/[\\/\0\r\n\t]/g, '_').trim();
  return normalized.slice(0, 255) || 'upload';
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly storageService: StorageService,
  ) {}

  async createUploadToken(userId: bigint, dto: CreateUploadTokenDto) {
    const uploadPolicy = this.getUploadPolicy(dto.media_type);
    const mimeType = resolveUploadMimeType(dto);

    if (!uploadPolicy.mimeTypes.includes(mimeType)) {
      throw new BadRequestException(`${uploadPolicy.label}格式不支持`);
    }

    if (dto.size_bytes > uploadPolicy.maxBytes) {
      throw new BadRequestException(`${uploadPolicy.label}大小超过限制`);
    }

    const { child, membership } = await this.accessControlService.ensureChildReadable(userId, dto.child_no);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限上传媒体');
    }

    const family = await this.prisma.family.findUniqueOrThrow({ where: { id: child.familyId } });
    const mediaNo = generateBizNo('m');
    const now = new Date();
    const objectKey = `families/${family.familyNo}/children/${child.childNo}/${now.getUTCFullYear()}/${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}/${mediaNo}.${extFromMime(mimeType)}`;

    const media = await this.prisma.recordMedia.create({
      data: {
        mediaNo,
        familyId: child.familyId,
        childId: child.id,
        uploaderUserId: userId,
        mediaType: dto.media_type as MediaType,
        storageProvider: getStorageProviderName(),
        bucket: getStorageBucket(),
        objectKey,
        originalName: sanitizeOriginalName(dto.file_name),
        mimeType,
        sizeBytes: BigInt(dto.size_bytes),
        status: MEDIA_STATUS_UPLOADING,
        uploadSessionExpiresAt: new Date(now.getTime() + uploadSessionTtlSeconds() * 1000),
      },
    });

    try {
      const uploadToken = await this.storageService.createUploadToken(objectKey, mimeType);
      if (uploadToken.mock_upload && typeof this.storageService.registerMockUpload === 'function') {
        this.storageService.registerMockUpload(objectKey, dto.size_bytes, mimeType);
      }
      return {
        media_no: media.mediaNo,
        object_key: objectKey,
        ...uploadToken,
      };
    } catch (error) {
      await this.markUploadFailed(media.id, error instanceof Error ? error.message : '无法创建上传凭证');
      throw new ServiceUnavailableException('媒体存储暂时不可用，请稍后重试');
    }
  }

  private async markUploadFailed(mediaId: bigint, reason: string) {
    const data = { status: MEDIA_STATUS_FAILED, failureReason: reason.slice(0, 255) };
    if (typeof this.prisma.recordMedia.updateMany === 'function') {
      await this.prisma.recordMedia.updateMany({
        where: { id: mediaId, status: MEDIA_STATUS_UPLOADING, deletedAt: null },
        data,
      }).catch(() => undefined);
      return;
    }
    if (typeof this.prisma.recordMedia.update === 'function') {
      await this.prisma.recordMedia.update({ where: { id: mediaId }, data }).catch(() => undefined);
    }
  }

  private getUploadPolicy(mediaType: CreateUploadTokenDto['media_type']) {
    if (mediaType === 'image') {
      return {
        label: '图片',
        maxBytes: getUploadImageMaxBytes(),
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
      };
    }

    if (mediaType === 'video') {
      return {
        label: '视频',
        maxBytes: getUploadVideoMaxBytes(),
        mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'],
      };
    }

    return {
      label: '音频',
      maxBytes: getUploadAudioMaxBytes(),
      mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/3gpp', 'audio/amr'],
    };
  }

  async confirm(userId: bigint, dto: ConfirmMediaDto) {
    const { media, membership } = await this.accessControlService.ensureMediaReadable(userId, dto.media_no);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限确认媒体');
    }

    if (media.status === MEDIA_STATUS_READY) {
      return {
        media_no: media.mediaNo,
        status: 'ready',
        width: media.width,
        height: media.height,
        duration_seconds: media.durationSeconds,
        created_at: media.createdAt.toISOString(),
        updated_at: media.updatedAt.toISOString(),
      };
    }

    if (media.status !== MEDIA_STATUS_UPLOADING) {
      throw new ConflictException('媒体状态不允许确认');
    }

    if (media.uploadSessionExpiresAt && media.uploadSessionExpiresAt.getTime() <= Date.now()) {
      await this.markUploadFailed(media.id, '上传会话已过期');
      throw new ConflictException('上传会话已过期，请重新上传');
    }

    let uploaded: Awaited<ReturnType<StorageService['headObject']>>;
    try {
      uploaded = await this.storageService.headObject(media.objectKey);
    } catch (_error) {
      throw new ServiceUnavailableException('媒体存储暂时不可用，请稍后重试');
    }

    if (!uploaded.exists) {
      throw new BadRequestException('媒体文件尚未上传完成，请上传成功后再确认');
    }

    if (typeof uploaded.content_length === 'number' && media.sizeBytes && uploaded.content_length !== Number(media.sizeBytes)) {
      throw new BadRequestException('媒体文件大小与上传凭证不一致，请重新上传');
    }

    if (!uploaded.content_type || !isCompatibleStoredContentType(media.mimeType, uploaded.content_type)) {
      throw new BadRequestException('媒体文件格式与上传凭证不一致，请重新上传');
    }

    if (media.mediaType === MediaType.image && (!dto.width || !dto.height)) {
      throw new BadRequestException('图片尺寸读取失败，请重新选择一张图片');
    }

    if (media.mediaType === MediaType.image && dto.width && dto.height && dto.width * dto.height > 100_000_000) {
      throw new BadRequestException('图片分辨率超过限制，请选择较小的图片');
    }

    if (media.mediaType === MediaType.video || media.mediaType === MediaType.audio) {
      ensureMediaDurationLimit(media.mediaType, dto.duration_seconds);
    }

    const readyData = {
      width: dto.width,
      height: dto.height,
      durationSeconds: dto.duration_seconds ?? undefined,
      status: MEDIA_STATUS_READY,
    };
    let updated: {
      mediaNo: string;
      width: number | null;
      height: number | null;
      durationSeconds: number | null;
      createdAt: Date;
      updatedAt: Date;
    };
    if (typeof this.prisma.recordMedia.updateMany === 'function' && typeof this.prisma.recordMedia.findFirstOrThrow === 'function') {
      const claimed = await this.prisma.recordMedia.updateMany({
        where: { id: media.id, status: MEDIA_STATUS_UPLOADING, deletedAt: null },
        data: readyData,
      });
      if (claimed.count === 0) {
        const current = await this.prisma.recordMedia.findFirst({ where: { id: media.id, deletedAt: null } });
        if (current?.status === MEDIA_STATUS_READY) return {
          media_no: current.mediaNo,
          status: 'ready',
          width: current.width,
          height: current.height,
          duration_seconds: current.durationSeconds,
          created_at: current.createdAt.toISOString(),
          updated_at: current.updatedAt.toISOString(),
        };
        throw new ConflictException('媒体状态已发生变化，请刷新后重试');
      }
      updated = await this.prisma.recordMedia.findFirstOrThrow({ where: { id: media.id } });
    } else {
      updated = await this.prisma.recordMedia.update({ where: { id: media.id }, data: readyData });
    }

    return {
      media_no: updated.mediaNo,
      status: 'ready',
      width: updated.width,
      height: updated.height,
      duration_seconds: updated.durationSeconds,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    };
  }

  async accessUrl(userId: bigint, mediaNo: string) {
    const { media } = await this.accessControlService.ensureMediaReadable(userId, mediaNo);
    if (media.status !== MEDIA_STATUS_READY) {
      throw new ConflictException('媒体尚未就绪');
    }
    const accessUrl = await this.storageService.createAccessUrl(media.objectKey);
    const thumbnailAccessUrl = media.thumbnailObjectKey
      ? await this.storageService.createAccessUrl(media.thumbnailObjectKey).catch(() => null)
      : null;

    return {
      media_no: media.mediaNo,
      ...accessUrl,
      ...(thumbnailAccessUrl?.access_url ? { thumbnail_url: thumbnailAccessUrl.access_url } : {}),
    };
  }
}

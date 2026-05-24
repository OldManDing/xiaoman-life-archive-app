import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { FamilyMemberRole, MediaType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MEDIA_STATUS_READY, MEDIA_STATUS_UPLOADING } from '../../shared/constants';
import { getStorageProviderName } from '../../shared/env-config';
import { AccessControlService } from '../../shared/services/access-control.service';
import { StorageService } from '../../shared/services/storage.service';
import { extFromMime, generateBizNo } from '../../shared/utils';
import { ConfirmMediaDto } from './dto/confirm-media.dto';
import { CreateUploadTokenDto } from './dto/create-upload-token.dto';

const normalizeMimeType = (mimeType: string) => mimeType.toLowerCase().split(';', 1)[0].trim();

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly storageService: StorageService,
  ) {}

  async createUploadToken(userId: bigint, dto: CreateUploadTokenDto) {
    const uploadPolicy = this.getUploadPolicy(dto.media_type);
    const mimeType = normalizeMimeType(dto.mime_type);

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
        bucket: process.env.STORAGE_BUCKET ?? 'xiaoman-archive-local',
        objectKey,
        originalName: dto.file_name,
        mimeType,
        sizeBytes: BigInt(dto.size_bytes),
        status: MEDIA_STATUS_UPLOADING,
      },
    });

    return {
      media_no: media.mediaNo,
      object_key: objectKey,
      ...(await this.storageService.createUploadToken(objectKey, mimeType)),
    };
  }

  private getUploadPolicy(mediaType: CreateUploadTokenDto['media_type']) {
    if (mediaType === 'image') {
      return {
        label: '图片',
        maxBytes: Number(process.env.UPLOAD_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024),
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
      };
    }

    if (mediaType === 'video') {
      return {
        label: '视频',
        maxBytes: Number(process.env.UPLOAD_VIDEO_MAX_BYTES ?? 200 * 1024 * 1024),
        mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp'],
      };
    }

    return {
      label: '音频',
      maxBytes: Number(process.env.UPLOAD_AUDIO_MAX_BYTES ?? 50 * 1024 * 1024),
      mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/3gpp', 'audio/amr'],
    };
  }

  async confirm(userId: bigint, dto: ConfirmMediaDto) {
    const { media, membership } = await this.accessControlService.ensureMediaReadable(userId, dto.media_no);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限确认媒体');
    }

    if (media.status !== MEDIA_STATUS_UPLOADING) {
      throw new ConflictException('媒体状态不允许确认');
    }

    const updated = await this.prisma.recordMedia.update({
      where: { id: media.id },
      data: {
        width: dto.width,
        height: dto.height,
        durationSeconds: dto.duration_seconds ?? undefined,
        status: MEDIA_STATUS_READY,
      },
    });

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
    return {
      media_no: media.mediaNo,
      ...(await this.storageService.createAccessUrl(media.objectKey)),
    };
  }
}

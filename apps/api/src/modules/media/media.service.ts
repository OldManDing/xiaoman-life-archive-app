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

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly storageService: StorageService,
  ) {}

  async createUploadToken(userId: bigint, dto: CreateUploadTokenDto) {
    const maxImageBytes = Number(process.env.UPLOAD_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024);

    if (dto.media_type !== 'image') {
      throw new BadRequestException('V1 仅支持图片上传');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(dto.mime_type)) {
      throw new BadRequestException('图片格式不支持');
    }

    if (dto.size_bytes > maxImageBytes) {
      throw new BadRequestException('图片大小超过限制');
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
    ).padStart(2, '0')}/${mediaNo}.${extFromMime(dto.mime_type)}`;

    const media = await this.prisma.recordMedia.create({
      data: {
        mediaNo,
        familyId: child.familyId,
        childId: child.id,
        uploaderUserId: userId,
        mediaType: MediaType.image,
        storageProvider: getStorageProviderName(),
        bucket: process.env.STORAGE_BUCKET ?? 'xiaoman-archive-local',
        objectKey,
        originalName: dto.file_name,
        mimeType: dto.mime_type,
        sizeBytes: BigInt(dto.size_bytes),
        status: MEDIA_STATUS_UPLOADING,
      },
    });

    return {
      media_no: media.mediaNo,
      object_key: objectKey,
      ...(await this.storageService.createUploadToken(objectKey, dto.mime_type)),
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

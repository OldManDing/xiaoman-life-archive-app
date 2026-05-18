import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FamilyMemberRole, RecordTagSource, VisibilityScope } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MEDIA_STATUS_READY, RECORD_STATUS_DRAFT, RECORD_STATUS_PUBLISHED } from '../../shared/constants';
import { AccessControlService } from '../../shared/services/access-control.service';
import { StorageService } from '../../shared/services/storage.service';
import { ageDisplay, generateBizNo, normalizePage, normalizePageSize, statusToRecordLabel, toDateOnly } from '../../shared/utils';
import { CreateRecordDto } from './dto/create-record.dto';
import { ListRecordsDto } from './dto/list-records.dto';
import { UpdateRecordDto } from './dto/update-record.dto';

const uniqueTagNames = (tags: Array<{ tagName: string }>) => Array.from(new Set(tags.map((item) => item.tagName).filter(Boolean)));

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: bigint, dto: CreateRecordDto) {
    const { child, membership } = await this.accessControlService.ensureChildReadable(userId, dto.child_no);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限创建记录');
    }

    this.ensureRecordPayload(dto.content_text, dto.media_nos, dto.visibility_scope);
    this.ensureRecordPublishPayload({
      status: dto.status,
      recordType: dto.record_type,
      title: dto.title,
      contentText: dto.content_text,
      mediaNos: dto.media_nos ?? [],
      eventTime: dto.event_time,
    });
    const mediaNos = dto.media_nos ?? [];

    const record = await this.prisma.$transaction(async (tx) => {
      const media = mediaNos.length
        ? await tx.recordMedia.findMany({
            where: {
              mediaNo: { in: mediaNos },
              familyId: child.familyId,
              status: MEDIA_STATUS_READY,
              deletedAt: null,
            },
          })
        : [];

      if (media.length !== mediaNos.length) {
        throw new BadRequestException('存在不可用媒体');
      }

      const created = await tx.record.create({
        data: {
          recordNo: generateBizNo('r'),
          childId: child.id,
          familyId: child.familyId,
          creatorUserId: userId,
          recordType: dto.record_type,
          title: dto.title,
          contentText: dto.content_text,
          eventTime: dto.event_time ? new Date(dto.event_time) : new Date(),
          locationText: dto.location_text,
          visibilityScope: VisibilityScope.family,
          isMilestone: dto.is_milestone ?? false,
          status: dto.status === 'draft' ? RECORD_STATUS_DRAFT : RECORD_STATUS_PUBLISHED,
          publishedAt: dto.status === 'draft' ? null : new Date(),
        },
      });

      if (media.length) {
        await Promise.all(
          media.map((item) =>
            tx.recordMedia.update({
              where: { id: item.id },
              data: { recordId: created.id },
            }),
          ),
        );
      }

      if (dto.tags?.length) {
        await tx.recordTag.createMany({
          data: dto.tags.filter(Boolean).map((tag) => ({
            recordId: created.id,
            tagName: tag,
            source: RecordTagSource.user,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return this.detail(userId, record.recordNo);
  }

  async list(userId: bigint, dto: ListRecordsDto) {
    const { child } = await this.accessControlService.ensureChildReadable(userId, dto.child_no);
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);

    const where = {
      childId: child.id,
      deletedAt: null,
      ...(dto.status ? { status: dto.status === 'draft' ? RECORD_STATUS_DRAFT : RECORD_STATUS_PUBLISHED } : {}),
      ...(dto.record_type ? { recordType: dto.record_type as never } : {}),
      ...(dto.start_time || dto.end_time
        ? {
            eventTime: {
              ...(dto.start_time ? { gte: new Date(dto.start_time) } : {}),
              ...(dto.end_time ? { lte: new Date(dto.end_time) } : {}),
            },
          }
        : {}),
      ...(dto.tag
        ? {
            tags: {
              some: {
                tagName: dto.tag,
              },
            },
          }
        : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.record.count({ where }),
      this.prisma.record.findMany({
        where,
        include: {
          creator: true,
          media: { where: { status: MEDIA_STATUS_READY, deletedAt: null } },
          tags: true,
        },
        orderBy: { eventTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      list: await Promise.all(records.map((record) => this.toRecordSummary(record))),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async detail(userId: bigint, recordNo: string) {
    const { record } = await this.accessControlService.ensureRecordReadable(userId, recordNo);
    const child = await this.prisma.child.findUniqueOrThrow({ where: { id: record.childId } });

    return this.toRecordDetail(record, child.birthday);
  }

  async update(userId: bigint, recordNo: string, dto: UpdateRecordDto) {
    const { record } = await this.accessControlService.ensureRecordEditable(userId, recordNo);
    const mergedMediaNos = dto.media_nos ?? record.media.map((item) => item.mediaNo);
    this.ensureRecordPayload(dto.content_text ?? record.contentText, mergedMediaNos, dto.visibility_scope ?? 'family');
    this.ensureRecordPublishPayload({
      status: dto.status,
      recordType: dto.record_type ?? record.recordType,
      title: dto.title ?? record.title,
      contentText: dto.content_text ?? record.contentText,
      mediaNos: mergedMediaNos,
      eventTime: dto.event_time ?? record.eventTime.toISOString(),
    });

    await this.prisma.$transaction(async (tx) => {
      const nextMediaNos = dto.media_nos;
      if (nextMediaNos) {
        const media = await tx.recordMedia.findMany({
          where: {
            mediaNo: { in: nextMediaNos },
            familyId: record.familyId,
            status: MEDIA_STATUS_READY,
            deletedAt: null,
          },
        });
        if (media.length !== nextMediaNos.length) {
          throw new BadRequestException('存在不可用媒体');
        }

        await tx.recordMedia.updateMany({
          where: { recordId: record.id },
          data: { recordId: null },
        });

        await Promise.all(
          media.map((item) =>
            tx.recordMedia.update({
              where: { id: item.id },
              data: { recordId: record.id },
            }),
          ),
        );
      }

      await tx.record.update({
        where: { id: record.id },
        data: {
          recordType: dto.record_type,
          title: dto.title,
          contentText: dto.content_text,
          eventTime: dto.event_time ? new Date(dto.event_time) : undefined,
          locationText: dto.location_text,
          visibilityScope: dto.visibility_scope ? VisibilityScope.family : undefined,
          isMilestone: dto.is_milestone,
          status: dto.status ? (dto.status === 'draft' ? RECORD_STATUS_DRAFT : RECORD_STATUS_PUBLISHED) : undefined,
          publishedAt:
            dto.status === 'published' ? new Date() : dto.status === 'draft' ? null : undefined,
        },
      });

      if (dto.tags) {
        await tx.recordTag.deleteMany({ where: { recordId: record.id, source: RecordTagSource.user } });
        if (dto.tags.length) {
          await tx.recordTag.createMany({
            data: dto.tags.filter(Boolean).map((tag) => ({
              recordId: record.id,
              tagName: tag,
              source: RecordTagSource.user,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.detail(userId, recordNo);
  }

  async remove(userId: bigint, recordNo: string) {
    const { record } = await this.accessControlService.ensureRecordEditable(userId, recordNo);
    await this.prisma.record.update({
      where: { id: record.id },
      data: { deletedAt: new Date() },
    });

    return {
      record_no: record.recordNo,
      deleted: true,
    };
  }

  private ensureRecordPayload(contentText?: string | null, mediaNos?: string[], visibilityScope?: string) {
    if (!contentText && (!mediaNos || mediaNos.length === 0)) {
      throw new BadRequestException('正文和媒体至少保留一项');
    }
    if (visibilityScope && visibilityScope !== 'family') {
      throw new BadRequestException('V1 仅支持 visibility_scope=family');
    }
  }

  private ensureRecordPublishPayload({
    status,
    recordType,
    title,
    contentText,
    mediaNos,
    eventTime,
  }: {
    status?: string;
    recordType?: string;
    title?: string | null;
    contentText?: string | null;
    mediaNos: string[];
    eventTime?: string | null;
  }) {
    if (recordType === 'text' && mediaNos.length > 0) {
      throw new BadRequestException('文字记录不能关联媒体');
    }

    if (status !== 'published') return;

    if (!title?.trim()) {
      throw new BadRequestException('发布前请填写标题');
    }
    if (!contentText?.trim()) {
      throw new BadRequestException('发布前请填写正文');
    }
    if (!eventTime) {
      throw new BadRequestException('发布前请选择发生时间');
    }
    if (recordType === 'mixed' && mediaNos.length === 0) {
      throw new BadRequestException('图文记录发布前请至少上传一张照片或视频');
    }
    if (recordType === 'image' && mediaNos.length === 0) {
      throw new BadRequestException('图片记录发布前请至少上传一张照片');
    }
    if (recordType === 'video' && mediaNos.length === 0) {
      throw new BadRequestException('视频记录发布前请上传一段视频');
    }
    if (recordType === 'audio' && mediaNos.length === 0) {
      throw new BadRequestException('语音记录发布前请上传一段语音');
    }
  }

  private async toRecordSummary(record: {
    recordNo: string;
    title: string | null;
    contentText: string | null;
    eventTime: Date;
    recordType: string;
    isMilestone: boolean;
    aiSummary?: string | null;
    creator: { nickname: string };
    tags: Array<{ tagName: string }>;
    media: Array<{ objectKey: string; mediaNo: string; mediaType: string }>;
    status: number;
  }) {
    const firstMedia = record.media[0];
    const cover = firstMedia ? await this.storageService.createAccessUrl(firstMedia.objectKey) : null;

    return {
      record_no: record.recordNo,
      cover_media_no: firstMedia?.mediaNo ?? null,
      cover_media_type: firstMedia?.mediaType ?? null,
      cover_url: cover?.access_url ?? null,
      title: record.title,
      summary: record.contentText,
      ai_summary: record.aiSummary ?? null,
      event_time: record.eventTime.toISOString(),
      tags: uniqueTagNames(record.tags),
      creator_name: record.creator.nickname,
      is_milestone: record.isMilestone,
      record_type: record.recordType,
      status: statusToRecordLabel(record.status),
    };
  }

  private async toRecordDetail(
    record: {
      recordNo: string;
      child: { childNo: string };
      creator: { userNo: string; nickname: string };
      recordType: string;
      title: string | null;
      contentText: string | null;
      media: Array<{
        mediaNo: string;
        mediaType: string;
        objectKey: string;
        originalName: string | null;
        mimeType: string | null;
        sizeBytes: bigint | null;
        width: number | null;
        height: number | null;
        durationSeconds: number | null;
      }>;
      tags: Array<{ tagName: string }>;
      eventTime: Date;
      locationText: string | null;
      visibilityScope: string;
      isMilestone: boolean;
      aiGeneratedTitle: string | null;
      aiSummary: string | null;
      aiStatus: string | null;
      status: number;
      createdAt: Date;
      updatedAt: Date;
    },
    _birthday: Date,
  ) {
    const mediaList = await Promise.all(
      record.media.map(async (item) => {
        const access = await this.storageService.createAccessUrl(item.objectKey);
        return {
          media_no: item.mediaNo,
          media_type: item.mediaType,
          access_url: access.access_url,
          original_name: item.originalName,
          mime_type: item.mimeType,
          size_bytes: item.sizeBytes ? Number(item.sizeBytes) : null,
          width: item.width,
          height: item.height,
          duration_seconds: item.durationSeconds,
        };
      }),
    );

    return {
      record_no: record.recordNo,
      child_no: record.child.childNo,
      creator_user_no: record.creator.userNo,
      creator_name: record.creator.nickname,
      record_type: record.recordType,
      title: record.title,
      content_text: record.contentText,
      media_list: mediaList,
      tags: uniqueTagNames(record.tags),
      event_time: record.eventTime.toISOString(),
      location_text: record.locationText,
      visibility_scope: record.visibilityScope,
      is_milestone: record.isMilestone,
      ai_generated_title: record.aiGeneratedTitle,
      ai_summary: record.aiSummary,
      ai_status: record.aiStatus,
      status: statusToRecordLabel(record.status),
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }
}

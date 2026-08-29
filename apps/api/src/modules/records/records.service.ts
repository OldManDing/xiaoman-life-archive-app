import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActorType, FamilyMemberRole, Prisma, RecordTagSource, RecordType, VisibilityScope } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MEDIA_STATUS_READY, RECORD_STATUS_DRAFT, RECORD_STATUS_PUBLISHED } from '../../shared/constants';
import { parseMediaReference } from '../../shared/media-reference';
import { AccessControlService } from '../../shared/services/access-control.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { NotificationService } from '../../shared/services/notification.service';
import { StorageService } from '../../shared/services/storage.service';
import { ageDisplay, generateBizNo, normalizePage, normalizePageSize, statusToRecordLabel, toDateOnly } from '../../shared/utils';
import { CreateRecordDto } from './dto/create-record.dto';
import { ListRecordsDto } from './dto/list-records.dto';
import { ensureRecordMediaCountLimits } from '../media/media-policy';
import { UpdateRecordDto } from './dto/update-record.dto';

const uniqueTagNames = (tags: Array<{ tagName: string }>) => Array.from(new Set(tags.map((item) => item.tagName).filter(Boolean)));
const coordinateLocationPattern = /^(?:手机定位|当前位置)?\s*(?:[·:：-]\s*)?[-+]?\d{1,2}(?:\.\d{3,})?\s*,\s*[-+]?\d{1,3}(?:\.\d{3,})?$/;
const FAMILY_RECORD_PUBLISHED_ACTION = 'family.record_published';
const RECORD_MEDIA_MAX_REFERENCES = 20;
const RECORD_TAG_MAX_LENGTH = 32;

export const normalizeRecordTypeForMedia = (recordType: RecordType, mediaNos: string[]): RecordType =>
  recordType === RecordType.text && mediaNos.length > 0 ? RecordType.mixed : recordType;

const normalizeRecordLocationText = (value?: string | null) => {
  if (value === undefined) return undefined;
  const text = value?.trim() ?? '';
  if (!text) return null;
  return coordinateLocationPattern.test(text) ? '当前位置附近' : text;
};

const normalizeStringList = (values: string[] | undefined, maxLength: number) => {
  if (values === undefined) return undefined;
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (normalized.some((value) => value.length > maxLength)) {
    throw new BadRequestException(`单项内容不能超过${maxLength}个字符`);
  }
  return Array.from(new Set(normalized));
};

const parseRecordDate = (value: string, field: string) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new BadRequestException(`${field}格式不正确`);
  }
  return parsed;
};

const parseRecordEventDate = (value: string, field = '发生时间') => {
  const parsed = parseRecordDate(value, field);
  if (parsed.getTime() > Date.now()) {
    throw new BadRequestException(`${field}不能晚于当前时间`);
  }
  return parsed;
};

const parseListDateBoundary = (value: string, field: string, end = false) => {
  const parsed = parseRecordDate(value, field);
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return { value: parsed, operator: 'lt' as const };
  }
  return { value: parsed, operator: end ? ('lte' as const) : ('gte' as const) };
};

const keywordEventTimeRange = (keyword: string) => {
  const normalized = keyword
    .trim()
    .replace(/[年月/.]/g, '-')
    .replace(/日$/, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(normalized);

  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;

  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null && (day < 1 || day > 31)) return null;

  if (month === null) {
    return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
  }

  if (day === null) {
    return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  }

  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) {
    return null;
  }

  return { gte: start, lt: new Date(Date.UTC(year, month - 1, day + 1)) };
};

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: bigint, dto: CreateRecordDto) {
    const { child, membership } = await this.accessControlService.ensureChildReadable(userId, dto.child_no);
    if (membership.role !== FamilyMemberRole.owner && membership.role !== FamilyMemberRole.editor) {
      throw new ForbiddenException('无权限创建记录');
    }

    const mediaNos = normalizeStringList(dto.media_nos, 32) ?? [];
    if (mediaNos.length > RECORD_MEDIA_MAX_REFERENCES) {
      throw new BadRequestException(`每条记录最多关联${RECORD_MEDIA_MAX_REFERENCES}个媒体`);
    }
    const tags = normalizeStringList(dto.tags, RECORD_TAG_MAX_LENGTH) ?? [];
    const recordType = normalizeRecordTypeForMedia(dto.record_type, mediaNos);
    const status = dto.status ?? 'published';
    const visibilityScope = dto.visibility_scope ?? VisibilityScope.family;
    this.ensureRecordPayload(dto.content_text, mediaNos, visibilityScope);
    this.ensureRecordPublishPayload({
      status,
      recordType,
      title: dto.title,
      contentText: dto.content_text,
      mediaNos,
      eventTime: dto.event_time,
    });
    if (dto.event_time) parseRecordEventDate(dto.event_time);

    const record = await this.prisma.$transaction(async (tx) => {
      const media = mediaNos.length
        ? await tx.recordMedia.findMany({
            where: {
              mediaNo: { in: mediaNos },
              familyId: child.familyId,
              childId: child.id,
              recordId: null,
              status: MEDIA_STATUS_READY,
              deletedAt: null,
            },
          })
        : [];

      if (media.length !== mediaNos.length) {
        throw new BadRequestException('存在不可用媒体');
      }
      ensureRecordMediaCountLimits(media);

      const created = await tx.record.create({
        data: {
          recordNo: generateBizNo('r'),
          childId: child.id,
          familyId: child.familyId,
          creatorUserId: userId,
          recordType,
          title: dto.title,
          contentText: dto.content_text,
          eventTime: dto.event_time ? parseRecordEventDate(dto.event_time) : new Date(),
          locationText: normalizeRecordLocationText(dto.location_text),
          visibilityScope,
          isMilestone: dto.is_milestone ?? false,
          status: status === 'draft' ? RECORD_STATUS_DRAFT : RECORD_STATUS_PUBLISHED,
          publishedAt: status === 'draft' ? null : new Date(),
        },
      });

      if (media.length) {
        const claimed = await tx.recordMedia.updateMany({
          where: {
            id: { in: media.map((item) => item.id) },
            childId: child.id,
            recordId: null,
            status: MEDIA_STATUS_READY,
            deletedAt: null,
          },
          data: { recordId: created.id },
        });
        if (claimed.count !== media.length) {
          throw new BadRequestException('媒体已被其他记录占用，请刷新后重试');
        }
      }

      if (tags.length) {
        await tx.recordTag.createMany({
          data: tags.map((tag) => ({
            recordId: created.id,
            tagName: tag,
            source: RecordTagSource.user,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    if (record.status === RECORD_STATUS_PUBLISHED) {
      await this.logRecordPublished(userId, record.id, child.id);
    }

    return this.detail(userId, record.recordNo);
  }

  async list(userId: bigint, dto: ListRecordsDto) {
    const { child } = await this.accessControlService.ensureChildReadable(userId, dto.child_no);
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);

    const keyword = dto.keyword?.trim();
    const keywordTimeRange = keyword ? keywordEventTimeRange(keyword) : null;
    const visibilityWhere: Prisma.RecordWhereInput = dto.status === 'draft'
      ? { status: RECORD_STATUS_DRAFT, creatorUserId: userId }
      : dto.status === 'published'
        ? { status: RECORD_STATUS_PUBLISHED }
        : { OR: [{ status: RECORD_STATUS_PUBLISHED }, { status: RECORD_STATUS_DRAFT, creatorUserId: userId }] };
    const where: Prisma.RecordWhereInput = {
      childId: child.id,
      deletedAt: null,
    };

    if (dto.record_type) where.recordType = dto.record_type;
    if (dto.start_time || dto.end_time) {
      const eventTime: Prisma.DateTimeFilter = {};
      if (dto.start_time) {
        const boundary = parseListDateBoundary(dto.start_time, '开始时间');
        eventTime.gte = boundary.value;
      }
      if (dto.end_time) {
        const boundary = parseListDateBoundary(dto.end_time, '结束时间', true);
        eventTime[boundary.operator] = boundary.value;
      }
      if (eventTime.gte && (eventTime.lte || eventTime.lt)) {
        const end = eventTime.lte ?? eventTime.lt;
        if (end && eventTime.gte >= end) throw new BadRequestException('开始时间不能晚于结束时间');
      }
      where.eventTime = eventTime;
    }
    if (keyword) {
      where.AND = [
        visibilityWhere,
        {
          OR: [
          { title: { contains: keyword } },
          { contentText: { contains: keyword } },
          { aiSummary: { contains: keyword } },
          { locationText: { contains: keyword } },
          { creator: { nickname: { contains: keyword } } },
          { tags: { some: { tagName: { contains: keyword } } } },
          ...(keywordTimeRange ? [{ eventTime: keywordTimeRange }] : []),
          ],
        },
      ];
    } else {
      Object.assign(where, visibilityWhere);
    }
    if (dto.tag) {
      where.tags = { some: { tagName: dto.tag.trim() } };
    }
    const [total, records] = await this.prisma.$transaction([
      this.prisma.record.count({ where }),
      this.prisma.record.findMany({
        where,
        include: {
          creator: true,
          media: {
            where: { status: MEDIA_STATUS_READY, deletedAt: null },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
          tags: true,
        },
        orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
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
    const requestedMediaNos = normalizeStringList(dto.media_nos, 32);
    if (requestedMediaNos && requestedMediaNos.length > RECORD_MEDIA_MAX_REFERENCES) {
      throw new BadRequestException(`每条记录最多关联${RECORD_MEDIA_MAX_REFERENCES}个媒体`);
    }
    const mergedMediaNos = requestedMediaNos ?? record.media.map((item) => item.mediaNo);
    const tags = normalizeStringList(dto.tags, RECORD_TAG_MAX_LENGTH);
    const recordType = normalizeRecordTypeForMedia(dto.record_type ?? record.recordType, mergedMediaNos);
    const visibilityScope = dto.visibility_scope ?? record.visibilityScope ?? VisibilityScope.family;
    this.ensureRecordPayload(dto.content_text ?? record.contentText, mergedMediaNos, visibilityScope);
    this.ensureRecordPublishPayload({
      status: dto.status,
      recordType,
      title: dto.title ?? record.title,
      contentText: dto.content_text ?? record.contentText,
      mediaNos: mergedMediaNos,
      eventTime: dto.event_time ?? record.eventTime.toISOString(),
    });
    if (dto.event_time) parseRecordEventDate(dto.event_time);

    const shouldLogPublish = record.status !== RECORD_STATUS_PUBLISHED && dto.status === 'published';

    await this.prisma.$transaction(async (tx) => {
      const nextMediaNos = requestedMediaNos;
      if (nextMediaNos) {
        const media = await tx.recordMedia.findMany({
          where: {
            mediaNo: { in: nextMediaNos },
            familyId: record.familyId,
            childId: record.childId,
            OR: [{ recordId: null }, { recordId: record.id }],
            status: MEDIA_STATUS_READY,
            deletedAt: null,
          },
        });
        if (media.length !== nextMediaNos.length) {
          throw new BadRequestException('存在不可用媒体');
        }
        ensureRecordMediaCountLimits(media);

        const claimed = await tx.recordMedia.updateMany({
          where: {
            id: { in: media.map((item) => item.id) },
            childId: record.childId,
            OR: [{ recordId: null }, { recordId: record.id }],
            status: MEDIA_STATUS_READY,
            deletedAt: null,
          },
          data: { recordId: record.id },
        });
        if (claimed.count !== media.length) {
          throw new BadRequestException('媒体已被其他记录占用，请刷新后重试');
        }
        await tx.recordMedia.updateMany({
          where: { recordId: record.id, id: { notIn: media.map((item) => item.id) } },
          data: { recordId: null },
        });
      } else {
        ensureRecordMediaCountLimits(record.media);
      }

      const recordData: Prisma.RecordUpdateInput = {
          recordType,
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.content_text !== undefined ? { contentText: dto.content_text } : {}),
          ...(dto.event_time ? { eventTime: parseRecordEventDate(dto.event_time) } : {}),
          ...(dto.location_text !== undefined ? { locationText: normalizeRecordLocationText(dto.location_text) } : {}),
          ...(dto.visibility_scope !== undefined ? { visibilityScope } : {}),
          ...(dto.is_milestone !== undefined ? { isMilestone: dto.is_milestone } : {}),
          ...(dto.status !== undefined
            ? {
                status: dto.status === 'draft' ? RECORD_STATUS_DRAFT : RECORD_STATUS_PUBLISHED,
                publishedAt: dto.status === 'published' ? new Date() : null,
              }
            : {}),
      };
      await tx.record.update({ where: { id: record.id }, data: recordData });

      if (tags !== undefined) {
        await tx.recordTag.deleteMany({ where: { recordId: record.id, source: RecordTagSource.user } });
        if (tags.length) {
          await tx.recordTag.createMany({
            data: tags.map((tag) => ({
              recordId: record.id,
              tagName: tag,
              source: RecordTagSource.user,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    if (shouldLogPublish) {
      await this.logRecordPublished(userId, record.id, record.childId);
    }

    return this.detail(userId, recordNo);
  }

  async remove(userId: bigint, recordNo: string) {
    const { record } = await this.accessControlService.ensureRecordRemovable(userId, recordNo);
    if (!record.deletedAt) {
      await this.prisma.record.updateMany({
        where: { id: record.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }

    return {
      record_no: record.recordNo,
      deleted: true,
    };
  }

  private ensureRecordPayload(contentText?: string | null, mediaNos?: string[], visibilityScope?: string) {
    if (!contentText?.trim() && (!mediaNos || mediaNos.length === 0)) {
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

  private async resolveUserAvatarUrl(userId: bigint, avatarUrl: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return avatarUrl;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        uploaderUserId: userId,
        status: MEDIA_STATUS_READY,
        deletedAt: null,
      },
      select: { objectKey: true, thumbnailObjectKey: true },
    });
    if (!media) return null;

    const objectKey = media.thumbnailObjectKey ?? media.objectKey;
    try {
      return (await this.storageService.createAccessUrl(objectKey)).access_url;
    } catch {
      if (objectKey !== media.objectKey) {
        try {
          return (await this.storageService.createAccessUrl(media.objectKey)).access_url;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private async toRecordSummary(record: {
    recordNo: string;
    title: string | null;
    contentText: string | null;
    eventTime: Date;
    locationText: string | null;
    recordType: string;
    isMilestone: boolean;
    aiSummary?: string | null;
    creator: { id: bigint; userNo: string; nickname: string; avatarUrl: string | null };
    tags: Array<{ tagName: string }>;
    media: Array<{ objectKey: string; mediaNo: string; mediaType: string }>;
    status: number;
  }) {
    const firstMedia = record.media[0];
    const [cover, creatorAvatarUrl] = await Promise.all([
      firstMedia ? this.storageService.createAccessUrl(firstMedia.objectKey).catch(() => null) : Promise.resolve(null),
      this.resolveUserAvatarUrl(record.creator.id, record.creator.avatarUrl),
    ]);

    return {
      record_no: record.recordNo,
      cover_media_no: firstMedia?.mediaNo ?? null,
      cover_media_type: firstMedia?.mediaType ?? null,
      cover_url: cover?.access_url ?? null,
      title: record.title,
      summary: record.contentText,
      ai_summary: record.aiSummary ?? null,
      event_time: record.eventTime.toISOString(),
      location_text: record.locationText,
      tags: uniqueTagNames(record.tags),
      creator_user_no: record.creator.userNo,
      creator_name: record.creator.nickname,
      creator_avatar_url: creatorAvatarUrl,
      creator_avatar_media_no: parseMediaReference(record.creator.avatarUrl),
      is_milestone: record.isMilestone,
      record_type: record.recordType,
      status: statusToRecordLabel(record.status),
    };
  }

  private async logRecordPublished(userId: bigint, recordId: bigint, childId: bigint) {
    const [record, child, user] = await Promise.all([
      this.prisma.record.findUnique({
        where: { id: recordId },
        select: {
          recordNo: true,
          title: true,
          familyId: true,
          eventTime: true,
        },
      }),
      this.prisma.child.findUnique({
        where: { id: childId },
        include: { family: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { userNo: true, nickname: true },
      }),
    ]);

    if (!record || !child || !user) return;

    await this.auditLogService.create({
      actor_type: ActorType.user,
      actor_id: userId,
      action: FAMILY_RECORD_PUBLISHED_ACTION,
      target_type: 'family',
      target_id: record.familyId,
      metadata: {
        family_no: child.family.familyNo,
        child_no: child.childNo,
        child_name: child.name,
        record_no: record.recordNo,
        record_title: record.title,
        event_time: record.eventTime.toISOString(),
        target_user_no: user.userNo,
        target_nickname: user.nickname,
        operator_user_id: userId.toString(),
      },
    });

    try {
      await this.notificationService.createRecordPublishedNotifications({
        record_no: record.recordNo,
        record_title: record.title,
        record_event_time: record.eventTime,
        family_id: record.familyId,
        family_no: child.family.familyNo,
        child_no: child.childNo,
        child_name: child.name,
        actor_user_id: userId,
        actor_user_no: user.userNo,
        actor_nickname: user.nickname,
      });
    } catch (error) {
      this.logger.warn(`Failed to create record notifications for ${record.recordNo}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
        const access = await this.storageService.createAccessUrl(item.objectKey).catch(() => null);
        return {
          media_no: item.mediaNo,
          media_type: item.mediaType,
          access_url: access?.access_url ?? null,
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
      location_text: normalizeRecordLocationText(record.locationText) ?? null,
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

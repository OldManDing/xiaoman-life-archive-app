import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ActorType, AdminRole, AiJobStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

import { AiJobsQueue } from '../ai-jobs/ai-jobs.queue';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { StorageService } from '../../shared/services/storage.service';
import {
  getAdminInitialPassword,
  getAdminInitialUsername,
  getJwtAccessSecret,
  isAdminBootstrapAllowed,
} from '../../shared/env-config';
import { AuthenticatedAdmin } from '../../shared/types';
import {
  ADMIN_ACTIVE_STATUS,
  MEDIA_STATUS_FAILED,
  MEDIA_STATUS_READY,
  MEDIA_STATUS_REMOVED,
  MEDIA_STATUS_UPLOADING,
  RECORD_STATUS_DRAFT,
  RECORD_STATUS_PUBLISHED,
  USER_ACTIVE_STATUS,
} from '../../shared/constants';
import { normalizePage, normalizePageSize, statusToChildLabel, statusToRecordLabel, toDateOnly } from '../../shared/utils';
import { AdminAiJobActionDto } from './dto/admin-ai-job-action.dto';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminAuditLogListDto } from './dto/admin-audit-log-list.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUpdateMediaStatusDto } from './dto/admin-update-media-status.dto';
import { AdminUpdateRecordStatusDto } from './dto/admin-update-record-status.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';

const USER_DISABLED_STATUS = 2;
const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '2h';

const statusToUserLabel = (status: number): 'active' | 'disabled' => (status === USER_ACTIVE_STATUS ? 'active' : 'disabled');
const statusToMediaLabel = (status: number): 'uploading' | 'ready' | 'failed' | 'removed' => {
  if (status === MEDIA_STATUS_READY) return 'ready';
  if (status === MEDIA_STATUS_FAILED) return 'failed';
  if (status === MEDIA_STATUS_REMOVED) return 'removed';
  return 'uploading';
};

const mediaStatusToNumber = (status: AdminUpdateMediaStatusDto['status']) => {
  if (status === 'ready') return MEDIA_STATUS_READY;
  if (status === 'removed') return MEDIA_STATUS_REMOVED;
  return MEDIA_STATUS_FAILED;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
    private readonly aiJobsQueue: AiJobsQueue,
    private readonly storageService: StorageService,
  ) {}

  async login(dto: AdminLoginDto, request: Request) {
    const admin = await this.ensureBootstrapAdmin(dto.username);
    if (admin.status !== ADMIN_ACTIVE_STATUS) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('账号或密码错误');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_login',
      target_type: 'admin_user',
      target_id: admin.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
    });

    return {
      access_token: await this.jwtService.signAsync(
        {
          type: 'admin',
          sub: admin.id.toString(),
          username: admin.username,
          role: admin.role,
        },
        {
          secret: getJwtAccessSecret(),
          expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? DEFAULT_ACCESS_TOKEN_EXPIRES_IN) as JwtSignOptions['expiresIn'],
        },
      ),
      expires_in: 7200,
      admin: {
        username: admin.username,
        display_name: admin.displayName,
        role: admin.role,
      },
    };
  }

  async listUsers(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          OR: [
            { userNo: { contains: dto.keyword } },
            { nickname: { contains: dto.keyword } },
            { mobile: { contains: dto.keyword } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_users', request);
    return {
      list: list.map((item) => ({
        user_no: item.userNo,
        nickname: item.nickname,
        avatar_url: item.avatarUrl,
        mobile: item.mobile,
        membership_type: item.membershipType,
        status: statusToUserLabel(item.status),
        last_login_at: item.lastLoginAt?.toISOString() ?? null,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async updateUserStatus(admin: AuthenticatedAdmin, userNo: string, dto: AdminUpdateUserStatusDto, request: Request) {
    const user = await this.prisma.user.findFirst({
      where: {
        userNo,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const nextStatus = dto.status === 'active' ? USER_ACTIVE_STATUS : USER_DISABLED_STATUS;
    if (user.status === nextStatus) {
      return {
        user_no: user.userNo,
        status: dto.status,
        changed: false,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: nextStatus },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: nextStatus === USER_ACTIVE_STATUS ? 'admin_activate_user' : 'admin_disable_user',
      target_type: 'user',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        user_no: updated.userNo,
        before_status: statusToUserLabel(user.status),
        after_status: statusToUserLabel(nextStatus),
        reason: dto.reason ?? null,
      },
    });

    return {
      user_no: updated.userNo,
      status: statusToUserLabel(nextStatus),
      changed: true,
    };
  }

  async listChildren(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          deletedAt: null,
          OR: [{ childNo: { contains: dto.keyword } }, { name: { contains: dto.keyword } }],
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.child.count({ where }),
      this.prisma.child.findMany({
        where,
        include: { family: true, owner: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_children', request);
    return {
      list: list.map((item) => ({
        child_no: item.childNo,
        family_no: item.family.familyNo,
        owner_user_no: item.owner.userNo,
        name: item.name,
        birthday: toDateOnly(item.birthday),
        gender: item.gender,
        status: statusToChildLabel(item.status, item.deletedAt),
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listRecords(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          deletedAt: null,
          OR: [{ recordNo: { contains: dto.keyword } }, { title: { contains: dto.keyword } }, { contentText: { contains: dto.keyword } }],
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.record.count({ where }),
      this.prisma.record.findMany({
        where,
        include: { child: true, creator: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_records', request);
    return {
      list: list.map((item) => ({
        record_no: item.recordNo,
        child_no: item.child.childNo,
        creator_user_no: item.creator.userNo,
        title: item.title,
        record_type: item.recordType,
        visibility_scope: item.visibilityScope,
        status: statusToRecordLabel(item.status),
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listMedia(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          deletedAt: null,
          OR: [{ mediaNo: { contains: dto.keyword } }, { originalName: { contains: dto.keyword } }, { objectKey: { contains: dto.keyword } }],
        }
      : { deletedAt: null };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.recordMedia.count({ where }),
      this.prisma.recordMedia.findMany({
        where,
        include: { child: true, family: true, uploader: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_media', request);
    return {
      list: list.map((item) => ({
        media_no: item.mediaNo,
        family_no: item.family.familyNo,
        child_no: item.child?.childNo ?? null,
        uploader_user_no: item.uploader.userNo,
        media_type: item.mediaType,
        status: statusToMediaLabel(item.status),
        mime_type: item.mimeType,
        size_bytes: item.sizeBytes ? Number(item.sizeBytes) : null,
        object_key: item.objectKey,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listAiJobs(admin: AuthenticatedAdmin, dto: AdminListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where = dto.keyword
      ? {
          OR: [{ jobNo: { contains: dto.keyword } }, { errorMessage: { contains: dto.keyword } }],
        }
      : {};

    const [total, list] = await this.prisma.$transaction([
      this.prisma.aiJob.count({ where }),
      this.prisma.aiJob.findMany({
        where,
        include: { record: true, requester: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_ai_jobs', request);
    return {
      list: list.map((item) => ({
        job_no: item.jobNo,
        record_no: item.record?.recordNo ?? null,
        requester_user_no: item.requester.userNo,
        job_type: item.jobType,
        status: item.status,
        error_message: item.errorMessage,
        retry_count: item.retryCount,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async listAuditLogs(admin: AuthenticatedAdmin, dto: AdminAuditLogListDto, request: Request) {
    const page = normalizePage(dto.page);
    const pageSize = normalizePageSize(dto.page_size);
    const where: Prisma.AuditLogWhereInput = {
      ...(dto.keyword
        ? {
            OR: [
              { action: { contains: dto.keyword } },
              { targetType: { contains: dto.keyword } },
            ],
          }
        : {}),
      ...(dto.action ? { action: dto.action } : {}),
      ...(dto.target_type ? { targetType: dto.target_type } : {}),
      ...(dto.start_time || dto.end_time
        ? {
            createdAt: {
              ...(dto.start_time ? { gte: new Date(dto.start_time) } : {}),
              ...(dto.end_time ? { lte: new Date(dto.end_time) } : {}),
            },
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.logListAudit(admin, 'admin_list_audit_logs', request);
    return {
      list: list.map((item) => ({
        actor_type: item.actorType,
        actor_id: item.actorId.toString(),
        action: item.action,
        target_type: item.targetType,
        target_id: item.targetId?.toString() ?? null,
        ip_address: item.ipAddress,
        user_agent: item.userAgent,
        metadata: item.metadata,
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async dashboard(admin: AuthenticatedAdmin, request: Request) {
    const [userCount, childCount, recordCount, mediaCount, aiJobGroups, recentAuditLogs] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.child.count({ where: { deletedAt: null } }),
      this.prisma.record.count({ where: { deletedAt: null } }),
      this.prisma.recordMedia.count({ where: { deletedAt: null } }),
      this.prisma.aiJob.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: true,
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    await this.logListAudit(admin, 'admin_view_dashboard', request);

    return {
      totals: {
        users: userCount,
        children: childCount,
        records: recordCount,
        media: mediaCount,
      },
      ai_job_status_distribution: Object.values(AiJobStatus).map((status) => ({
        status,
        count: aiJobGroups.find((item) => item.status === status)?._count ?? 0,
      })),
      recent_audit_logs: recentAuditLogs.map((item) => this.toAuditLogItem(item)),
    };
  }

  async userDetail(admin: AuthenticatedAdmin, userNo: string, request: Request) {
    const user = await this.prisma.user.findFirst({
      where: { userNo, deletedAt: null },
      include: {
        ownedChildren: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        familyMemberships: {
          where: { deletedAt: null },
          include: { family: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.logListAudit(admin, 'admin_view_user_detail', request);

    return {
      user_no: user.userNo,
      nickname: user.nickname,
      avatar_url: user.avatarUrl,
      mobile: user.mobile,
      email: user.email,
      membership_type: user.membershipType,
      membership_expire_at: user.membershipExpireAt?.toISOString() ?? null,
      status: statusToUserLabel(user.status),
      last_login_at: user.lastLoginAt?.toISOString() ?? null,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
      children: user.ownedChildren.map((child) => ({
        child_no: child.childNo,
        name: child.name,
        birthday: toDateOnly(child.birthday),
        gender: child.gender,
        status: statusToChildLabel(child.status, child.deletedAt),
      })),
      families: user.familyMemberships.map((membership) => ({
        family_no: membership.family.familyNo,
        family_name: membership.family.name,
        role: membership.role,
        status: membership.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        joined_at: membership.joinedAt?.toISOString() ?? null,
      })),
    };
  }

  async childDetail(admin: AuthenticatedAdmin, childNo: string, request: Request) {
    const child = await this.prisma.child.findFirst({
      where: { childNo, deletedAt: null },
      include: {
        family: {
          include: {
            members: {
              where: { deletedAt: null },
              include: { user: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        owner: true,
        records: {
          where: { deletedAt: null },
          orderBy: { eventTime: 'desc' },
          take: 5,
        },
      },
    });

    if (!child) {
      throw new NotFoundException('孩子档案不存在');
    }

    await this.logListAudit(admin, 'admin_view_child_detail', request);

    return {
      child_no: child.childNo,
      family_no: child.family.familyNo,
      family_name: child.family.name,
      owner_user_no: child.owner.userNo,
      owner_name: child.owner.nickname,
      name: child.name,
      avatar_url: child.avatarUrl,
      birthday: toDateOnly(child.birthday),
      gender: child.gender,
      birth_place: child.birthPlace,
      remark: child.remark,
      status: statusToChildLabel(child.status, child.deletedAt),
      created_at: child.createdAt.toISOString(),
      updated_at: child.updatedAt.toISOString(),
      family_members: child.family.members.map((member) => ({
        user_no: member.user.userNo,
        nickname: member.user.nickname,
        mobile: member.user.mobile,
        role: member.role,
        status: member.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        joined_at: member.joinedAt?.toISOString() ?? null,
      })),
      recent_records: child.records.map((record) => ({
        record_no: record.recordNo,
        title: record.title,
        record_type: record.recordType,
        status: statusToRecordLabel(record.status),
        event_time: record.eventTime.toISOString(),
      })),
    };
  }

  async recordDetail(admin: AuthenticatedAdmin, recordNo: string, request: Request) {
    const record = await this.prisma.record.findFirst({
      where: { recordNo, deletedAt: null },
      include: {
        child: true,
        family: true,
        creator: true,
        tags: true,
        media: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        aiJobs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!record) {
      throw new NotFoundException('成长记录不存在');
    }

    await this.logListAudit(admin, 'admin_view_record_detail', request);

    return {
      record_no: record.recordNo,
      child_no: record.child.childNo,
      child_name: record.child.name,
      family_no: record.family.familyNo,
      creator_user_no: record.creator.userNo,
      creator_name: record.creator.nickname,
      record_type: record.recordType,
      title: record.title,
      content_text: record.contentText,
      tags: record.tags.map((tag) => ({ tag_name: tag.tagName, source: tag.source })),
      media_list: await Promise.all(record.media.map((item) => this.toMediaItem(item))),
      ai_jobs: record.aiJobs.map((job) => this.toAiJobItem(job)),
      event_time: record.eventTime.toISOString(),
      location_text: record.locationText,
      visibility_scope: record.visibilityScope,
      is_milestone: record.isMilestone,
      ai_generated_title: record.aiGeneratedTitle,
      ai_summary: record.aiSummary,
      ai_status: record.aiStatus,
      status: statusToRecordLabel(record.status),
      published_at: record.publishedAt?.toISOString() ?? null,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }

  async updateRecordStatus(admin: AuthenticatedAdmin, recordNo: string, dto: AdminUpdateRecordStatusDto, request: Request) {
    const record = await this.prisma.record.findFirst({
      where: { recordNo, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException('成长记录不存在');
    }

    const nextStatus = dto.status === 'published' ? RECORD_STATUS_PUBLISHED : RECORD_STATUS_DRAFT;
    if (record.status === nextStatus) {
      return {
        record_no: record.recordNo,
        status: dto.status,
        changed: false,
      };
    }

    const updated = await this.prisma.record.update({
      where: { id: record.id },
      data: {
        status: nextStatus,
        publishedAt: nextStatus === RECORD_STATUS_PUBLISHED ? new Date() : null,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: nextStatus === RECORD_STATUS_PUBLISHED ? 'admin_restore_record' : 'admin_unpublish_record',
      target_type: 'record',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        record_no: updated.recordNo,
        before_status: statusToRecordLabel(record.status),
        after_status: statusToRecordLabel(updated.status),
        reason: dto.reason ?? null,
      },
    });

    return {
      record_no: updated.recordNo,
      status: statusToRecordLabel(updated.status),
      changed: true,
    };
  }

  async mediaDetail(admin: AuthenticatedAdmin, mediaNo: string, request: Request) {
    const media = await this.prisma.recordMedia.findFirst({
      where: { mediaNo, deletedAt: null },
      include: {
        record: true,
        child: true,
        family: true,
        uploader: true,
      },
    });

    if (!media) {
      throw new NotFoundException('媒体不存在');
    }

    await this.logListAudit(admin, 'admin_view_media_detail', request);

    return {
      ...(await this.toMediaItem(media)),
      family_no: media.family.familyNo,
      child_no: media.child?.childNo ?? null,
      child_name: media.child?.name ?? null,
      record_no: media.record?.recordNo ?? null,
      record_title: media.record?.title ?? null,
      uploader_user_no: media.uploader.userNo,
      uploader_name: media.uploader.nickname,
      uploader_mobile: media.uploader.mobile,
    };
  }

  async updateMediaStatus(admin: AuthenticatedAdmin, mediaNo: string, dto: AdminUpdateMediaStatusDto, request: Request) {
    const media = await this.prisma.recordMedia.findFirst({
      where: { mediaNo, deletedAt: null },
    });

    if (!media) {
      throw new NotFoundException('媒体不存在');
    }

    const nextStatus = mediaStatusToNumber(dto.status);
    if (media.status === nextStatus) {
      return {
        media_no: media.mediaNo,
        status: statusToMediaLabel(media.status),
        changed: false,
      };
    }

    const updated = await this.prisma.recordMedia.update({
      where: { id: media.id },
      data: { status: nextStatus },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: nextStatus === MEDIA_STATUS_READY ? 'admin_approve_media' : nextStatus === MEDIA_STATUS_REMOVED ? 'admin_remove_media' : 'admin_reject_media',
      target_type: 'media',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        media_no: updated.mediaNo,
        before_status: statusToMediaLabel(media.status),
        after_status: statusToMediaLabel(updated.status),
        reason: dto.reason ?? null,
      },
    });

    return {
      media_no: updated.mediaNo,
      status: statusToMediaLabel(updated.status),
      changed: true,
    };
  }

  async aiJobDetail(admin: AuthenticatedAdmin, jobNo: string, request: Request) {
    const job = await this.prisma.aiJob.findFirst({
      where: { jobNo },
      include: {
        record: true,
        family: true,
        requester: true,
      },
    });

    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    await this.logListAudit(admin, 'admin_view_ai_job_detail', request);

    return {
      ...this.toAiJobItem(job),
      family_no: job.family.familyNo,
      requester_name: job.requester.nickname,
      requester_mobile: job.requester.mobile,
      record_title: job.record?.title ?? null,
      input_snapshot: job.inputSnapshot,
      output_json: job.outputJson,
      started_at: job.startedAt?.toISOString() ?? null,
      finished_at: job.finishedAt?.toISOString() ?? null,
      updated_at: job.updatedAt.toISOString(),
    };
  }

  async retryAiJob(admin: AuthenticatedAdmin, jobNo: string, dto: AdminAiJobActionDto, request: Request) {
    const job = await this.prisma.aiJob.findFirst({ where: { jobNo } });
    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    if (job.status !== AiJobStatus.failed && job.status !== AiJobStatus.cancelled) {
      throw new BadRequestException('当前任务状态不允许重试');
    }

    const updated = await this.prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: AiJobStatus.pending,
        errorMessage: null,
        retryCount: { increment: 1 },
        startedAt: null,
        finishedAt: null,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_retry_ai_job',
      target_type: 'ai_job',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        job_no: updated.jobNo,
        before_status: job.status,
        after_status: updated.status,
        reason: dto.reason ?? null,
      },
    });

    await this.aiJobsQueue.enqueue(updated.id);

    return {
      job_no: updated.jobNo,
      status: updated.status,
      retry_count: updated.retryCount,
      changed: true,
    };
  }

  async cancelAiJob(admin: AuthenticatedAdmin, jobNo: string, dto: AdminAiJobActionDto, request: Request) {
    const job = await this.prisma.aiJob.findFirst({ where: { jobNo } });
    if (!job) {
      throw new NotFoundException('AI 任务不存在');
    }

    if (job.status !== AiJobStatus.pending && job.status !== AiJobStatus.processing) {
      throw new BadRequestException('当前任务状态不允许取消');
    }

    const updated = await this.prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status: AiJobStatus.cancelled,
        finishedAt: new Date(),
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action: 'admin_cancel_ai_job',
      target_type: 'ai_job',
      target_id: updated.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
      metadata: {
        job_no: updated.jobNo,
        before_status: job.status,
        after_status: updated.status,
        reason: dto.reason ?? null,
      },
    });

    return {
      job_no: updated.jobNo,
      status: updated.status,
      changed: true,
    };
  }

  private async ensureBootstrapAdmin(username: string) {
    const initialUsername = getAdminInitialUsername();
    const initialPassword = getAdminInitialPassword();

    if (username === initialUsername) {
      const existingInitial = await this.prisma.adminUser.findFirst({
        where: { username: initialUsername, deletedAt: null },
      });
      if (existingInitial) {
        return existingInitial;
      }

      if (!isAdminBootstrapAllowed()) {
        throw new UnauthorizedException('账号或密码错误');
      }

      const passwordHash = await bcrypt.hash(initialPassword, 10);
      return this.prisma.adminUser.create({
        data: {
          username: initialUsername,
          passwordHash,
          displayName: '系统管理员',
          role: AdminRole.super_admin,
          status: 1,
        },
      });
    }

    const existing = await this.prisma.adminUser.findFirst({
      where: { username, deletedAt: null },
    });
    if (existing) {
      return existing;
    }

    throw new UnauthorizedException('账号或密码错误');
  }

  private async logListAudit(admin: AuthenticatedAdmin, action: string, request: Request) {
    await this.auditLogService.create({
      actor_type: ActorType.admin,
      actor_id: admin.id,
      action,
      target_type: 'list',
      target_id: null,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? null,
    });
  }

  private toAuditLogItem(item: {
    actorType: ActorType;
    actorId: bigint;
    action: string;
    targetType: string;
    targetId: bigint | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata?: unknown;
    createdAt: Date;
  }) {
    return {
      actor_type: item.actorType,
      actor_id: item.actorId.toString(),
      action: item.action,
      target_type: item.targetType,
      target_id: item.targetId?.toString() ?? null,
      ip_address: item.ipAddress,
      user_agent: item.userAgent,
      metadata: item.metadata ?? null,
      created_at: item.createdAt.toISOString(),
    };
  }

  private async toMediaItem(item: {
    mediaNo: string;
    mediaType: string;
    storageProvider: string;
    bucket: string;
    objectKey: string;
    originalName: string | null;
    mimeType: string | null;
    sizeBytes: bigint | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    status: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const access = item.status === MEDIA_STATUS_READY ? await this.storageService.createAccessUrl(item.objectKey) : null;
    return {
      media_no: item.mediaNo,
      media_type: item.mediaType,
      storage_provider: item.storageProvider,
      bucket: item.bucket,
      object_key: item.objectKey,
      access_url: access?.access_url ?? null,
      original_name: item.originalName,
      mime_type: item.mimeType,
      size_bytes: item.sizeBytes ? Number(item.sizeBytes) : null,
      width: item.width,
      height: item.height,
      duration_seconds: item.durationSeconds,
      status: statusToMediaLabel(item.status),
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private toAiJobItem(item: {
    jobNo: string;
    record?: { recordNo: string } | null;
    requester?: { userNo: string } | null;
    jobType: string;
    provider: string | null;
    status: AiJobStatus;
    errorMessage: string | null;
    retryCount: number;
    createdAt: Date;
  }) {
    return {
      job_no: item.jobNo,
      record_no: item.record?.recordNo ?? null,
      requester_user_no: item.requester?.userNo ?? null,
      job_type: item.jobType,
      provider: item.provider,
      status: item.status,
      error_message: item.errorMessage,
      retry_count: item.retryCount,
      created_at: item.createdAt.toISOString(),
    };
  }
}

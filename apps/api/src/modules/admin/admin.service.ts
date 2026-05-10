import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ActorType, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import {
  getAdminInitialPassword,
  getAdminInitialUsername,
  getJwtAccessSecret,
  isAdminBootstrapAllowed,
} from '../../shared/env-config';
import { AuthenticatedAdmin } from '../../shared/types';
import { ADMIN_ACTIVE_STATUS, USER_ACTIVE_STATUS } from '../../shared/constants';
import { normalizePage, normalizePageSize, statusToChildLabel, statusToRecordLabel, toDateOnly } from '../../shared/utils';
import { AdminListDto } from './dto/admin-list.dto';
import { AdminAuditLogListDto } from './dto/admin-audit-log-list.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';

const USER_DISABLED_STATUS = 2;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
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
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '2h',
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
        status: item.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
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
        before_status: user.status === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        after_status: nextStatus === USER_ACTIVE_STATUS ? 'active' : 'disabled',
        reason: dto.reason ?? null,
      },
    });

    return {
      user_no: updated.userNo,
      status: nextStatus === USER_ACTIVE_STATUS ? 'active' : 'disabled',
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
    const where = dto.keyword
      ? {
          OR: [
            { action: { contains: dto.keyword } },
            { targetType: { contains: dto.keyword } },
          ],
        }
      : {};

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
        created_at: item.createdAt.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
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
}

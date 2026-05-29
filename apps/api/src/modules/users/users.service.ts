import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActorType, ArchiveExportRequestStatus, AuthType, MembershipType, Prisma, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import {
  FAMILY_MEMBER_ACTIVE_STATUS,
  MEDIA_STATUS_READY,
  RECORD_STATUS_PUBLISHED,
  USER_ACTIVE_STATUS,
} from '../../shared/constants';
import { parseMediaReference } from '../../shared/media-reference';
import { AccessControlService } from '../../shared/services/access-control.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { StorageService } from '../../shared/services/storage.service';
import { generateBizNo, maskMobile } from '../../shared/utils';
import { ArchiveExportSummaryDto } from './dto/archive-export-summary.dto';
import { CreateArchiveExportRequestDto } from './dto/create-archive-export-request.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateMembershipBookRequestDto } from './dto/create-membership-book-request.dto';
import { DeleteMeDto } from './dto/delete-me.dto';
import { ListArchiveExportRequestsDto } from './dto/list-archive-export-requests.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateMeDto } from './dto/update-me.dto';

const USER_PREFERENCES_ACTION = 'user.preferences_updated';
const DEFAULT_USER_PREFERENCES = {
  allow_mobile_search: true,
  show_history_to_new_members: true,
};

type AuditRequestMeta = {
  ip_address?: string | null;
  user_agent?: string | null;
};

type UserArchiveExportRequestWithChild = Prisma.ArchiveExportRequestGetPayload<{
  include: {
    child: true;
  };
}>;

const formatArchiveDateTime = (value: Date | null | undefined) => (value ? value.toISOString().replace('T', ' ').slice(0, 19) : '—');

const formatArchiveBytes = (value: bigint | number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  const size = Number(value);
  if (!Number.isFinite(size)) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const safeArchiveFileName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly auditLogService: AuditLogService,
    private readonly storageService: StorageService,
  ) {}

  async me(userId: bigint) {
    const user = await this.findUserOrThrow(userId);
    return this.toUserProfile(user);
  }

  async updateMe(userId: bigint, dto: UpdateMeDto) {
    const user = await this.findUserOrThrow(userId);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        nickname: dto.nickname,
        avatarUrl: dto.avatar_url,
      },
    });

    return this.toUserProfile(updated);
  }

  async preferences(userId: bigint) {
    await this.findUserOrThrow(userId);
    const latest = await this.prisma.auditLog.findFirst({
      where: {
        actorType: ActorType.user,
        actorId: userId,
        action: USER_PREFERENCES_ACTION,
        targetType: 'user',
        targetId: userId,
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, createdAt: true },
    });

    return {
      ...this.toUserPreferences(latest?.metadata),
      updated_at: latest?.createdAt.toISOString() ?? null,
    };
  }

  async updatePreferences(userId: bigint, dto: UpdatePreferencesDto, meta: AuditRequestMeta = {}) {
    const current = await this.preferences(userId);
    const next = {
      allow_mobile_search: dto.allow_mobile_search ?? current.allow_mobile_search,
      show_history_to_new_members: dto.show_history_to_new_members ?? current.show_history_to_new_members,
    };

    const updatedAt = new Date();
    await this.auditLogService.create({
      actor_type: ActorType.user,
      actor_id: userId,
      action: USER_PREFERENCES_ACTION,
      target_type: 'user',
      target_id: userId,
      ip_address: meta.ip_address,
      user_agent: meta.user_agent,
      metadata: next,
    });

    return {
      ...next,
      updated_at: updatedAt.toISOString(),
    };
  }

  async submitFeedback(userId: bigint, dto: CreateFeedbackDto, meta: AuditRequestMeta = {}) {
    const user = await this.findUserOrThrow(userId);
    const ticketNo = generateBizNo('fb');
    const created = await this.prisma.supportTicket.create({
      data: {
        ticketNo,
        userId: user.id,
        category: dto.category,
        topic: dto.topic || null,
        content: dto.content,
        contact: dto.contact || null,
        status: SupportTicketStatus.submitted,
        priority: this.resolveSupportTicketPriority(dto),
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.user,
      actor_id: user.id,
      action: 'user.feedback_submitted',
      target_type: 'support_ticket',
      target_id: created.id,
      ip_address: meta.ip_address,
      user_agent: meta.user_agent,
      metadata: {
        feedback_no: ticketNo,
        ticket_no: ticketNo,
        category: dto.category,
        content: dto.content,
        contact: dto.contact || null,
        topic: dto.topic || null,
        user_no: user.userNo,
        priority: created.priority,
      },
    });

    return {
      feedback_no: ticketNo,
      ticket_no: ticketNo,
      status: 'submitted',
      message: '反馈已提交，客服会在处理后联系你。',
      created_at: created.createdAt.toISOString(),
    };
  }

  async requestMembershipBook(userId: bigint, dto: CreateMembershipBookRequestDto, meta: AuditRequestMeta = {}) {
    const user = await this.findUserOrThrow(userId);
    const requestNo = generateBizNo('book');
    const createdAt = new Date();

    await this.auditLogService.create({
      actor_type: ActorType.user,
      actor_id: user.id,
      action: 'user.membership_book_requested',
      target_type: 'membership_book_request',
      target_id: user.id,
      ip_address: meta.ip_address,
      user_agent: meta.user_agent,
      metadata: {
        request_no: requestNo,
        year: dto.year ?? new Date().getFullYear(),
        contact: dto.contact || null,
        note: dto.note || null,
        user_no: user.userNo,
        membership_type: user.membershipType,
      },
    });

    return {
      request_no: requestNo,
      status: 'submitted',
      message: '纪念册申领已提交，我们会核对会员权益后联系你。',
      created_at: createdAt.toISOString(),
    };
  }

  async requestArchiveExport(userId: bigint, dto: CreateArchiveExportRequestDto, meta: AuditRequestMeta = {}) {
    const user = await this.findUserOrThrow(userId);
    const { child } = await this.accessControlService.ensureChildOwner(userId, dto.child_no);

    const exportType = dto.export_type ?? 'all';
    const purpose = dto.purpose ?? 'backup';
    const requestNo = generateBizNo(purpose === 'adult_handoff' ? 'handoff' : 'export');
    const recordWhere = {
      childId: child.id,
      deletedAt: null,
      status: RECORD_STATUS_PUBLISHED,
    };
    const mediaWhere = {
      childId: child.id,
      deletedAt: null,
      status: MEDIA_STATUS_READY,
    };
    const [recordCount, milestoneCount, mediaCount, firstRecord, latestRecord] = await Promise.all([
      this.prisma.record.count({ where: recordWhere }),
      this.prisma.record.count({ where: { ...recordWhere, isMilestone: true } }),
      this.prisma.recordMedia.count({ where: mediaWhere }),
      this.prisma.record.findFirst({
        where: recordWhere,
        orderBy: { eventTime: 'asc' },
        select: { eventTime: true },
      }),
      this.prisma.record.findFirst({
        where: recordWhere,
        orderBy: { eventTime: 'desc' },
        select: { eventTime: true },
      }),
    ]);
    const created = await this.prisma.archiveExportRequest.create({
      data: {
        requestNo,
        userId: user.id,
        familyId: child.familyId,
        childId: child.id,
        exportType,
        purpose,
        status: ArchiveExportRequestStatus.submitted,
        contact: dto.contact || null,
        note: dto.note || null,
        recordCount,
        milestoneCount,
        mediaCount,
        firstRecordTime: firstRecord?.eventTime ?? null,
        latestRecordTime: latestRecord?.eventTime ?? null,
      },
    });

    await this.auditLogService.create({
      actor_type: ActorType.user,
      actor_id: user.id,
      action: purpose === 'adult_handoff' ? 'user.adult_handoff_requested' : 'user.archive_export_requested',
      target_type: 'archive_export_request',
      target_id: created.id,
      ip_address: meta.ip_address,
      user_agent: meta.user_agent,
      metadata: {
        request_no: requestNo,
        user_no: user.userNo,
        child_no: child.childNo,
        child_name: child.name,
        family_no: child.family.familyNo,
        export_type: exportType,
        purpose,
        contact: dto.contact || null,
        note: dto.note || null,
        snapshot: {
          record_count: recordCount,
          milestone_count: milestoneCount,
          media_count: mediaCount,
          first_record_time: firstRecord?.eventTime.toISOString() ?? null,
          latest_record_time: latestRecord?.eventTime.toISOString() ?? null,
        },
      },
    });

    return {
      request_no: requestNo,
      status: created.status,
      message:
        purpose === 'adult_handoff'
          ? '成年移交准备申请已提交，运营会按档案完整性和身份核验流程协助处理。'
          : '档案打包申请已提交，运营可在审计日志中追踪处理。你也可以先下载本机摘要。',
      created_at: created.createdAt.toISOString(),
      summary: {
        child_no: child.childNo,
        child_name: child.name,
        export_type: exportType,
        purpose,
        record_count: recordCount,
        milestone_count: milestoneCount,
        media_count: mediaCount,
        first_record_time: firstRecord?.eventTime.toISOString() ?? null,
        latest_record_time: latestRecord?.eventTime.toISOString() ?? null,
      },
    };
  }

  async listArchiveExportRequests(userId: bigint, dto: ListArchiveExportRequestsDto) {
    await this.findUserOrThrow(userId);

    let childId: bigint | undefined;
    if (dto.child_no) {
      const child = await this.prisma.child.findFirst({
        where: {
          childNo: dto.child_no,
          deletedAt: null,
          family: {
            deletedAt: null,
            members: {
              some: {
                userId,
                status: FAMILY_MEMBER_ACTIVE_STATUS,
                deletedAt: null,
              },
            },
          },
        },
        select: { id: true },
      });

      if (!child) {
        return { list: [] };
      }

      childId = child.id;
    }

    const list = await this.prisma.archiveExportRequest.findMany({
      where: {
        userId,
        ...(childId ? { childId } : {}),
      },
      include: { child: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      list: list.map((item) => this.toArchiveExportRequestItem(item)),
    };
  }

  async archiveExportSummary(userId: bigint, dto: ArchiveExportSummaryDto, meta: AuditRequestMeta = {}) {
    const user = await this.findUserOrThrow(userId);
    const { child } = await this.accessControlService.ensureChildOwner(userId, dto.child_no);
    const records = await this.prisma.record.findMany({
      where: {
        childId: child.id,
        deletedAt: null,
        status: RECORD_STATUS_PUBLISHED,
      },
      include: {
        creator: true,
        tags: true,
        media: {
          where: {
            deletedAt: null,
            status: MEDIA_STATUS_READY,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { eventTime: 'asc' },
    });
    const generatedAt = new Date();
    const mediaList = records.flatMap((record) => record.media);
    const milestoneCount = records.filter((record) => record.isMilestone).length;
    const lines = [
      '年轮成长档案摘要',
      `生成时间：${formatArchiveDateTime(generatedAt)}`,
      `账号：${user.nickname}（${user.userNo}）`,
      `孩子：${child.name}（${child.childNo}）`,
      `家庭：${child.family.name}（${child.family.familyNo}）`,
      `记录数量：${records.length}`,
      `里程碑数量：${milestoneCount}`,
      `媒体数量：${mediaList.length}`,
      `最早记录：${formatArchiveDateTime(records[0]?.eventTime)}`,
      `最新记录：${formatArchiveDateTime(records[records.length - 1]?.eventTime)}`,
      '',
      '一、记录清单',
      records.length ? '' : '暂无已发布记录。',
    ];

    for (const [index, record] of records.entries()) {
      const tags = record.tags.map((item) => item.tagName).join('、') || '无';
      lines.push(
        `${index + 1}. ${record.title || record.aiGeneratedTitle || '未命名记录'}`,
        `   时间：${formatArchiveDateTime(record.eventTime)}`,
        `   记录人：${record.creator.nickname}`,
        `   地点：${record.locationText || '未填写'}`,
        `   标签：${tags}`,
        `   里程碑：${record.isMilestone ? '是' : '否'}`,
        `   摘要：${record.aiSummary || '未生成'}`,
        `   正文：${(record.contentText || '未填写').replace(/\s+/g, ' ').trim()}`,
        '',
      );
    }

    lines.push('二、媒体清单', mediaList.length ? '' : '暂无可用媒体。');
    for (const [index, media] of mediaList.entries()) {
      lines.push(
        `${index + 1}. ${media.originalName || media.mediaNo}`,
        `   媒体编号：${media.mediaNo}`,
        `   类型：${media.mediaType}`,
        `   MIME：${media.mimeType || '未知'}`,
        `   大小：${formatArchiveBytes(media.sizeBytes)}`,
        `   上传时间：${formatArchiveDateTime(media.createdAt)}`,
        '',
      );
    }

    lines.push('三、交付说明', '本摘要由服务端按当前账号权限生成，并已写入审计日志。高清媒体和完整云端打包仍以正式交付申请处理结果为准。');

    await this.auditLogService.create({
      actor_type: ActorType.user,
      actor_id: user.id,
      action: 'user.archive_summary_downloaded',
      target_type: 'child',
      target_id: child.id,
      ip_address: meta.ip_address,
      user_agent: meta.user_agent,
      metadata: {
        child_no: child.childNo,
        family_no: child.family.familyNo,
        record_count: records.length,
        milestone_count: milestoneCount,
        media_count: mediaList.length,
      },
    });

    return {
      file_name: `年轮-${safeArchiveFileName(child.name)}-档案摘要-${generatedAt.toISOString().slice(0, 10)}.txt`,
      mime_type: 'text/plain;charset=utf-8',
      generated_at: generatedAt.toISOString(),
      summary: {
        child_no: child.childNo,
        child_name: child.name,
        record_count: records.length,
        milestone_count: milestoneCount,
        media_count: mediaList.length,
        first_record_time: records[0]?.eventTime.toISOString() ?? null,
        latest_record_time: records[records.length - 1]?.eventTime.toISOString() ?? null,
      },
      content: `${lines.join('\n')}\n`,
    };
  }

  async deletionCheck(userId: bigint) {
    await this.findUserOrThrow(userId);
    const snapshot = await this.buildDeletionSnapshot(userId);

    return {
      can_delete: snapshot.blockers.length === 0,
      requires_password: true,
      confirm_text: '确认注销',
      blockers: snapshot.blockers,
      summary: {
        owned_family_count: snapshot.ownedFamilies.length,
        joined_family_count: snapshot.joinedFamilies.length,
        active_child_count: snapshot.activeChildCount,
        active_record_count: snapshot.activeRecordCount,
      },
    };
  }

  async deleteMe(userId: bigint, dto: DeleteMeDto) {
    const user = await this.findUserOrThrow(userId);
    await this.verifyDeletePassword(user.id, dto.password);

    const snapshot = await this.buildDeletionSnapshot(user.id);
    if (snapshot.blockers.length > 0) {
      throw new ForbiddenException(snapshot.blockers[0]);
    }

    const deletedAt = new Date();
    const deletionSuffix = deletedAt.getTime().toString(36);
    const sanitizedNickname = `已注销用户-${user.userNo.slice(-6)}`;

    await this.prisma.$transaction(async (tx) => {
      if (snapshot.ownedFamilyIds.length > 0) {
        await tx.aiJob.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds } },
          data: { status: 'cancelled', finishedAt: deletedAt },
        });
        await tx.memberInvite.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds }, status: 1 },
          data: { status: 3 },
        });
        await tx.shareLink.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds }, status: 1 },
          data: { status: 0 },
        });
        await tx.recordMedia.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds }, deletedAt: null },
          data: { deletedAt },
        });
        await tx.record.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds }, deletedAt: null },
          data: { deletedAt },
        });
        await tx.child.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds }, deletedAt: null },
          data: { deletedAt },
        });
        await tx.familyMember.updateMany({
          where: { familyId: { in: snapshot.ownedFamilyIds }, deletedAt: null },
          data: { status: 0, deletedAt },
        });
        await tx.family.updateMany({
          where: { id: { in: snapshot.ownedFamilyIds }, deletedAt: null },
          data: { status: 0, deletedAt },
        });
      }

      if (snapshot.joinedFamilyIds.length > 0) {
        await tx.familyMember.updateMany({
          where: {
            familyId: { in: snapshot.joinedFamilyIds },
            userId: user.id,
            deletedAt: null,
          },
          data: { status: 0, deletedAt },
        });
      }

      const outsideOwnedFamilyWhere = snapshot.ownedFamilyIds.length > 0 ? { familyId: { notIn: snapshot.ownedFamilyIds } } : {};
      await tx.recordMedia.updateMany({
        where: {
          uploaderUserId: user.id,
          deletedAt: null,
          ...outsideOwnedFamilyWhere,
        },
        data: { deletedAt },
      });
      await tx.record.updateMany({
        where: {
          creatorUserId: user.id,
          deletedAt: null,
          ...outsideOwnedFamilyWhere,
        },
        data: { deletedAt },
      });

      await tx.memberInvite.updateMany({
        where: {
          OR: [{ inviterUserId: user.id }, { inviteeUserId: user.id }],
          status: 1,
        },
        data: { status: 3 },
      });

      await tx.shareLink.updateMany({
        where: { creatorUserId: user.id, status: 1 },
        data: { status: 0 },
      });

      await tx.aiJob.updateMany({
        where: { requesterUserId: user.id, status: { in: ['pending', 'processing'] } },
        data: { status: 'cancelled', finishedAt: deletedAt },
      });

      await tx.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: deletedAt },
      });

      const authAccounts = await tx.userAuthAccount.findMany({
        where: { userId: user.id },
        select: { id: true },
      });

      for (const account of authAccounts) {
        await tx.userAuthAccount.update({
          where: { id: account.id },
          data: {
            status: 0,
            credentialHash: null,
            authKey: `deleted:${deletionSuffix}:${account.id.toString()}`,
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          nickname: sanitizedNickname,
          avatarUrl: null,
          mobile: null,
          email: null,
          membershipType: MembershipType.free,
          membershipExpireAt: null,
          status: 0,
          deletedAt,
        },
      });
    });

    try {
      await this.auditLogService.create({
        actor_type: ActorType.user,
        actor_id: user.id,
        action: 'user.account_deleted',
        target_type: 'user',
        target_id: user.id,
        metadata: {
          user_no: user.userNo,
          owned_family_count: snapshot.ownedFamilies.length,
          joined_family_count: snapshot.joinedFamilyIds.length,
          active_child_count: snapshot.activeChildCount,
          active_record_count: snapshot.activeRecordCount,
        },
      });
    } catch (error) {
      this.logger.warn(`Account deletion completed but audit log failed for user ${user.userNo}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: true,
      deleted_at: deletedAt.toISOString(),
      message: '账号已注销，当前设备登录状态将立即失效',
    };
  }

  private async findUserOrThrow(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  private async verifyDeletePassword(userId: bigint, password: string) {
    const passwordAccount = await this.prisma.userAuthAccount.findFirst({
      where: {
        userId,
        authType: AuthType.password,
        status: USER_ACTIVE_STATUS,
      },
    });

    if (!passwordAccount?.credentialHash) {
      throw new BadRequestException('当前账号未配置可校验的登录密码');
    }

    const isValid = await bcrypt.compare(password, passwordAccount.credentialHash);
    if (!isValid) {
      throw new BadRequestException('登录密码不正确');
    }
  }

  private async buildDeletionSnapshot(userId: bigint) {
    const [ownedFamilies, joinedFamilies, activeChildCount, activeRecordCount] = await Promise.all([
      this.prisma.family.findMany({
        where: { ownerUserId: userId, deletedAt: null },
        include: {
          members: {
            where: { status: USER_ACTIVE_STATUS, deletedAt: null },
            include: { user: true },
          },
        },
      }),
      this.prisma.familyMember.findMany({
        where: {
          userId,
          status: USER_ACTIVE_STATUS,
          deletedAt: null,
          family: { deletedAt: null },
        },
        include: { family: true },
      }),
      this.prisma.child.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
        },
      }),
      this.prisma.record.count({
        where: {
          creatorUserId: userId,
          deletedAt: null,
        },
      }),
    ]);

    const ownedFamilyIds = ownedFamilies.map((family) => family.id);
    const joinedFamilyIds = joinedFamilies
      .map((membership) => membership.familyId)
      .filter((familyId) => !ownedFamilyIds.includes(familyId));
    const joinedFamiliesOutsideOwnership = joinedFamilies.filter((membership) => !ownedFamilyIds.includes(membership.familyId));
    const blockers = ownedFamilies
      .filter((family) => family.members.some((member) => member.userId !== userId && member.user.deletedAt === null))
      .map((family) => `请先处理家庭「${family.name ?? family.familyNo}」中的其他成员，再注销账号`);

    return {
      ownedFamilies,
      joinedFamilies: joinedFamiliesOutsideOwnership,
      ownedFamilyIds,
      joinedFamilyIds,
      activeChildCount,
      activeRecordCount,
      blockers,
    };
  }

  private toUserPreferences(metadata?: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return DEFAULT_USER_PREFERENCES;
    }

    const value = metadata as Record<string, unknown>;
    return {
      allow_mobile_search:
        typeof value.allow_mobile_search === 'boolean'
          ? value.allow_mobile_search
          : DEFAULT_USER_PREFERENCES.allow_mobile_search,
      show_history_to_new_members:
        typeof value.show_history_to_new_members === 'boolean'
          ? value.show_history_to_new_members
          : DEFAULT_USER_PREFERENCES.show_history_to_new_members,
    };
  }

  private resolveSupportTicketPriority(dto: CreateFeedbackDto) {
    const text = `${dto.category} ${dto.topic ?? ''} ${dto.content}`.toLowerCase();
    if (dto.topic === 'account-delete' || /儿童|未成年|隐私|安全|注销|删除|泄露/.test(text)) {
      return SupportTicketPriority.child_safety;
    }

    if (/数据异常|无法登录|导出|付款|崩溃|丢失/.test(text)) {
      return SupportTicketPriority.urgent;
    }

    return SupportTicketPriority.normal;
  }

  private toArchiveExportRequestItem(item: UserArchiveExportRequestWithChild) {
    return {
      request_no: item.requestNo,
      child_no: item.child.childNo,
      child_name: item.child.name,
      export_type: item.exportType,
      purpose: item.purpose,
      status: item.status,
      record_count: item.recordCount,
      milestone_count: item.milestoneCount,
      media_count: item.mediaCount,
      first_record_time: item.firstRecordTime?.toISOString() ?? null,
      latest_record_time: item.latestRecordTime?.toISOString() ?? null,
      processed_at: item.processedAt?.toISOString() ?? null,
      process_note: item.processNote,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  private async resolveAvatarUrl(userId: bigint, avatarUrl: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return avatarUrl;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        uploaderUserId: userId,
        status: MEDIA_STATUS_READY,
      },
      select: { objectKey: true },
    });
    if (!media) return null;

    try {
      return (await this.storageService.createAccessUrl(media.objectKey)).access_url;
    } catch {
      return null;
    }
  }

  private async toUserProfile(user: {
    id: bigint;
    userNo: string;
    nickname: string;
    avatarUrl: string | null;
    mobile: string | null;
    membershipType: string;
    membershipExpireAt: Date | null;
    createdAt: Date;
  }) {
    return {
      user_no: user.userNo,
      nickname: user.nickname,
      avatar_url: await this.resolveAvatarUrl(user.id, user.avatarUrl),
      mobile: maskMobile(user.mobile),
      membership_type: user.membershipType,
      membership_expire_at: user.membershipExpireAt?.toISOString() ?? null,
      created_at: user.createdAt.toISOString(),
    };
  }
}

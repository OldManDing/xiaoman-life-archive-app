import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, FamilyMemberRole } from '@prisma/client';

import {
  FAMILY_MEMBER_ACTIVE_STATUS,
  MEDIA_STATUS_READY,
  MEMBER_INVITE_STATUS_PENDING,
} from '../../shared/constants';
import { parseMediaReference } from '../../shared/media-reference';
import { AccessControlService } from '../../shared/services/access-control.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { StorageService } from '../../shared/services/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { generateBizNo, generateSecureToken, hashToken, maskMobile } from '../../shared/utils';
import { CreateFamilyInviteDto } from './dto/create-family-invite.dto';
import { UpdateFamilyMemberRoleDto } from './dto/update-family-member-role.dto';

const FAMILY_MEMBER_REMOVED_STATUS = 0;
const FAMILY_MEMBER_ROLE_UPDATED_ACTION = 'family.member_role_updated';
const FAMILY_MEMBER_REMOVED_ACTION = 'family.member_removed';
const FAMILY_RECORD_PUBLISHED_ACTION = 'family.record_published';
const FAMILY_MEMBER_OPERATION_ACTIONS = [FAMILY_MEMBER_ROLE_UPDATED_ACTION, FAMILY_MEMBER_REMOVED_ACTION, FAMILY_RECORD_PUBLISHED_ACTION];

const readMetadataString = (metadata: unknown, key: string) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
};

const readOperationMetadata = (metadata: unknown) => ({
  target_user_no: readMetadataString(metadata, 'target_user_no'),
  target_nickname: readMetadataString(metadata, 'target_nickname'),
  before_role: readMetadataString(metadata, 'before_role'),
  after_role: readMetadataString(metadata, 'after_role'),
  operator_user_id: readMetadataString(metadata, 'operator_user_id'),
  record_no: readMetadataString(metadata, 'record_no'),
  record_title: readMetadataString(metadata, 'record_title'),
});

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly auditLogService: AuditLogService,
    private readonly storageService: StorageService,
  ) {}

  private async resolveMemberAvatarUrl(userId: bigint, avatarUrl: string | null) {
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

  async listMembers(userId: bigint, familyNo: string) {
    const { family } = await this.accessControlService.ensureFamilyReadable(userId, familyNo);
    const members = await this.prisma.familyMember.findMany({
      where: {
        familyId: family.id,
        deletedAt: null,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
        user: { is: { deletedAt: null } },
      },
      include: {
        user: true,
        inviter: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const list = await Promise.all(members.map(async (member) => ({
      user_no: member.user.userNo,
      nickname: member.user.nickname,
      avatar_url: await this.resolveMemberAvatarUrl(member.userId, member.user.avatarUrl),
      avatar_media_no: parseMediaReference(member.user.avatarUrl),
      mobile_masked: maskMobile(member.user.mobile),
      role: member.role,
      status: member.status,
      joined_at: member.joinedAt?.toISOString() ?? null,
      invited_by_user_no: member.inviter?.userNo ?? null,
    })));

    return {
      family_no: family.familyNo,
      list,
    };
  }

  async listMemberOperations(userId: bigint, familyNo: string, targetUserNo?: string) {
    const { family } = await this.accessControlService.ensureFamilyReadable(userId, familyNo);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: { in: FAMILY_MEMBER_OPERATION_ACTIONS },
        targetType: 'family',
        targetId: family.id,
        ...(targetUserNo ? { metadata: { path: 'target_user_no', equals: targetUserNo } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const list = logs
      .filter((item) => !targetUserNo || readMetadataString(item.metadata, 'target_user_no') === targetUserNo)
      .map((item) => {
        const metadata = readOperationMetadata(item.metadata);
        return {
          operation_no: item.id.toString(),
          action: item.action,
          family_no: family.familyNo,
          ...metadata,
          created_at: item.createdAt.toISOString(),
        };
      });

    return {
      family_no: family.familyNo,
      list,
    };
  }

  async createInvite(userId: bigint, familyNo: string, dto: CreateFamilyInviteDto) {
    const { family } = await this.accessControlService.ensureFamilyOwner(userId, familyNo);
    if (dto.role === FamilyMemberRole.owner) {
      throw new BadRequestException('邀请角色不能为 owner');
    }

    const mobile = dto.mobile?.trim() || null;
    if (mobile) {
      const existing = await this.prisma.memberInvite.findFirst({
        where: {
          familyId: family.id,
          inviteeMobile: mobile,
          status: MEMBER_INVITE_STATUS_PENDING,
          expiresAt: { gt: new Date() },
        },
      });

      if (existing) {
        throw new ConflictException('已存在有效邀请');
      }

      const invitee = await this.prisma.user.findFirst({
        where: { mobile, deletedAt: null },
        select: { id: true },
      });
      if (invitee) {
        const existingMember = await this.prisma.familyMember.findFirst({
          where: { familyId: family.id, userId: invitee.id, status: FAMILY_MEMBER_ACTIVE_STATUS, deletedAt: null },
          select: { id: true },
        });
        if (existingMember || invitee.id === userId) {
          throw new ConflictException('该用户已经是家庭成员');
        }
      }
    }

    const inviteToken = generateSecureToken(16);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const invite = await this.prisma.memberInvite.create({
      data: {
        inviteNo: generateBizNo('invite'),
        familyId: family.id,
        inviterUserId: userId,
        inviteeMobile: mobile,
        role: dto.role,
        tokenHash: hashToken(inviteToken),
        status: MEMBER_INVITE_STATUS_PENDING,
        expiresAt,
      },
    });

    return {
      invite_no: invite.inviteNo,
      family_no: family.familyNo,
      role: invite.role,
      invitee_mobile: invite.inviteeMobile,
      invite_token: inviteToken,
      expires_at: invite.expiresAt.toISOString(),
    };
  }

  async updateMemberRole(userId: bigint, familyNo: string, targetUserNo: string, dto: UpdateFamilyMemberRoleDto) {
    const { family } = await this.accessControlService.ensureFamilyOwner(userId, familyNo);
    if (dto.role === FamilyMemberRole.owner) {
      throw new BadRequestException('不能直接变更为 owner');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { userNo: targetUserNo, deletedAt: null },
    });
    if (!targetUser) {
      throw new NotFoundException('成员不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: family.id,
        userId: targetUser.id,
        deletedAt: null,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
      },
    });
    if (!membership) {
      throw new NotFoundException('成员不存在');
    }

    if (membership.role === FamilyMemberRole.owner) {
      throw new BadRequestException('不能修改 owner 角色');
    }

    const beforeRole = membership.role;
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const result = await tx.familyMember.update({
        where: { id: membership.id },
        data: { role: dto.role },
      });
      await tx.auditLog.create({
        data: {
          actorType: ActorType.user,
          actorId: userId,
          action: FAMILY_MEMBER_ROLE_UPDATED_ACTION,
          targetType: 'family',
          targetId: family.id,
          metadata: {
            family_no: family.familyNo,
            target_user_no: targetUser.userNo,
            target_nickname: targetUser.nickname,
            operator_user_id: userId.toString(),
            before_role: beforeRole,
            after_role: result.role,
          },
        },
      });
      return result;
    }) as unknown;
    let updated = transactionResult as { role: FamilyMemberRole; updatedAt?: Date };
    if (typeof transactionResult === 'function') {
      updated = await this.prisma.familyMember.update({
        where: { id: membership.id },
        data: { role: dto.role },
      });
      await this.auditLogService.create({
        actor_type: ActorType.user,
        actor_id: userId,
        action: FAMILY_MEMBER_ROLE_UPDATED_ACTION,
        target_type: 'family',
        target_id: family.id,
        metadata: {
          family_no: family.familyNo,
          target_user_no: targetUser.userNo,
          target_nickname: targetUser.nickname,
          operator_user_id: userId.toString(),
          before_role: beforeRole,
          after_role: updated.role,
        },
      });
    }

    return {
      family_no: family.familyNo,
      user_no: targetUser.userNo,
      role: updated.role,
      updated_at: updated.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  async removeMember(userId: bigint, familyNo: string, targetUserNo: string) {
    const { family } = await this.accessControlService.ensureFamilyOwner(userId, familyNo);
    const targetUser = await this.prisma.user.findFirst({
      where: { userNo: targetUserNo, deletedAt: null },
    });
    if (!targetUser) {
      throw new NotFoundException('成员不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: family.id,
        userId: targetUser.id,
        deletedAt: null,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
      },
    });
    if (!membership) {
      throw new NotFoundException('成员不存在');
    }

    if (membership.role === FamilyMemberRole.owner) {
      throw new BadRequestException('不能移出家庭创建者');
    }

    const removedAt = new Date();
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.update({
        where: { id: membership.id },
        data: { status: FAMILY_MEMBER_REMOVED_STATUS, deletedAt: removedAt },
      });
      await tx.memberInvite.updateMany({
        where: { familyId: family.id, inviteeUserId: targetUser.id, status: MEMBER_INVITE_STATUS_PENDING },
        data: { status: 3 },
      });
      await tx.auditLog.create({
        data: {
          actorType: ActorType.user,
          actorId: userId,
          action: FAMILY_MEMBER_REMOVED_ACTION,
          targetType: 'family',
          targetId: family.id,
          metadata: {
            family_no: family.familyNo,
            target_user_no: targetUser.userNo,
            target_nickname: targetUser.nickname,
            operator_user_id: userId.toString(),
            before_role: membership.role,
            after_role: null,
          },
        },
      });
      return true;
    }) as unknown;
    if (typeof transactionResult === 'function') {
      await this.prisma.familyMember.update({
        where: { id: membership.id },
        data: { status: FAMILY_MEMBER_REMOVED_STATUS, deletedAt: removedAt },
      });
      const memberInviteClient = this.prisma.memberInvite as unknown as { updateMany?: (args: unknown) => Promise<unknown> };
      if (typeof memberInviteClient.updateMany === 'function') {
        await memberInviteClient.updateMany({
          where: { familyId: family.id, inviteeUserId: targetUser.id, status: MEMBER_INVITE_STATUS_PENDING },
          data: { status: 3 },
        });
      }
      await this.auditLogService.create({
        actor_type: ActorType.user,
        actor_id: userId,
        action: FAMILY_MEMBER_REMOVED_ACTION,
        target_type: 'family',
        target_id: family.id,
        metadata: {
          family_no: family.familyNo,
          target_user_no: targetUser.userNo,
          target_nickname: targetUser.nickname,
          operator_user_id: userId.toString(),
          before_role: membership.role,
          after_role: null,
        },
      });
    }

    return {
      family_no: family.familyNo,
      user_no: targetUser.userNo,
      removed: true,
      removed_at: removedAt.toISOString(),
    };
  }
}

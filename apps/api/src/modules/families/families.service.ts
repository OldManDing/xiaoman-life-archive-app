import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyMemberRole } from '@prisma/client';

import {
  FAMILY_MEMBER_ACTIVE_STATUS,
  MEMBER_INVITE_STATUS_ACCEPTED,
  MEMBER_INVITE_STATUS_PENDING,
} from '../../shared/constants';
import { AccessControlService } from '../../shared/services/access-control.service';
import { PrismaService } from '../../prisma/prisma.service';
import { generateBizNo, generateSecureToken, hashToken, maskMobile } from '../../shared/utils';
import { CreateFamilyInviteDto } from './dto/create-family-invite.dto';
import { UpdateFamilyMemberRoleDto } from './dto/update-family-member-role.dto';

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
  ) {}

  async listMembers(userId: bigint, familyNo: string) {
    const { family } = await this.accessControlService.ensureFamilyReadable(userId, familyNo);
    const members = await this.prisma.familyMember.findMany({
      where: {
        familyId: family.id,
        deletedAt: null,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
      },
      include: {
        user: true,
        inviter: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      family_no: family.familyNo,
      list: members.map((member) => ({
        user_no: member.user.userNo,
        nickname: member.user.nickname,
        mobile_masked: maskMobile(member.user.mobile),
        role: member.role,
        status: member.status,
        joined_at: member.joinedAt?.toISOString() ?? null,
        invited_by_user_no: member.inviter?.userNo ?? null,
      })),
    };
  }

  async createInvite(userId: bigint, familyNo: string, dto: CreateFamilyInviteDto) {
    const { family } = await this.accessControlService.ensureFamilyOwner(userId, familyNo);
    if (dto.role === FamilyMemberRole.owner) {
      throw new BadRequestException('邀请角色不能为 owner');
    }

    if (dto.mobile) {
      const existing = await this.prisma.memberInvite.findFirst({
        where: {
          familyId: family.id,
          inviteeMobile: dto.mobile,
          status: MEMBER_INVITE_STATUS_PENDING,
          expiresAt: { gt: new Date() },
        },
      });

      if (existing) {
        throw new ConflictException('已存在有效邀请');
      }
    }

    const inviteToken = generateSecureToken(16);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const invite = await this.prisma.memberInvite.create({
      data: {
        inviteNo: generateBizNo('invite'),
        familyId: family.id,
        inviterUserId: userId,
        inviteeMobile: dto.mobile ?? null,
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

  async acceptInvite(userId: bigint, inviteToken: string) {
    const invite = await this.prisma.memberInvite.findFirst({
      where: { tokenHash: hashToken(inviteToken) },
      include: {
        family: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('邀请不存在');
    }

    if (invite.status !== MEMBER_INVITE_STATUS_PENDING || invite.expiresAt <= new Date()) {
      throw new BadRequestException('邀请已失效');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (invite.inviteeMobile && user.mobile !== invite.inviteeMobile) {
      throw new ForbiddenException('当前账号与邀请手机号不匹配');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.upsert({
        where: {
          familyId_userId: {
            familyId: invite.familyId,
            userId,
          },
        },
        create: {
          familyId: invite.familyId,
          userId,
          role: invite.role,
          status: FAMILY_MEMBER_ACTIVE_STATUS,
          inviterUserId: invite.inviterUserId,
          joinedAt: now,
        },
        update: {
          role: invite.role,
          status: FAMILY_MEMBER_ACTIVE_STATUS,
          inviterUserId: invite.inviterUserId,
          joinedAt: now,
          deletedAt: null,
        },
      });

      await tx.memberInvite.update({
        where: { id: invite.id },
        data: {
          status: MEMBER_INVITE_STATUS_ACCEPTED,
          inviteeUserId: userId,
          acceptedAt: now,
        },
      });
    });

    return {
      family_no: invite.family.familyNo,
      role: invite.role,
      accepted_at: now.toISOString(),
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

    const updated = await this.prisma.familyMember.update({
      where: { id: membership.id },
      data: { role: dto.role },
    });

    return {
      family_no: family.familyNo,
      user_no: targetUser.userNo,
      role: updated.role,
      updated_at: updated.updatedAt.toISOString(),
    };
  }
}

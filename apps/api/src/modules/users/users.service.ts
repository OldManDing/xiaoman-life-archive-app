import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActorType, AuthType, MembershipType } from '@prisma/client';
import bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { USER_ACTIVE_STATUS } from '../../shared/constants';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { maskMobile } from '../../shared/utils';
import { DeleteMeDto } from './dto/delete-me.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
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

  private toUserProfile(user: {
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
      avatar_url: user.avatarUrl,
      mobile: maskMobile(user.mobile),
      membership_type: user.membershipType,
      membership_expire_at: user.membershipExpireAt?.toISOString() ?? null,
      created_at: user.createdAt.toISOString(),
    };
  }
}

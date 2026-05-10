import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyMemberRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { FAMILY_MEMBER_ACTIVE_STATUS, MEDIA_STATUS_READY } from '../constants';

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureFamilyReadable(userId: bigint, familyNo: string) {
    const family = await this.prisma.family.findFirst({
      where: { familyNo, deletedAt: null },
    });

    if (!family) {
      throw new NotFoundException('家庭不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: family.id,
        userId,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('无权限访问该家庭');
    }

    return { family, membership };
  }

  async ensureFamilyOwner(userId: bigint, familyNo: string) {
    const { family, membership } = await this.ensureFamilyReadable(userId, familyNo);
    if (membership.role !== FamilyMemberRole.owner) {
      throw new ForbiddenException('仅 owner 可操作');
    }
    return { family, membership };
  }

  async ensureChildReadable(userId: bigint, childNo: string) {
    const child = await this.prisma.child.findFirst({
      where: { childNo, deletedAt: null },
      include: { family: true },
    });

    if (!child) {
      throw new NotFoundException('孩子不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: child.familyId,
        userId,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('无权限访问该孩子');
    }

    return { child, membership };
  }

  async ensureChildOwner(userId: bigint, childNo: string) {
    const { child, membership } = await this.ensureChildReadable(userId, childNo);
    if (membership.role !== FamilyMemberRole.owner) {
      throw new ForbiddenException('仅 owner 可操作');
    }
    return { child, membership };
  }

  async ensureRecordReadable(userId: bigint, recordNo: string) {
    const record = await this.prisma.record.findFirst({
      where: { recordNo, deletedAt: null },
      include: {
        child: true,
        creator: true,
        media: { where: { status: MEDIA_STATUS_READY, deletedAt: null } },
        tags: true,
      },
    });

    if (!record) {
      throw new NotFoundException('记录不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: record.familyId,
        userId,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('无权限访问该记录');
    }

    return { record, membership };
  }

  async ensureRecordEditable(userId: bigint, recordNo: string) {
    const { record, membership } = await this.ensureRecordReadable(userId, recordNo);
    const isOwner = membership.role === FamilyMemberRole.owner;
    const isOwnRecord = record.creatorUserId === userId;
    const isEditor = membership.role === FamilyMemberRole.editor;

    if (!isOwner && !(isEditor && isOwnRecord)) {
      throw new ForbiddenException('无权限编辑该记录');
    }

    return { record, membership };
  }

  async ensureMediaReadable(userId: bigint, mediaNo: string) {
    const media = await this.prisma.recordMedia.findFirst({
      where: { mediaNo, deletedAt: null },
      include: { child: true },
    });

    if (!media) {
      throw new NotFoundException('媒体不存在');
    }

    const membership = await this.prisma.familyMember.findFirst({
      where: {
        familyId: media.familyId,
        userId,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('无权限访问该媒体');
    }

    return { media, membership };
  }
}

import { Injectable } from '@nestjs/common';
import { ChildGender, FamilyMemberRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CHILD_STATUS_NORMAL,
  FAMILY_MEMBER_ACTIVE_STATUS,
  MEDIA_STATUS_READY,
  USER_ACTIVE_STATUS,
} from '../../shared/constants';
import { parseMediaReference } from '../../shared/media-reference';
import { AccessControlService } from '../../shared/services/access-control.service';
import { StorageService } from '../../shared/services/storage.service';
import { ageDisplay, generateBizNo, statusToChildLabel, toDateOnly } from '../../shared/utils';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly storageService: StorageService,
  ) {}

  private async resolveAvatarUrl(childId: bigint, avatarUrl: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return avatarUrl;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        childId,
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

  async create(userId: bigint, dto: CreateChildDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const family = await this.prisma.$transaction(async (tx) => {
      const existingFamily = await tx.family.findFirst({
        where: { ownerUserId: userId, deletedAt: null },
      });

      if (existingFamily) {
        return existingFamily;
      }

      const createdFamily = await tx.family.create({
        data: {
          familyNo: generateBizNo('f'),
          ownerUserId: userId,
          name: `${user.nickname}的家庭`,
          status: USER_ACTIVE_STATUS,
        },
      });

      await tx.familyMember.create({
        data: {
          familyId: createdFamily.id,
          userId,
          role: FamilyMemberRole.owner,
          status: FAMILY_MEMBER_ACTIVE_STATUS,
          joinedAt: new Date(),
        },
      });

      return createdFamily;
    });

    const child = await this.prisma.child.create({
      data: {
        childNo: generateBizNo('c'),
        familyId: family.id,
        ownerUserId: userId,
        name: dto.name,
        avatarUrl: dto.avatar_url,
        birthday: new Date(dto.birthday),
        gender: dto.gender ?? ChildGender.unknown,
        birthPlace: dto.birth_place,
        remark: dto.remark,
        status: CHILD_STATUS_NORMAL,
      },
    });

    return {
      child_no: child.childNo,
      family_no: family.familyNo,
      owner_user_no: user.userNo,
      name: child.name,
      avatar_url: await this.resolveAvatarUrl(child.id, child.avatarUrl),
      birthday: toDateOnly(child.birthday),
      gender: child.gender,
      birth_place: child.birthPlace,
      remark: child.remark,
      current_age_display: ageDisplay(child.birthday),
      status: statusToChildLabel(child.status, child.deletedAt),
      created_at: child.createdAt.toISOString(),
      updated_at: child.updatedAt.toISOString(),
    };
  }

  async list(userId: bigint) {
    const children = await this.prisma.child.findMany({
      where: {
        deletedAt: null,
        family: {
          members: {
            some: {
              userId,
              status: FAMILY_MEMBER_ACTIVE_STATUS,
              deletedAt: null,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { owner: true },
    });

    return {
      list: await Promise.all(children.map(async (child) => ({
        child_no: child.childNo,
        owner_user_no: child.owner.userNo,
        name: child.name,
        avatar_url: await this.resolveAvatarUrl(child.id, child.avatarUrl),
        birthday: toDateOnly(child.birthday),
        gender: child.gender,
        birth_place: child.birthPlace,
        remark: child.remark,
        current_age_display: ageDisplay(child.birthday),
        status: statusToChildLabel(child.status, child.deletedAt),
        created_at: child.createdAt.toISOString(),
        updated_at: child.updatedAt.toISOString(),
      }))),
    };
  }

  async detail(userId: bigint, childNo: string) {
    const { child } = await this.accessControlService.ensureChildReadable(userId, childNo);
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: child.ownerUserId } });
    const family = await this.prisma.family.findUniqueOrThrow({ where: { id: child.familyId } });

    return {
      child_no: child.childNo,
      family_no: family.familyNo,
      owner_user_no: owner.userNo,
      name: child.name,
      avatar_url: await this.resolveAvatarUrl(child.id, child.avatarUrl),
      birthday: toDateOnly(child.birthday),
      gender: child.gender,
      birth_place: child.birthPlace,
      remark: child.remark,
      current_age_display: ageDisplay(child.birthday),
      status: statusToChildLabel(child.status, child.deletedAt),
      created_at: child.createdAt.toISOString(),
      updated_at: child.updatedAt.toISOString(),
    };
  }

  async update(userId: bigint, childNo: string, dto: UpdateChildDto) {
    const { child } = await this.accessControlService.ensureChildOwner(userId, childNo);
    const updated = await this.prisma.child.update({
      where: { id: child.id },
      data: {
        name: dto.name,
        avatarUrl: dto.avatar_url,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        gender: dto.gender,
        birthPlace: dto.birth_place,
        remark: dto.remark,
      },
      include: { owner: true, family: true },
    });

    return {
      child_no: updated.childNo,
      family_no: updated.family.familyNo,
      owner_user_no: updated.owner.userNo,
      name: updated.name,
      avatar_url: await this.resolveAvatarUrl(updated.id, updated.avatarUrl),
      birthday: toDateOnly(updated.birthday),
      gender: updated.gender,
      birth_place: updated.birthPlace,
      remark: updated.remark,
      current_age_display: ageDisplay(updated.birthday),
      status: statusToChildLabel(updated.status, updated.deletedAt),
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    };
  }
}

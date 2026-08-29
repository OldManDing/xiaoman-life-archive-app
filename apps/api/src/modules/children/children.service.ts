import { BadRequestException, Injectable } from '@nestjs/common';
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

  private assertBirthdayInRange(birthday: string | undefined) {
    if (!birthday) return;
    const parsed = new Date(birthday);
    if (Number.isNaN(parsed.getTime())) return;

    const today = new Date();
    const tomorrowUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1);
    const earliestUtc = Date.UTC(today.getUTCFullYear() - 30, today.getUTCMonth(), today.getUTCDate());
    const birthdayUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());

    if (birthdayUtc >= tomorrowUtc) {
      throw new BadRequestException('生日不能晚于今天');
    }

    if (birthdayUtc < earliestUtc) {
      throw new BadRequestException('孩子生日超出可维护范围');
    }
  }

  private async assertAvatarBelongsToChild(childId: bigint, avatarUrl?: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        childId,
        status: MEDIA_STATUS_READY,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!media) {
      throw new BadRequestException('头像媒体不存在或不属于当前孩子');
    }
  }

  private async assertMediaReferenceBelongsToChild(childId: bigint, value?: string | null) {
    const mediaNo = parseMediaReference(value);
    if (!mediaNo) return;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        childId,
        status: MEDIA_STATUS_READY,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!media) {
      throw new BadRequestException('媒体不存在或不属于当前孩子');
    }
  }

  private assertAvatarUsableOnCreate(avatarUrl?: string | null) {
    if (!parseMediaReference(avatarUrl)) return;
    throw new BadRequestException('请先创建孩子档案后再上传头像');
  }

  private assertMediaReferenceUsableOnCreate(value?: string | null) {
    if (!parseMediaReference(value)) return;
    throw new BadRequestException('请先创建孩子档案后再上传并绑定媒体');
  }

  private async resolveAvatarUrl(childId: bigint, avatarUrl: string | null) {
    const mediaNo = parseMediaReference(avatarUrl);
    if (!mediaNo) return avatarUrl;

    const media = await this.prisma.recordMedia.findFirst({
      where: {
        mediaNo,
        childId,
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

  private normalizeInterestTags(tags?: string[] | null) {
    if (!tags) return undefined;
    return Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean))).slice(0, 12);
  }

  private async toChildPayload(child: {
    id: bigint;
    childNo: string;
    family: { familyNo: string };
    owner: { userNo: string };
    name: string;
    avatarUrl: string | null;
    coverUrl?: string | null;
    nickname?: string | null;
    birthday: Date;
    gender: ChildGender;
    birthPlace: string | null;
    birthHospital?: string | null;
    heightCm?: unknown;
    weightKg?: unknown;
    interestTags?: unknown;
    privacyNote?: string | null;
    remark: string | null;
    status: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      child_no: child.childNo,
      family_no: child.family.familyNo,
      owner_user_no: child.owner.userNo,
      name: child.name,
      nickname: child.nickname ?? null,
      avatar_url: await this.resolveAvatarUrl(child.id, child.avatarUrl),
      avatar_media_no: parseMediaReference(child.avatarUrl),
      cover_url: await this.resolveAvatarUrl(child.id, child.coverUrl ?? null),
      cover_media_no: parseMediaReference(child.coverUrl),
      birthday: toDateOnly(child.birthday),
      gender: child.gender,
      birth_place: child.birthPlace,
      birth_hospital: child.birthHospital ?? null,
      height_cm: child.heightCm === null || child.heightCm === undefined ? null : Number(child.heightCm),
      weight_kg: child.weightKg === null || child.weightKg === undefined ? null : Number(child.weightKg),
      interest_tags: Array.isArray(child.interestTags) ? child.interestTags : [],
      privacy_note: child.privacyNote ?? null,
      remark: child.remark,
      current_age_display: ageDisplay(child.birthday),
      status: statusToChildLabel(child.status, child.deletedAt),
      created_at: child.createdAt.toISOString(),
      updated_at: child.updatedAt.toISOString(),
    };
  }

  async create(userId: bigint, dto: CreateChildDto) {
    this.assertBirthdayInRange(dto.birthday);
    this.assertAvatarUsableOnCreate(dto.avatar_url);
    this.assertMediaReferenceUsableOnCreate(dto.cover_url);
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
        name: dto.name.trim(),
        avatarUrl: dto.avatar_url,
        coverUrl: dto.cover_url,
        nickname: dto.nickname === undefined ? undefined : dto.nickname.trim() || null,
        birthday: new Date(dto.birthday),
        gender: dto.gender ?? ChildGender.unknown,
        birthPlace: dto.birth_place === undefined ? undefined : dto.birth_place.trim() || null,
        birthHospital: dto.birth_hospital === undefined ? undefined : dto.birth_hospital.trim() || null,
        heightCm: dto.height_cm,
        weightKg: dto.weight_kg,
        interestTags: this.normalizeInterestTags(dto.interest_tags),
        privacyNote: dto.privacy_note === undefined ? undefined : dto.privacy_note.trim() || null,
        remark: dto.remark === undefined ? undefined : dto.remark.trim() || null,
        status: CHILD_STATUS_NORMAL,
      },
      include: { owner: true, family: true },
    });
    return this.toChildPayload(child);
  }

  async list(userId: bigint) {
    const children = await this.prisma.child.findMany({
      where: {
        deletedAt: null,
        family: {
          status: USER_ACTIVE_STATUS,
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
      orderBy: { createdAt: 'desc' },
      include: { owner: true, family: true },
    });

    return {
      list: await Promise.all(children.map((child) => this.toChildPayload(child))),
    };
  }

  async detail(userId: bigint, childNo: string) {
    const { child } = await this.accessControlService.ensureChildReadable(userId, childNo);
    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: child.ownerUserId } });
    const family = await this.prisma.family.findUniqueOrThrow({ where: { id: child.familyId } });

    return this.toChildPayload({ ...child, owner, family });
  }

  async update(userId: bigint, childNo: string, dto: UpdateChildDto) {
    const { child } = await this.accessControlService.ensureChildOwner(userId, childNo);
    this.assertBirthdayInRange(dto.birthday);
    await this.assertAvatarBelongsToChild(child.id, dto.avatar_url);
    await this.assertMediaReferenceBelongsToChild(child.id, dto.cover_url);
    const updated = await this.prisma.child.update({
      where: { id: child.id },
      data: {
        name: dto.name === undefined ? undefined : dto.name.trim(),
        avatarUrl: dto.avatar_url === undefined ? undefined : dto.avatar_url.trim() || null,
        coverUrl: dto.cover_url === undefined ? undefined : dto.cover_url.trim() || null,
        nickname: dto.nickname === undefined ? undefined : dto.nickname.trim() || null,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        gender: dto.gender,
        birthPlace: dto.birth_place === undefined ? undefined : dto.birth_place.trim() || null,
        birthHospital: dto.birth_hospital === undefined ? undefined : dto.birth_hospital.trim() || null,
        heightCm: dto.height_cm,
        weightKg: dto.weight_kg,
        interestTags: dto.interest_tags === undefined ? undefined : this.normalizeInterestTags(dto.interest_tags),
        privacyNote: dto.privacy_note === undefined ? undefined : dto.privacy_note.trim() || null,
        remark: dto.remark === undefined ? undefined : dto.remark.trim() || null,
      },
      include: { owner: true, family: true },
    });

    return this.toChildPayload(updated);
  }
}

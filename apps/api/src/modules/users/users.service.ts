import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { maskMobile } from '../../shared/utils';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async findUserOrThrow(userId: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
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

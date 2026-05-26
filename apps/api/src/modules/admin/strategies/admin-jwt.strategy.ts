import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import { ADMIN_ACTIVE_STATUS } from '../../../shared/constants';
import { getJwtAccessSecret } from '../../../shared/env-config';
import { AdminJwtPayload } from '../../../shared/types';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(),
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('后台登录状态无效');
    }

    let adminId: bigint;
    try {
      adminId = BigInt(payload.sub);
    } catch {
      throw new UnauthorizedException('后台登录状态无效');
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId, status: ADMIN_ACTIVE_STATUS, deletedAt: null },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      display_name: admin.displayName,
    };
  }
}

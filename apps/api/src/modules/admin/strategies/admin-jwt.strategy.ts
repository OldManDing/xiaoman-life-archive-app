import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import { ADMIN_ACTIVE_STATUS } from '../../../shared/constants';
import { getAdminJwtAccessSecret } from '../../../shared/env-config';
import { AdminJwtPayload } from '../../../shared/types';
import { hashToken } from '../../../shared/utils';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getAdminJwtAccessSecret(),
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

    if (!payload.jti) {
      throw new UnauthorizedException('后台登录状态已失效');
    }

    if (admin.tokenInvalidBefore && payload.iat && payload.iat * 1000 < admin.tokenInvalidBefore.getTime()) {
      throw new UnauthorizedException('后台登录状态已失效');
    }

    const session = await this.prisma.adminSession.findFirst({
      where: {
        adminId: admin.id,
        accessTokenJtiHash: hashToken(payload.jti),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      throw new UnauthorizedException('后台登录状态已失效');
    }

    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      display_name: admin.displayName,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import { USER_ACTIVE_STATUS } from '../../../shared/constants';
import { getJwtAccessSecret } from '../../../shared/env-config';
import { UserJwtPayload } from '../../../shared/types';

@Injectable()
export class UserJwtStrategy extends PassportStrategy(Strategy, 'user-jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(),
    });
  }

  async validate(payload: UserJwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(payload.sub), status: USER_ACTIVE_STATUS, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      id: user.id,
      user_no: user.userNo,
      nickname: user.nickname,
    };
  }
}

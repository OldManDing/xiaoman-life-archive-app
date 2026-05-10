import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthType, MembershipType } from '@prisma/client';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { USER_ACTIVE_STATUS } from '../../shared/constants';
import { getJwtAccessSecret, getJwtRefreshSecret } from '../../shared/env-config';
import { SmsCodeService } from '../../shared/services/sms-code.service';
import { SmsService } from '../../shared/services/sms/sms.service';
import { generateBizNo, hashToken, parseDurationToSeconds } from '../../shared/utils';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly smsCodeService: SmsCodeService,
    private readonly smsService: SmsService,
  ) {}

  private get accessTokenTtlSeconds() {
    return parseDurationToSeconds(process.env.JWT_ACCESS_EXPIRES_IN ?? '2h');
  }

  private get refreshTokenTtlSeconds() {
    return parseDurationToSeconds(process.env.JWT_REFRESH_EXPIRES_IN ?? '30d');
  }

  private get accessTokenJwtExpiresIn(): JwtSignOptions['expiresIn'] {
    return (process.env.JWT_ACCESS_EXPIRES_IN ?? '2h') as JwtSignOptions['expiresIn'];
  }

  private get refreshTokenJwtExpiresIn(): JwtSignOptions['expiresIn'] {
    return (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as JwtSignOptions['expiresIn'];
  }

  async sendLoginCode(mobile: string) {
    const result = await this.smsCodeService.issueCode(mobile);
    await this.smsService.sendLoginCode(mobile, result.code);

    return {
      success: true,
      expires_in: result.expiresIn,
      next_send_in: result.nextSendIn,
    };
  }

  async login(dto: LoginDto) {
    if (dto.login_type !== 'mobile') {
      throw new BadRequestException('仅支持手机号登录');
    }

    await this.smsCodeService.verifyLoginCode(dto.credential, dto.verify_code);

    const result = await this.prisma.$transaction(async (tx) => {
      const authAccount = await tx.userAuthAccount.findFirst({
        where: {
          authType: AuthType.mobile,
          authKey: dto.credential,
        },
        include: { user: true },
      });

      if (authAccount?.user) {
        if (authAccount.status !== USER_ACTIVE_STATUS || authAccount.user.status !== USER_ACTIVE_STATUS) {
          throw new UnauthorizedException('账号已停用');
        }

        const user = await tx.user.update({
          where: { id: authAccount.user.id },
          data: { lastLoginAt: new Date() },
        });
        return user;
      }

      const user = await tx.user.create({
        data: {
          userNo: generateBizNo('u'),
          nickname: `用户${dto.credential.slice(-4)}`,
          mobile: dto.credential,
          status: USER_ACTIVE_STATUS,
          membershipType: MembershipType.free,
          lastLoginAt: new Date(),
        },
      });

      await tx.userAuthAccount.create({
        data: {
          userId: user.id,
          authType: AuthType.mobile,
          authKey: dto.credential,
          status: USER_ACTIVE_STATUS,
        },
      });

      return user;
    });

    const accessToken = await this.issueAccessToken(result.id, result.userNo);
    const refreshToken = await this.issueRefreshToken(result.id, result.userNo);
    await this.createSession(result.id, refreshToken);

    const childCount = await this.prisma.child.count({
      where: {
        ownerUserId: result.id,
        deletedAt: null,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.accessTokenTtlSeconds,
      user: {
        user_no: result.userNo,
        nickname: result.nickname,
        avatar_url: result.avatarUrl,
        membership_type: result.membershipType,
      },
      need_create_child: childCount === 0,
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session?.user || session.user.deletedAt) {
      throw new UnauthorizedException('登录状态已失效');
    }

    if (session.user.status !== USER_ACTIVE_STATUS) {
      throw new UnauthorizedException('账号已停用');
    }

    await this.revokeSession(refreshToken);
    await this.prisma.user.update({
      where: { id: session.user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.issueAccessToken(session.user.id, session.user.userNo);
    const nextRefreshToken = await this.issueRefreshToken(session.user.id, session.user.userNo);
    await this.createSession(session.user.id, nextRefreshToken);

    const childCount = await this.prisma.child.count({
      where: {
        ownerUserId: session.user.id,
        deletedAt: null,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: nextRefreshToken,
      expires_in: this.accessTokenTtlSeconds,
      user: {
        user_no: session.user.userNo,
        nickname: session.user.nickname,
        avatar_url: session.user.avatarUrl,
        membership_type: session.user.membershipType,
      },
      need_create_child: childCount === 0,
      payload,
    };
  }

  async logout(refreshToken?: string | null) {
    if (refreshToken) {
      await this.revokeSession(refreshToken);
    }

    return { success: true };
  }

  private async issueAccessToken(userId: bigint, userNo: string) {
    return this.jwtService.signAsync(
      {
        type: 'user',
        sub: userId.toString(),
        user_no: userNo,
      },
      {
        secret: getJwtAccessSecret(),
        expiresIn: this.accessTokenJwtExpiresIn,
      },
    );
  }

  private async issueRefreshToken(userId: bigint, userNo: string) {
    return this.jwtService.signAsync(
      {
        type: 'user',
        sub: userId.toString(),
        user_no: userNo,
        jti: randomUUID(),
      },
      {
        secret: getJwtRefreshSecret(),
        expiresIn: this.refreshTokenJwtExpiresIn,
      },
    );
  }

  private async createSession(userId: bigint, refreshToken: string) {
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
      },
    });
  }

  private async revokeSession(refreshToken: string) {
    await this.prisma.userSession.updateMany({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync(refreshToken, {
        secret: getJwtRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('登录状态已失效');
    }
  }
}

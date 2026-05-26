import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthType, FamilyMemberRole, MembershipType, Prisma } from '@prisma/client';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import {
  FAMILY_MEMBER_ACTIVE_STATUS,
  MEMBER_INVITE_STATUS_ACCEPTED,
  MEMBER_INVITE_STATUS_PENDING,
  USER_ACTIVE_STATUS,
} from '../../shared/constants';
import { getJwtAccessSecret, getJwtRefreshSecret, isSmsEnabled } from '../../shared/env-config';
import { SmsCodeService } from '../../shared/services/sms-code.service';
import { SmsService } from '../../shared/services/sms/sms.service';
import { generateBizNo, hashToken, parseDurationToSeconds } from '../../shared/utils';
import { LoginDto } from './dto/login.dto';
import { getRegisterInviteCode, getRegisterPasswordConfirm, RegisterDto } from './dto/register.dto';

type AcceptableInvite =
  | {
      kind: 'family';
      invite: Prisma.MemberInviteGetPayload<{ include: { family: true } }>;
    }
  | {
      kind: 'registration';
      invite: Prisma.RegistrationInviteGetPayload<{}>;
    };

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
    if (!isSmsEnabled()) {
      throw new BadRequestException('当前版本已关闭短信验证码登录');
    }

    const result = await this.smsCodeService.issueCode(mobile);
    await this.smsService.sendLoginCode(mobile, result.code);

    return {
      success: true,
      expires_in: result.expiresIn,
      next_send_in: result.nextSendIn,
    };
  }

  async login(dto: LoginDto) {
    if (dto.login_type !== 'password') {
      throw new BadRequestException('仅支持账号密码登录');
    }

    const credential = this.normalizeCredential(dto.credential);
    const authAccount = await this.prisma.userAuthAccount.findFirst({
      where: {
        authType: AuthType.password,
        authKey: credential,
        status: USER_ACTIVE_STATUS,
        user: {
          status: USER_ACTIVE_STATUS,
          deletedAt: null,
        },
      },
      include: { user: true },
    });

    if (!authAccount?.user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const result = await this.loginExistingPasswordAccount(authAccount, dto.password);
    return this.issueSessionResponse(result);
  }

  async register(dto: RegisterDto) {
    const passwordConfirm = getRegisterPasswordConfirm(dto);
    const inviteCode = getRegisterInviteCode(dto);

    if (dto.password !== passwordConfirm) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    const credential = this.normalizeCredential(dto.credential);
    const existing = await this.prisma.userAuthAccount.findFirst({
      where: {
        authType: AuthType.password,
        authKey: credential,
      },
    });

    if (existing) {
      throw new BadRequestException('账号已存在，请直接登录');
    }

    const result = await this.createPasswordAccountWithInvite(credential, dto.password, inviteCode.trim());
    return this.issueSessionResponse(result);
  }

  private async loginExistingPasswordAccount(
    authAccount: {
      credentialHash: string | null;
      status: number;
      user: {
        id: bigint;
        userNo: string;
        nickname: string;
        avatarUrl: string | null;
        membershipType: MembershipType;
        status: number;
        deletedAt?: Date | null;
      };
    },
    password: string,
  ) {
    if (
      authAccount.status !== USER_ACTIVE_STATUS ||
      authAccount.user.status !== USER_ACTIVE_STATUS ||
      authAccount.user.deletedAt
    ) {
      throw new UnauthorizedException('账号或密码错误');
    }

    if (!authAccount.credentialHash) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const validPassword = await bcrypt.compare(password, authAccount.credentialHash);
    if (!validPassword) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: authAccount.user.id },
        data: { lastLoginAt: new Date() },
      });

      return user;
    });
  }

  private async createPasswordAccountWithInvite(credential: string, password: string, inviteCode: string) {
    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.$transaction(async (tx) => {
      const invite = await this.ensureInviteCanBeAccepted(tx, inviteCode);

      const user = await tx.user.create({
        data: {
          userNo: generateBizNo('u'),
          nickname: this.credentialToNickname(credential),
          mobile: this.credentialToMobile(credential),
          email: credential.includes('@') ? credential : null,
          status: USER_ACTIVE_STATUS,
          membershipType: MembershipType.free,
          lastLoginAt: new Date(),
        },
      });

      await tx.userAuthAccount.create({
        data: {
          userId: user.id,
          authType: AuthType.password,
          authKey: credential,
          credentialHash: passwordHash,
          status: USER_ACTIVE_STATUS,
        },
      });

      await this.acceptInviteInTransaction(tx, user.id, invite);

      return user;
    });
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

    const childCount = await this.countAccessibleChildren(session.user.id);

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

  private async issueSessionResponse(user: {
    id: bigint;
    userNo: string;
    nickname: string;
    avatarUrl: string | null;
    membershipType: MembershipType;
  }) {
    const accessToken = await this.issueAccessToken(user.id, user.userNo);
    const refreshToken = await this.issueRefreshToken(user.id, user.userNo);
    await this.createSession(user.id, refreshToken);

    const childCount = await this.countAccessibleChildren(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.accessTokenTtlSeconds,
      user: {
        user_no: user.userNo,
        nickname: user.nickname,
        avatar_url: user.avatarUrl,
        membership_type: user.membershipType,
      },
      need_create_child: childCount === 0,
    };
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

  private normalizeCredential(credential: string) {
    return credential.trim().toLowerCase();
  }

  private credentialToNickname(credential: string) {
    const normalized = credential.trim();
    return normalized.includes('@') ? normalized.split('@')[0] : normalized;
  }

  private credentialToMobile(credential: string) {
    return /^1\d{10}$/.test(credential) ? credential : null;
  }

  private async countAccessibleChildren(userId: bigint) {
    return this.prisma.child.count({
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
    });
  }

  private async ensureInviteCanBeAccepted(tx: Prisma.TransactionClient, inviteCode: string): Promise<AcceptableInvite> {
    const familyInvite = await tx.memberInvite.findFirst({
      where: { tokenHash: hashToken(inviteCode) },
      include: { family: true },
    });

    if (familyInvite) {
      if (familyInvite.status !== MEMBER_INVITE_STATUS_PENDING || familyInvite.expiresAt <= new Date()) {
        throw new BadRequestException('邀请码不存在或已失效');
      }

      return { kind: 'family', invite: familyInvite };
    }

    const registrationInvite = await tx.registrationInvite.findFirst({
      where: { tokenHash: hashToken(inviteCode) },
    });

    if (!registrationInvite || registrationInvite.status !== MEMBER_INVITE_STATUS_PENDING || registrationInvite.expiresAt <= new Date()) {
      throw new BadRequestException('邀请码不存在或已失效');
    }

    return { kind: 'registration', invite: registrationInvite };
  }

  private async acceptInviteInTransaction(tx: Prisma.TransactionClient, userId: bigint, acceptableInvite: AcceptableInvite) {
    const user = await tx.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (acceptableInvite.invite.inviteeMobile && user.mobile !== acceptableInvite.invite.inviteeMobile) {
      throw new ForbiddenException('该邀请码绑定了指定手机号，请联系邀请人重新生成不绑定手机号的邀请码');
    }

    const now = new Date();
    if (acceptableInvite.kind === 'registration') {
      const family = await tx.family.create({
        data: {
          familyNo: generateBizNo('family'),
          ownerUserId: userId,
          name: `${user.nickname}的家庭`,
          status: USER_ACTIVE_STATUS,
        },
      });

      await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId,
          role: FamilyMemberRole.owner,
          status: FAMILY_MEMBER_ACTIVE_STATUS,
          joinedAt: now,
        },
      });

      await tx.registrationInvite.update({
        where: { id: acceptableInvite.invite.id },
        data: {
          status: MEMBER_INVITE_STATUS_ACCEPTED,
          acceptedByUserId: userId,
          acceptedAt: now,
        },
      });

      return;
    }

    const invite = acceptableInvite.invite;
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
  }
}

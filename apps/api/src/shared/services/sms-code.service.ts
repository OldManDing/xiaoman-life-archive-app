import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';

import { getSmsProviderName } from '../env-config';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../utils';

@Injectable()
export class SmsCodeService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly scene = 'login';

  async issueCode(mobile: string) {
    const cooldownSeconds = Number(process.env.SMS_SEND_COOLDOWN_SECONDS ?? 60);
    const dailyLimit = Number(process.env.SMS_DAILY_LIMIT_PER_MOBILE ?? 10);
    const ttlSeconds = Number(process.env.SMS_CODE_TTL_SECONDS ?? 300);
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - cooldownSeconds * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const latest = await this.prisma.smsVerificationCode.findFirst({
      where: {
        mobile,
        scene: this.scene,
        createdAt: { gte: oneMinuteAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      throw new HttpException('发送过于频繁', HttpStatus.TOO_MANY_REQUESTS);
    }

    const countToday = await this.prisma.smsVerificationCode.count({
      where: {
        mobile,
        scene: this.scene,
        createdAt: { gte: startOfDay },
      },
    });

    if (countToday >= dailyLimit) {
      throw new HttpException('调用频率超限', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = getSmsProviderName() === 'mock'
      ? process.env.SMS_MOCK_CODE ?? '123456'
      : String(Math.floor(100000 + Math.random() * 900000));

    await this.prisma.smsVerificationCode.create({
      data: {
        mobile,
        scene: this.scene,
        codeHash: hashToken(`${process.env.SMS_CODE_PEPPER ?? 'sms_pepper'}:${code}`),
        expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      },
    });

    return { code, expiresIn: ttlSeconds, nextSendIn: cooldownSeconds };
  }

  async verifyLoginCode(mobile: string, code: string) {
    const latest = await this.prisma.smsVerificationCode.findFirst({
      where: {
        mobile,
        scene: this.scene,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest || latest.expiresAt <= new Date() || latest.consumedAt) {
      throw new UnauthorizedException('验证码已失效');
    }

    const maxAttempts = Number(process.env.SMS_VERIFY_MAX_ATTEMPTS ?? 5);
    if (latest.failedAttempts >= maxAttempts) {
      throw new BadRequestException('验证码尝试次数过多');
    }

    const codeHash = hashToken(`${process.env.SMS_CODE_PEPPER ?? 'sms_pepper'}:${code}`);
    if (latest.codeHash !== codeHash) {
      await this.prisma.smsVerificationCode.update({
        where: { id: latest.id },
        data: { failedAttempts: latest.failedAttempts + 1 },
      });
      throw new BadRequestException('验证码错误');
    }

    await this.prisma.smsVerificationCode.update({
      where: { id: latest.id },
      data: { consumedAt: new Date() },
    });
  }
}

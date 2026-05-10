import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { hashToken } from '../../src/shared/utils';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';

describe('Auth session flow', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const user = {
    id: BigInt(1),
    userNo: 'u_001',
    nickname: '测试用户',
    avatarUrl: null,
    membershipType: 'free',
    membershipExpireAt: null,
    mobile: '13800000000',
    status: 1,
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
    deletedAt: null,
  };

  const sessions: Array<{ hash: string; revokedAt: Date | null; expiresAt: Date }> = [];
  const authAccount = { user, status: 1 };
  const smsCodes = [
    {
      id: BigInt(1),
      mobile: '13800000000',
      scene: 'login',
      codeHash: hashToken('sms_pepper:123456'),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      failedAttempts: 0,
    },
  ];

  const prismaMock = {
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input({
          userAuthAccount: {
            findFirst: jest.fn().mockResolvedValue(authAccount),
            create: jest.fn(),
          },
          user: {
            update: jest.fn().mockResolvedValue(user),
            create: jest.fn().mockResolvedValue(user),
          },
        });
      }

      return input;
    }),
    child: {
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      update: jest.fn().mockImplementation(async ({ data }: { data: { nickname?: string } }) => {
        if (typeof data.nickname === 'string') {
          user.nickname = data.nickname;
        }
        return user;
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint; status?: number } }) => {
        if (where.id === user.id && (where.status === undefined || where.status === user.status)) return user;
        return null;
      }),
    },
    smsVerificationCode: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { mobile: string; scene: string } }) => {
        return smsCodes.find((item) => item.mobile === where.mobile && item.scene === where.scene) ?? null;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: bigint }; data: Partial<(typeof smsCodes)[number]> }) => {
        const code = smsCodes.find((item) => item.id === where.id)!;
        Object.assign(code, data);
        return code;
      }),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    userSession: {
      create: jest.fn().mockImplementation(async ({ data }: { data: { refreshTokenHash: string; expiresAt: Date } }) => {
        sessions.push({ hash: data.refreshTokenHash, revokedAt: null, expiresAt: data.expiresAt });
        return { id: BigInt(sessions.length), ...data };
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { refreshTokenHash: string } }) => {
        const session = sessions.find((item) => item.hash === where.refreshTokenHash && !item.revokedAt);
        return session ? { id: BigInt(1), userId: user.id, user, ...session } : null;
      }),
      updateMany: jest.fn().mockImplementation(async ({ where }: { where: { refreshTokenHash: string } }) => {
        for (const session of sessions) {
          if (session.hash === where.refreshTokenHash && !session.revokedAt) {
            session.revokedAt = new Date();
          }
        }
        return { count: 1 };
      }),
    },
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '2h';
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    process.env.SMS_PROVIDER = 'mock';
    process.env.SMS_MOCK_CODE = '123456';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('sets refresh cookie, rotates refresh token, and clears it on logout', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_type: 'mobile', credential: '13800000000', verify_code: '123456' })
      .expect(200);

    const loginCookies = loginResponse.headers['set-cookie'];
    expect(loginCookies?.[0]).toContain('xiaoman_refresh_token=');
    expect(loginResponse.body.data.access_token).toBeTruthy();
    expect(loginResponse.body.data.refresh_token).toBeUndefined();

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookies)
      .expect(200);

    const refreshCookies = refreshResponse.headers['set-cookie'];
    expect(refreshCookies?.[0]).toContain('xiaoman_refresh_token=');
    expect(refreshResponse.body.data.access_token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookies)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookies)
      .expect(401);
  });

  it('updates nickname through users/me patch', async () => {
    user.status = 1;
    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const updateResponse = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ nickname: '新昵称' })
      .expect(200);

    expect(updateResponse.body.data.nickname).toBe('新昵称');
  });

  it('rejects disabled users with an existing access token', async () => {
    user.status = 2;
    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    user.status = 1;
  });
});

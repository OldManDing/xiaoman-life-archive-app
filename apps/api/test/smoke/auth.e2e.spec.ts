import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
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
  let authAccount: { user: typeof user; status: number; credentialHash: string };
  const invite = {
    id: BigInt(10),
    familyId: BigInt(100),
    inviterUserId: BigInt(2),
    inviteNo: 'inv_001',
    tokenHash: hashToken('join-family-001'),
    inviteeMobile: null,
    role: 'viewer',
    status: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptedAt: null as Date | null,
    inviteeUserId: null as bigint | null,
    family: { id: BigInt(100), familyNo: 'f_invite_001' },
  };
  const memberships: Array<{ familyId: bigint; userId: bigint; role: string; status: number; deletedAt: Date | null; joinedAt: Date | null }> = [];

  const prismaMock = {
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input({
          userAuthAccount: {
            create: jest.fn(),
          },
          user: {
            update: jest.fn().mockResolvedValue(user),
            create: jest.fn().mockResolvedValue(user),
            findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint } }) => {
              if (where.id === user.id) return user;
              return null;
            }),
          },
          memberInvite: {
            findFirst: jest.fn().mockImplementation(async ({ where }: { where: { tokenHash?: string } }) => {
              return where.tokenHash === invite.tokenHash ? invite : null;
            }),
            update: jest.fn().mockImplementation(async ({ data }: { data: Partial<typeof invite> }) => {
              Object.assign(invite, data);
              return invite;
            }),
          },
          familyMember: {
            upsert: jest.fn().mockImplementation(async ({ create, update, where }: { create: any; update: any; where: { familyId_userId: { familyId: bigint; userId: bigint } } }) => {
              const existing = memberships.find((item) => item.familyId === where.familyId_userId.familyId && item.userId === where.familyId_userId.userId);
              if (existing) {
                Object.assign(existing, update);
                return existing;
              }

              const created = { ...create, deletedAt: null };
              memberships.push(created);
              return created;
            }),
          },
        });
      }

      return input;
    }),
    userAuthAccount: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { authKey: string } }) => {
        return where.authKey === 'parent_account' ? authAccount : null;
      }),
    },
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
      findFirst: jest.fn(),
      update: jest.fn(),
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
    authAccount = { user, status: 1, credentialHash: await bcrypt.hash('Parent123!', 10) };

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
      .send({ login_type: 'password', credential: 'parent_account', password: 'Parent123!' })
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

  it('registers a password account with an invite code', async () => {
    invite.status = 1;
    invite.acceptedAt = null;
    invite.inviteeUserId = null;
    memberships.length = 0;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        credential: 'new_parent',
        password: 'Parent123!',
        password_confirm: 'Parent123!',
        invite_code: 'join-family-001',
      })
      .expect(200);

    expect(registerResponse.headers['set-cookie']?.[0]).toContain('xiaoman_refresh_token=');
    expect(registerResponse.body.data.access_token).toBeTruthy();
    expect(invite.status).toBe(2);
    expect(invite.inviteeUserId).toBe(user.id);
    expect(memberships[0]).toMatchObject({
      familyId: invite.familyId,
      userId: user.id,
      role: 'viewer',
      status: 1,
    });
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

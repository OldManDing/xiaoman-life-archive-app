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
import { createAppValidationPipe } from '../../src/shared/validation-pipe';

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
    deletedAt: null as Date | null,
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
  const registrationInvite = {
    id: BigInt(20),
    inviteNo: 'reg_inv_001',
    tokenHash: hashToken('NL-REG001-REG002'),
    inviteeMobile: null as string | null,
    createdByAdminId: BigInt(12),
    acceptedByUserId: null as bigint | null,
    status: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptedAt: null as Date | null,
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
    updatedAt: new Date('2026-04-21T00:00:00.000Z'),
  };
  const memberships: Array<{ familyId: bigint; userId: bigint; role: string; status: number; deletedAt: Date | null; joinedAt: Date | null }> = [];
  const createdFamilies: Array<{ id: bigint; familyNo: string; ownerUserId: bigint; name: string; status: number }> = [];
  const joinedFamilyMemberships = [
    {
      id: BigInt(77),
      familyId: BigInt(100),
      userId: user.id,
      role: 'viewer',
      status: 1,
      deletedAt: null,
      family: { id: BigInt(100), familyNo: 'f_joined_001', name: '共享家庭', deletedAt: null },
    },
  ];
  const exportChild = {
    id: BigInt(30),
    childNo: 'c_001',
    familyId: BigInt(100),
    name: '小满',
    family: { id: BigInt(100), familyNo: 'f_joined_001', name: '共享家庭', deletedAt: null },
  };
  const archiveExportRequests: Array<{
    id: bigint;
    requestNo: string;
    userId: bigint;
    familyId: bigint;
    childId: bigint;
    exportType: string;
    purpose: string;
    status: string;
    contact: string | null;
    note: string | null;
    recordCount: number;
    milestoneCount: number;
    mediaCount: number;
    firstRecordTime: Date | null;
    latestRecordTime: Date | null;
    processedAt: Date | null;
    processNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  const supportTickets: Array<{
    id: bigint;
    ticketNo: string;
    userId: bigint;
    category: string;
    topic: string | null;
    content: string;
    contact: string | null;
    status: string;
    priority: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  let exportRequesterRole: 'owner' | 'viewer' = 'owner';

  const txRecordUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
  const txRecordMediaUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
  const txUserAuthAccountFindMany = jest.fn().mockResolvedValue([{ id: BigInt(11), authKey: 'parent_account' }]);
  const txUserAuthAccountUpdate = jest.fn().mockResolvedValue({});

  const prismaMock = {
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return input({
          aiJob: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          child: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          family: {
            create: jest.fn().mockImplementation(async ({ data }: { data: { familyNo: string; ownerUserId: bigint; name: string; status: number } }) => {
              const created = { id: BigInt(800 + createdFamilies.length), ...data };
              createdFamilies.push(created);
              return created;
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          record: {
            updateMany: txRecordUpdateMany,
          },
          recordMedia: {
            updateMany: txRecordMediaUpdateMany,
          },
          shareLink: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          userAuthAccount: {
            create: jest.fn(),
            findMany: txUserAuthAccountFindMany,
            update: txUserAuthAccountUpdate,
          },
          user: {
            update: jest.fn().mockImplementation(async ({ data }: { data: { nickname?: string; status?: number; deletedAt?: Date | null } }) => {
              if (typeof data.nickname === 'string') {
                user.nickname = data.nickname;
              }
              if (typeof data.status === 'number') {
                user.status = data.status;
              }
              if (data.deletedAt !== undefined) {
                user.deletedAt = data.deletedAt;
              }
              return user;
            }),
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
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          registrationInvite: {
            findFirst: jest.fn().mockImplementation(async ({ where }: { where: { tokenHash?: string } }) => {
              return where.tokenHash === registrationInvite.tokenHash ? registrationInvite : null;
            }),
            update: jest.fn().mockImplementation(async ({ data }: { data: Partial<typeof registrationInvite> }) => {
              Object.assign(registrationInvite, data);
              return registrationInvite;
            }),
          },
          familyMember: {
            create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
              const created = { ...data, deletedAt: null };
              memberships.push(created);
              return created;
            }),
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
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          userSession: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      }

      return input;
    }),
    userAuthAccount: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { authKey?: string; userId?: bigint } }) => {
        if (where.userId === user.id) return authAccount;
        return where.authKey === 'parent_account' ? authAccount : null;
      }),
      findMany: jest.fn().mockResolvedValue([{ id: BigInt(11), authKey: 'parent_account' }]),
      update: jest.fn().mockResolvedValue({}),
    },
    child: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { childNo?: string } }) => {
        return where.childNo === exportChild.childNo ? exportChild : null;
      }),
    },
    record: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue({ eventTime: new Date('2026-05-01T08:00:00.000Z') }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: BigInt(90),
          recordNo: 'r_001',
          title: '第一次独立骑车',
          contentText: '今天自己骑了一小段，回来一直说还想再试一次。',
          eventTime: new Date('2026-05-01T08:00:00.000Z'),
          locationText: '小区花园',
          isMilestone: true,
          aiGeneratedTitle: null,
          aiSummary: '孩子完成一次新的运动尝试。',
          creator: user,
          tags: [{ tagName: '运动' }, { tagName: '里程碑' }],
          media: [
            {
              id: BigInt(91),
              mediaNo: 'm_001',
              mediaType: 'image',
              originalName: 'bike.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: BigInt(2048),
              createdAt: new Date('2026-05-01T08:05:00.000Z'),
            },
          ],
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    recordMedia: {
      count: jest.fn().mockResolvedValue(2),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    archiveExportRequest: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const now = new Date('2026-05-27T08:00:00.000Z');
        const created = {
          id: BigInt(300 + archiveExportRequests.length),
          requestNo: data.requestNo,
          userId: data.userId,
          familyId: data.familyId,
          childId: data.childId,
          exportType: data.exportType,
          purpose: data.purpose,
          status: data.status,
          contact: data.contact,
          note: data.note,
          recordCount: data.recordCount,
          milestoneCount: data.milestoneCount,
          mediaCount: data.mediaCount,
          firstRecordTime: data.firstRecordTime,
          latestRecordTime: data.latestRecordTime,
          processedAt: null,
          processNote: null,
          createdAt: now,
          updatedAt: now,
        };
        archiveExportRequests.push(created);
        return created;
      }),
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId?: bigint; childId?: bigint } }) =>
        archiveExportRequests
          .filter((item) => (where.userId ? item.userId === where.userId : true))
          .filter((item) => (where.childId ? item.childId === where.childId : true))
          .map((item) => ({ ...item, child: exportChild }))
          .reverse()
          .slice(0, 10),
      ),
    },
    supportTicket: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const now = new Date('2026-05-27T08:00:00.000Z');
        const created = {
          id: BigInt(500 + supportTickets.length),
          ticketNo: data.ticketNo,
          userId: data.userId,
          category: data.category,
          topic: data.topic,
          content: data.content,
          contact: data.contact,
          status: data.status,
          priority: data.priority,
          createdAt: now,
          updatedAt: now,
        };
        supportTickets.push(created);
        return created;
      }),
    },
    aiJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    shareLink: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    family: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    familyMember: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { familyId?: bigint; userId?: bigint } }) =>
        where.familyId === exportChild.familyId && where.userId === user.id
          ? {
              id: BigInt(78),
              familyId: exportChild.familyId,
              userId: user.id,
              role: exportRequesterRole,
              status: 1,
              deletedAt: null,
            }
          : null,
      ),
      findMany: jest.fn().mockResolvedValue(joinedFamilyMemberships),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    memberInvite: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    },
    user: {
      update: jest.fn().mockImplementation(async ({ data }: { data: { nickname?: string; status?: number; deletedAt?: Date | null } }) => {
        if (typeof data.nickname === 'string') {
          user.nickname = data.nickname;
        }
        if (typeof data.status === 'number') {
          user.status = data.status;
        }
        if (data.deletedAt !== undefined) {
          user.deletedAt = data.deletedAt;
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
    app.useGlobalPipes(createAppValidationPipe());
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

  it('registers a password account with an admin registration invite and creates an owned family', async () => {
    registrationInvite.status = 1;
    registrationInvite.acceptedAt = null;
    registrationInvite.acceptedByUserId = null;
    memberships.length = 0;
    createdFamilies.length = 0;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        credential: 'fresh_parent',
        password: 'Parent123!',
        password_confirm: 'Parent123!',
        invite_code: 'NL-REG001-REG002',
      })
      .expect(200);

    expect(registerResponse.body.data.access_token).toBeTruthy();
    expect(registrationInvite.status).toBe(2);
    expect(registrationInvite.acceptedByUserId).toBe(user.id);
    expect(createdFamilies[0]).toMatchObject({
      ownerUserId: user.id,
      name: '测试用户的家庭',
      status: 1,
    });
    expect(memberships[0]).toMatchObject({
      familyId: createdFamilies[0].id,
      userId: user.id,
      role: 'owner',
      status: 1,
    });
  });

  it('accepts camelCase registration fields from mobile clients', async () => {
    registrationInvite.status = 1;
    registrationInvite.acceptedAt = null;
    registrationInvite.acceptedByUserId = null;
    memberships.length = 0;
    createdFamilies.length = 0;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        credential: 'fresh_parent_camel',
        password: 'Parent123!',
        passwordConfirm: 'Parent123!',
        inviteCode: 'NL-REG001-REG002',
      })
      .expect(200);

    expect(registerResponse.body.data.access_token).toBeTruthy();
    expect(registrationInvite.status).toBe(2);
    expect(registrationInvite.acceptedByUserId).toBe(user.id);
    expect(memberships[0]).toMatchObject({
      familyId: createdFamilies[0].id,
      userId: user.id,
      role: 'owner',
      status: 1,
    });
  });

  it('returns a field-level registration validation error instead of a generic failure only', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        credential: 'new_parent',
        password: '1234567',
        password_confirm: '1234567',
        invite_code: 'NL-REG001-REG002',
      })
      .expect(400);

    expect(registerResponse.body.message).toBe('参数校验失败');
    expect(registerResponse.body.data.fields).toContainEqual({
      field: 'password',
      reason: '密码需为 8 到 72 位',
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

  it('rejects admin-scoped tokens on user endpoints', async () => {
    user.status = 1;
    user.deletedAt = null;
    const accessToken = await jwtService.signAsync(
      { type: 'admin', sub: user.id.toString(), username: 'shadow_admin', role: 'super_admin' },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('syncs user preferences through audit-backed account settings', async () => {
    user.status = 1;
    user.deletedAt = null;
    prismaMock.auditLog.findFirst.mockResolvedValueOnce(null);
    prismaMock.auditLog.create.mockClear();

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const defaultsResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(defaultsResponse.body.data).toMatchObject({
      allow_mobile_search: true,
      show_history_to_new_members: true,
      updated_at: null,
    });

    const updateResponse = await request(app.getHttpServer())
      .put('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ allow_mobile_search: false, show_history_to_new_members: false })
      .expect(200);

    expect(updateResponse.body.data).toMatchObject({
      allow_mobile_search: false,
      show_history_to_new_members: false,
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.preferences_updated',
          targetType: 'user',
          metadata: expect.objectContaining({
            allow_mobile_search: false,
            show_history_to_new_members: false,
          }),
        }),
      }),
    );
  });

  it('submits feedback, membership book and archive export requests to audit logs', async () => {
    user.status = 1;
    user.deletedAt = null;
    exportRequesterRole = 'owner';
    archiveExportRequests.length = 0;
    supportTickets.length = 0;
    prismaMock.auditLog.create.mockClear();

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const feedbackResponse = await request(app.getHttpServer())
      .post('/api/v1/users/me/feedback')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ category: 'usage', content: 'record create button is hard to find', contact: '13800000000' })
      .expect(200);

    expect(feedbackResponse.body.data.feedback_no).toMatch(/^fb_/);
    expect(feedbackResponse.body.data.ticket_no).toBe(feedbackResponse.body.data.feedback_no);
    expect(feedbackResponse.body.data.status).toBe('submitted');
    expect(supportTickets[0]).toMatchObject({
      category: 'usage',
      status: 'submitted',
      priority: 'normal',
    });

    const bookResponse = await request(app.getHttpServer())
      .post('/api/v1/users/me/membership-book-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ year: 2026, contact: '13800000000' })
      .expect(200);

    expect(bookResponse.body.data.request_no).toMatch(/^book_/);
    expect(bookResponse.body.data.status).toBe('submitted');

    const exportResponse = await request(app.getHttpServer())
      .post('/api/v1/users/me/archive-export-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ child_no: exportChild.childNo, export_type: 'all', purpose: 'adult_handoff' })
      .expect(200);

    expect(exportResponse.body.data.request_no).toMatch(/^handoff_/);
    expect(exportResponse.body.data.status).toBe('submitted');
    expect(exportResponse.body.data.summary).toMatchObject({
      child_no: exportChild.childNo,
      export_type: 'all',
      purpose: 'adult_handoff',
      record_count: 1,
      milestone_count: 1,
      media_count: 2,
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.feedback_submitted',
          targetType: 'support_ticket',
          targetId: supportTickets[0].id,
          metadata: expect.objectContaining({ category: 'usage', ticket_no: supportTickets[0].ticketNo }),
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.membership_book_requested',
          metadata: expect.objectContaining({ year: 2026 }),
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.adult_handoff_requested',
          targetType: 'archive_export_request',
          targetId: archiveExportRequests[0].id,
          metadata: expect.objectContaining({
            request_no: expect.stringMatching(/^handoff_/),
            child_no: exportChild.childNo,
            export_type: 'all',
            purpose: 'adult_handoff',
            snapshot: expect.objectContaining({
              record_count: 1,
              media_count: 2,
              milestone_count: 1,
            }),
          }),
        }),
      }),
    );

    const backupResponse = await request(app.getHttpServer())
      .post('/api/v1/users/me/archive-export-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ child_no: exportChild.childNo })
      .expect(200);

    expect(backupResponse.body.data.request_no).toMatch(/^export_/);
    expect(backupResponse.body.data.summary).toMatchObject({
      child_no: exportChild.childNo,
      export_type: 'all',
      purpose: 'backup',
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.archive_export_requested',
          targetType: 'archive_export_request',
          targetId: archiveExportRequests[1].id,
          metadata: expect.objectContaining({
            request_no: expect.stringMatching(/^export_/),
            child_no: exportChild.childNo,
            export_type: 'all',
            purpose: 'backup',
          }),
        }),
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/users/me/archive-export-requests?child_no=${exportChild.childNo}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body.data.list).toHaveLength(2);
    expect(listResponse.body.data.list[0]).toMatchObject({
      request_no: backupResponse.body.data.request_no,
      child_no: exportChild.childNo,
      child_name: exportChild.name,
      purpose: 'backup',
      status: 'submitted',
      record_count: 1,
      media_count: 2,
    });
    expect(listResponse.body.data.list[1]).toMatchObject({
      request_no: exportResponse.body.data.request_no,
      purpose: 'adult_handoff',
      status: 'submitted',
    });
  });

  it('downloads a server-generated archive summary and writes audit evidence', async () => {
    user.status = 1;
    user.deletedAt = null;
    exportRequesterRole = 'owner';
    prismaMock.auditLog.create.mockClear();

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/me/archive-export-summary?child_no=${exportChild.childNo}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      file_name: expect.stringMatching(/^年轮-小满-档案摘要-/),
      mime_type: 'text/plain;charset=utf-8',
      summary: {
        child_no: exportChild.childNo,
        child_name: exportChild.name,
        record_count: 1,
        milestone_count: 1,
        media_count: 1,
      },
    });
    expect(response.body.data.content).toContain('第一次独立骑车');
    expect(response.body.data.content).toContain('bike.jpg');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.archive_summary_downloaded',
          targetType: 'child',
          targetId: exportChild.id,
          metadata: expect.objectContaining({
            child_no: exportChild.childNo,
            record_count: 1,
            media_count: 1,
          }),
        }),
      }),
    );
  });

  it('rejects archive export requests for inaccessible children', async () => {
    user.status = 1;
    user.deletedAt = null;
    exportRequesterRole = 'owner';
    prismaMock.auditLog.create.mockClear();

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .post('/api/v1/users/me/archive-export-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ child_no: 'c_inaccessible', export_type: 'all', purpose: 'backup' })
      .expect(404);

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects archive export requests from non-owner family members', async () => {
    user.status = 1;
    user.deletedAt = null;
    exportRequesterRole = 'viewer';
    prismaMock.auditLog.create.mockClear();
    prismaMock.archiveExportRequest.create.mockClear();

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .post('/api/v1/users/me/archive-export-requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ child_no: exportChild.childNo, export_type: 'all', purpose: 'backup' })
      .expect(403);

    expect(prismaMock.archiveExportRequest.create).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    exportRequesterRole = 'owner';
  });

  it('does not double count an owned family as a joined family during deletion check', async () => {
    user.status = 1;
    user.deletedAt = null;
    prismaMock.family.findMany.mockResolvedValueOnce([
      {
        id: BigInt(100),
        familyNo: 'f_joined_001',
        name: '鍏变韩瀹跺涵',
        deletedAt: null,
        members: [{ userId: user.id, user: { deletedAt: null } }],
      },
    ]);

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const checkResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me/deletion-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(checkResponse.body.data.can_delete).toBe(true);
    expect(checkResponse.body.data.summary.owned_family_count).toBe(1);
    expect(checkResponse.body.data.summary.joined_family_count).toBe(0);
  });

  it('allows a non-owner member to delete the current account', async () => {
    user.status = 1;
    user.deletedAt = null;
    authAccount.status = 1;
    txRecordUpdateMany.mockClear();
    txRecordMediaUpdateMany.mockClear();
    txUserAuthAccountFindMany.mockClear();
    txUserAuthAccountUpdate.mockClear();
    txUserAuthAccountFindMany.mockResolvedValueOnce([{ id: BigInt(11), authKey: 'x'.repeat(128) }]);
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('audit temporarily unavailable'));

    const accessToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const checkResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me/deletion-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(checkResponse.body.data.can_delete).toBe(true);
    expect(checkResponse.body.data.confirm_text).toBe('确认注销');

    const deleteResponse = await request(app.getHttpServer())
      .post('/api/v1/users/me/delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'Parent123!', confirm_text: '确认注销' })
      .expect(200);

    expect(deleteResponse.body.data.success).toBe(true);
    expect(deleteResponse.headers['set-cookie']?.[0]).toContain('xiaoman_refresh_token=;');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'user.account_deleted' }) }));
    expect(user.status).toBe(0);
    expect(user.deletedAt).toBeTruthy();
    expect(txRecordMediaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ uploaderUserId: user.id, deletedAt: null }),
      }),
    );
    expect(txRecordUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ creatorUserId: user.id, deletedAt: null }),
      }),
    );
    const authUpdatePayload = txUserAuthAccountUpdate.mock.calls[0][0];
    expect(authUpdatePayload.data.authKey).toMatch(/^deleted:[a-z0-9]+:11$/);
    expect(authUpdatePayload.data.authKey.length).toBeLessThanOrEqual(128);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    prismaMock.userAuthAccount.findFirst.mockImplementationOnce(async () => null);
    const reloginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_type: 'password', credential: 'parent_account', password: 'Parent123!' })
      .expect(401);

    expect(reloginResponse.body.message).toBe('账号或密码错误');

    user.status = 1;
    user.deletedAt = null;
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

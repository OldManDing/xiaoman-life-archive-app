import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AiJobsQueue } from '../../src/modules/ai-jobs/ai-jobs.queue';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';

describe('Admin operations contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const enqueue = jest.fn();
  const now = new Date('2026-05-10T08:00:00.000Z');

  const adminSuper = {
    id: BigInt(12),
    username: 'root',
    role: 'super_admin',
    displayName: '系统管理员',
    status: 1,
    deletedAt: null,
  };

  const user = {
    id: BigInt(1),
    userNo: 'u_001',
    nickname: '测试家长',
    avatarUrl: null,
    mobile: '13800000000',
    email: null,
    status: 1,
    membershipType: 'free',
    membershipExpireAt: null,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const userAuthAccount = {
    id: BigInt(2),
    userId: user.id,
    authType: 'password',
    authKey: '13800000000',
    credentialHash: 'old-password-hash',
    status: 1,
    createdAt: now,
    updatedAt: now,
  };

  const family = {
    id: BigInt(10),
    familyNo: 'f_001',
    name: '小满家庭',
    deletedAt: null,
  };

  const child = {
    id: BigInt(20),
    childNo: 'c_001',
    familyId: family.id,
    ownerUserId: user.id,
    name: '小满',
    avatarUrl: null,
    birthday: new Date('2022-01-01T00:00:00.000Z'),
    gender: 'female',
    birthPlace: '上海',
    remark: '重点关注睡眠',
    status: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const familyMember = {
    id: BigInt(31),
    familyId: family.id,
    userId: user.id,
    user,
    family,
    role: 'owner',
    status: 1,
    joinedAt: now,
    createdAt: now,
    deletedAt: null,
  };

  const media = {
    id: BigInt(30),
    mediaNo: 'm_001',
    recordId: BigInt(40),
    familyId: family.id,
    childId: child.id,
    uploaderUserId: user.id,
    mediaType: 'image',
    storageProvider: 'mock',
    bucket: 'xiaoman-archive-local',
    objectKey: 'families/f_001/children/c_001/2026/05/m_001.jpg',
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: BigInt(1024),
    width: 100,
    height: 100,
    durationSeconds: null,
    thumbnailObjectKey: null,
    status: 2,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const record = {
    id: BigInt(40),
    recordNo: 'r_001',
    childId: child.id,
    familyId: family.id,
    creatorUserId: user.id,
    recordType: 'mixed',
    title: '第一次骑车',
    contentText: '今天自己骑了一小段。',
    eventTime: now,
    locationText: '小区',
    visibilityScope: 'family',
    isMilestone: true,
    aiGeneratedTitle: '独立骑行',
    aiSummary: '孩子完成了短距离骑行。',
    aiStatus: 'success',
    status: 2,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const aiJob = {
    id: BigInt(50),
    jobNo: 'job_001',
    familyId: family.id,
    recordId: record.id,
    requesterUserId: user.id,
    jobType: 'record_summary',
    provider: 'mock',
    status: 'failed',
    inputSnapshot: { record_no: record.recordNo },
    outputJson: null,
    errorMessage: 'timeout',
    retryCount: 1,
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const auditLog = {
    actorType: 'admin',
    actorId: adminSuper.id,
    action: 'admin_retry_ai_job',
    targetType: 'ai_job',
    targetId: aiJob.id,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    metadata: { reason: 'manual retry' },
    createdAt: now,
  };

  const registrationInvite = {
    id: BigInt(60),
    inviteNo: 'reg_inv_001',
    tokenHash: 'token_hash',
    inviteeMobile: null as string | null,
    createdByAdminId: adminSuper.id,
    acceptedByUserId: null as bigint | null,
    status: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptedAt: null as Date | null,
    createdAt: now,
    updatedAt: now,
    createdByAdmin: adminSuper,
    acceptedByUser: null,
  };

  let createdRegistrationInvite = { ...registrationInvite, id: BigInt(61), inviteNo: 'reg_inv_created_001' };

  const userWithRelations = {
    ...user,
    authAccounts: [userAuthAccount],
    ownedChildren: [child],
    familyMemberships: [familyMember],
  };

  const childWithRelations = {
    ...child,
    family: { ...family, members: [familyMember] },
    owner: user,
    records: [record],
  };

  const recordWithRelations = {
    ...record,
    child,
    family,
    creator: user,
    tags: [{ tagName: '成长', source: 'user' }],
    media: [media],
    aiJobs: [aiJob],
  };

  const mediaWithRelations = {
    ...media,
    record,
    child,
    family,
    uploader: user,
  };

  const getAiJobWithRelations = () => ({
    ...aiJob,
    record,
    family,
    requester: user,
  });

  const prismaMock: Record<string, any> = {
    adminUser: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const matchesStatus = where.status === undefined || where.status === adminSuper.status;
        return where.id === adminSuper.id && matchesStatus ? adminSuper : null;
      }),
    },
    user: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.userNo === user.userNo || where.deletedAt === null) return userWithRelations;
        return null;
      }),
    },
    userAuthAccount: {
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        Object.assign(userAuthAccount, data, { updatedAt: new Date() });
        return { ...userAuthAccount };
      }),
    },
    userSession: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    child: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(childWithRelations),
    },
    record: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(recordWithRelations),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        record.status = data.status;
        record.publishedAt = data.publishedAt;
        return { ...record };
      }),
    },
    recordMedia: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(mediaWithRelations),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        media.status = data.status;
        return { ...media };
      }),
    },
    aiJob: {
      groupBy: jest.fn().mockResolvedValue([{ status: 'failed', _count: 1 }]),
      findFirst: jest.fn().mockImplementation(async () => getAiJobWithRelations()),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        if (data.retryCount?.increment) {
          aiJob.retryCount += data.retryCount.increment;
          const rest = { ...data };
          delete rest.retryCount;
          Object.assign(aiJob, rest);
        } else {
          Object.assign(aiJob, data);
        }
        return { ...aiJob };
      }),
    },
    auditLog: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([auditLog]),
      create: jest.fn(),
    },
    registrationInvite: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([registrationInvite]),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.inviteNo === registrationInvite.inviteNo) return registrationInvite;
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        createdRegistrationInvite = {
          ...registrationInvite,
          ...data,
          id: BigInt(61),
          inviteNo: data.inviteNo,
          createdAt: now,
          updatedAt: now,
          createdByAdmin: adminSuper,
          acceptedByUser: null,
        };
        return createdRegistrationInvite;
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        Object.assign(registrationInvite, data);
        return { ...registrationInvite };
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $transaction: jest.fn(async (input: unknown): Promise<unknown> => {
      if (Array.isArray(input)) return Promise.all(input);
      if (typeof input === 'function') return (input as (tx: unknown) => unknown)(prismaMock);
      return input;
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AiJobsQueue)
      .useValue({ enqueue })
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

  beforeEach(() => {
    enqueue.mockClear();
    prismaMock.auditLog.create.mockClear();
    record.status = 2;
    record.publishedAt = now;
    media.status = 2;
    aiJob.status = 'failed';
    aiJob.errorMessage = 'timeout';
    aiJob.retryCount = 1;
    registrationInvite.status = 1;
    registrationInvite.acceptedAt = null;
    registrationInvite.acceptedByUserId = null;
    userAuthAccount.credentialHash = 'old-password-hash';
  });

  const adminToken = async () =>
    jwtService.signAsync(
      { type: 'admin', sub: adminSuper.id.toString(), username: adminSuper.username, role: adminSuper.role },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

  it('returns dashboard statistics and recent audit logs', async () => {
    const token = await adminToken();

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      totals: {
        users: 1,
        children: 1,
        records: 1,
        media: 1,
      },
    });
    expect(response.body.data.ai_job_status_distribution).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'failed', count: 1 })]),
    );
    expect(response.body.data.recent_audit_logs[0]).toMatchObject({
      action: 'admin_retry_ai_job',
      target_type: 'ai_job',
    });
  });

  it('rejects user-scoped tokens on admin endpoints', async () => {
    const token = await jwtService.signAsync(
      { type: 'user', sub: adminSuper.id.toString(), user_no: 'u_shadow_admin_id' },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('returns admin detail endpoints for users children records media and AI jobs', async () => {
    const token = await adminToken();

    await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${user.userNo}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.auth_accounts[0]).toMatchObject({ auth_type: 'password', auth_key: '13800000000' });
        expect(response.body.data.children[0]).toMatchObject({ child_no: child.childNo });
        expect(response.body.data.families[0]).toMatchObject({ family_no: family.familyNo });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/admin/children/${child.childNo}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.family_members[0]).toMatchObject({ user_no: user.userNo });
        expect(response.body.data.recent_records[0]).toMatchObject({ record_no: record.recordNo });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/admin/records/${record.recordNo}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.media_list[0]).toMatchObject({ media_no: media.mediaNo });
        expect(response.body.data.ai_jobs[0]).toMatchObject({ job_no: aiJob.jobNo });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/admin/media/${media.mediaNo}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          media_no: media.mediaNo,
          access_url: expect.stringContaining('data:image/svg+xml'),
          uploader_user_no: user.userNo,
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/admin/ai-jobs/${aiJob.jobNo}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          job_no: aiJob.jobNo,
          input_snapshot: { record_no: record.recordNo },
          requester_user_no: user.userNo,
        });
      });
  });

  it('updates record and media review statuses with audit metadata', async () => {
    const token = await adminToken();

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/records/${record.recordNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'draft', reason: 'content review' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({ record_no: record.recordNo, status: 'draft', changed: true });
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/media/${media.mediaNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'failed', reason: 'bad file' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({ media_no: media.mediaNo, status: 'failed', changed: true });
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/media/${media.mediaNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'removed', reason: 'offline by operator' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({ media_no: media.mediaNo, status: 'removed', changed: true });
      });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_unpublish_record',
          metadata: expect.objectContaining({ reason: 'content review' }),
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_reject_media',
          metadata: expect.objectContaining({ reason: 'bad file' }),
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_remove_media',
          metadata: expect.objectContaining({ reason: 'offline by operator' }),
        }),
      }),
    );
  });

  it('resets a user password and revokes active sessions', async () => {
    const token = await adminToken();

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${user.userNo}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: 'NewPass123!', password_confirm: 'NewPass123!', reason: 'user verified by support' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          user_no: user.userNo,
          auth_key: userAuthAccount.authKey,
          revoked_sessions: 2,
          changed: true,
        });
      });

    expect(userAuthAccount.credentialHash).not.toBe('old-password-hash');
    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: user.id, revokedAt: null }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_reset_user_password',
          metadata: expect.objectContaining({
            user_no: user.userNo,
            auth_key: userAuthAccount.authKey,
            revoked_sessions: 2,
            reason: 'user verified by support',
          }),
        }),
      }),
    );
  });

  it('lists creates and revokes registration invite codes', async () => {
    const token = await adminToken();

    await request(app.getHttpServer())
      .get('/api/v1/admin/invites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.list[0]).toMatchObject({
          invite_no: registrationInvite.inviteNo,
          status: 'pending',
          created_by_username: adminSuper.username,
        });
        expect(response.body.data.list[0].invite_code).toBeUndefined();
      });

    await request(app.getHttpServer())
      .post('/api/v1/admin/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ mobile: '13900000000', expires_in_hours: 24 })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.invite_code).toMatch(/^NL-[0-9A-F]{6}-[0-9A-F]{6}$/);
        expect(response.body.data.invitee_mobile).toBe('13900000000');
      });

    expect(prismaMock.registrationInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteNo: expect.stringMatching(/^reg_invite_/),
          inviteeMobile: '13900000000',
          createdByAdminId: adminSuper.id,
          status: 1,
        }),
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/invites/${registrationInvite.inviteNo}/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          invite_no: registrationInvite.inviteNo,
          status: 'revoked',
          changed: true,
        });
      });
  });

  it('retries and cancels AI jobs with state checks and queue handoff', async () => {
    const token = await adminToken();

    await request(app.getHttpServer())
      .post(`/api/v1/admin/ai-jobs/${aiJob.jobNo}/retry`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'manual retry' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({ job_no: aiJob.jobNo, status: 'pending', retry_count: 2, changed: true });
      });

    expect(enqueue).toHaveBeenCalledWith(aiJob.id);

    aiJob.status = 'pending';
    await request(app.getHttpServer())
      .post(`/api/v1/admin/ai-jobs/${aiJob.jobNo}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'operator cancel' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({ job_no: aiJob.jobNo, status: 'cancelled', changed: true });
      });
  });

  it('passes audit log filters to the query layer', async () => {
    const token = await adminToken();
    prismaMock.auditLog.count.mockClear();

    await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?action=admin_retry_ai_job&target_type=ai_job&start_time=2026-05-10T00:00:00.000Z&end_time=2026-05-10T23:59:59.000Z')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(prismaMock.auditLog.count).toHaveBeenCalledWith({
      where: {
        action: 'admin_retry_ai_job',
        targetType: 'ai_job',
        createdAt: {
          gte: new Date('2026-05-10T00:00:00.000Z'),
          lte: new Date('2026-05-10T23:59:59.000Z'),
        },
      },
    });
  });
});

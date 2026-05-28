import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    ownerUserId: user.id,
    name: '小满家庭',
    status: 1,
    createdAt: now,
    updatedAt: now,
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

  const archiveExportRequest = {
    id: BigInt(70),
    requestNo: 'handoff_001',
    userId: user.id,
    familyId: family.id,
    childId: child.id,
    exportType: 'all',
    purpose: 'adult_handoff',
    status: 'submitted',
    contact: '13800000000',
    note: '成年移交前完整打包',
    recordCount: 12,
    milestoneCount: 3,
    mediaCount: 18,
    firstRecordTime: new Date('2026-01-01T00:00:00.000Z'),
    latestRecordTime: now,
    processedByAdminId: null as bigint | null,
    processedAt: null as Date | null,
    processNote: null as string | null,
    createdAt: now,
    updatedAt: now,
    user,
    family,
    child,
    processedByAdmin: null as typeof adminSuper | null,
  };

  const supportTicket = {
    id: BigInt(80),
    ticketNo: 'fb_001',
    userId: user.id,
    category: '数据异常',
    topic: 'account-delete',
    content: '申请注销账号，并确认儿童档案后续处理。',
    contact: '13800000000',
    status: 'submitted',
    priority: 'child_safety',
    assignedAdminId: null as bigint | null,
    handledAt: null as Date | null,
    handleNote: null as string | null,
    createdAt: now,
    updatedAt: now,
    user,
    assignedAdmin: null as typeof adminSuper | null,
  };

  const systemConfig = {
    id: BigInt(90),
    configKey: 'backup_retention_days',
    category: 'backup_recovery',
    label: '备份保留周期',
    value: '120',
    valueType: 'number',
    description: '生产备份至少建议保留 90 天，用于长期家庭档案恢复窗口。',
    updatedByAdminId: adminSuper.id,
    createdAt: now,
    updatedAt: now,
    updatedByAdmin: adminSuper,
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

  const getFamilyListItem = () => ({
    ...family,
    owner: user,
    _count: {
      members: 1,
      children: 1,
      records: 1,
      media: 1,
      archiveExportRequests: 1,
    },
  });

  const getFamilyDetail = () => ({
    ...family,
    owner: user,
    members: [familyMember],
    children: [child],
    records: [recordWithRelations],
    archiveExportRequests: [archiveExportRequest],
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
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        Object.assign(user, data, { updatedAt: now });
        Object.assign(userWithRelations, data, { updatedAt: now });
        return { ...userWithRelations };
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
    family: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockImplementation(async () => [getFamilyListItem()]),
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.familyNo === family.familyNo) return getFamilyDetail();
        return null;
      }),
    },
    child: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(childWithRelations),
    },
    record: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockImplementation(async () => [{ ...recordWithRelations, ...record }]),
      findFirst: jest.fn().mockResolvedValue(recordWithRelations),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        record.status = data.status;
        record.publishedAt = data.publishedAt;
        return { ...record };
      }),
    },
    recordMedia: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockImplementation(async () => [{ ...mediaWithRelations, ...media }]),
      findFirst: jest.fn().mockResolvedValue(mediaWithRelations),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        media.status = data.status;
        return { ...media };
      }),
    },
    aiJob: {
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([{ status: 'failed', _count: 1 }]),
      findMany: jest.fn().mockImplementation(async () => [getAiJobWithRelations()]),
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
    archiveExportRequest: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([archiveExportRequest]),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return where.requestNo === archiveExportRequest.requestNo ? { ...archiveExportRequest } : null;
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        Object.assign(archiveExportRequest, data, {
          updatedAt: now,
          processedByAdmin: adminSuper,
        });
        return { ...archiveExportRequest };
      }),
    },
    supportTicket: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([supportTicket]),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return where.ticketNo === supportTicket.ticketNo ? { ...supportTicket } : null;
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        Object.assign(supportTicket, data, {
          updatedAt: now,
          assignedAdmin: adminSuper,
        });
        return { ...supportTicket };
      }),
    },
    systemConfig: {
      findMany: jest.fn().mockImplementation(async () => [{ ...systemConfig }]),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
        return where.configKey === systemConfig.configKey ? { ...systemConfig } : null;
      }),
      upsert: jest.fn().mockImplementation(async ({ create, update }: any) => {
        Object.assign(systemConfig, {
          ...(systemConfig.configKey === create.configKey ? update : create),
          id: systemConfig.id,
          configKey: create.configKey,
          updatedAt: now,
          updatedByAdmin: adminSuper,
        });
        return { ...systemConfig };
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
    record.contentText = '今天自己骑了一小段。';
    record.status = 2;
    record.publishedAt = now;
    media.recordId = record.id;
    media.status = 2;
    aiJob.status = 'failed';
    aiJob.errorMessage = 'timeout';
    aiJob.retryCount = 1;
    registrationInvite.status = 1;
    registrationInvite.acceptedAt = null;
    registrationInvite.acceptedByUserId = null;
    archiveExportRequest.status = 'submitted';
    archiveExportRequest.processedByAdminId = null;
    archiveExportRequest.processedAt = null;
    archiveExportRequest.processNote = null;
    archiveExportRequest.processedByAdmin = null;
    supportTicket.status = 'submitted';
    supportTicket.assignedAdminId = null;
    supportTicket.handledAt = null;
    supportTicket.handleNote = null;
    supportTicket.assignedAdmin = null;
    Object.assign(systemConfig, {
      configKey: 'backup_retention_days',
      category: 'backup_recovery',
      label: '备份保留周期',
      value: '120',
      valueType: 'number',
      description: '生产备份至少建议保留 90 天，用于长期家庭档案恢复窗口。',
      updatedByAdminId: adminSuper.id,
      updatedAt: now,
      updatedByAdmin: adminSuper,
    });
    user.membershipType = 'free';
    user.membershipExpireAt = null;
    userWithRelations.membershipType = 'free';
    userWithRelations.membershipExpireAt = null;
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

  it('returns system operations readiness with configuration and backup checks', async () => {
    const token = await adminToken();

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/ops-readiness')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      environment: {
        app_env: expect.any(String),
        app_port: expect.any(Number),
      },
      data_statistics: {
        users: 1,
        families: 1,
        children: 1,
        records: 1,
        media: 1,
        pending_archive_export_requests: 1,
        open_support_tickets: 1,
        content_risks: 4,
        media_exceptions: 1,
        failed_media: 1,
        failed_ai_jobs: 1,
      },
      backup_recovery: {
        status: expect.stringMatching(/ready|warning|blocked/),
        checks: expect.arrayContaining([
          expect.objectContaining({ key: 'alert_contact', label: '告警联系人' }),
        ]),
      },
      release_gates: {
        status: expect.stringMatching(/ready|warning|blocked/),
        report: expect.objectContaining({
          status: expect.stringMatching(/passed|failed|missing|invalid|stale/),
          path: expect.any(String),
        }),
        checks: expect.arrayContaining([
          expect.objectContaining({ key: 'ai_live_readiness', label: 'AI 真实调用' }),
          expect.objectContaining({ key: 'poi_live_readiness', label: '地点 POI 真实搜索' }),
          expect.objectContaining({ key: 'live_readiness_report', label: '上线复验报告' }),
        ]),
      },
    });
    expect(response.body.data.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'storage', label: '对象存储' }),
        expect.objectContaining({ key: 'ai', label: 'AI 服务' }),
      ]),
    );
    expect(response.body.data.action_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '复验真实 provider', to: '/ops-readiness' }),
        expect.objectContaining({ label: '处理内容风险', to: '/content-risks' }),
        expect.objectContaining({ label: '处理档案交付申请', to: '/archive-export-requests' }),
      ]),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_view_ops_readiness',
          targetType: 'list',
        }),
      }),
    );
  });

  it('lists and updates system configs with audit metadata', async () => {
    const token = await adminToken();
    prismaMock.systemConfig.findMany.mockClear();
    prismaMock.systemConfig.upsert.mockClear();

    await request(app.getHttpServer())
      .get('/api/v1/admin/system-configs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.total).toBeGreaterThanOrEqual(5);
        expect(response.body.data.list).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              config_key: 'backup_retention_days',
              label: '备份保留周期',
              value: '120',
              source: 'admin',
              updated_by_name: adminSuper.displayName,
            }),
            expect.objectContaining({
              config_key: 'alert_contact_name',
              label: '告警联系人',
              source: 'environment',
            }),
          ]),
        );
      });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_list_system_configs',
          targetType: 'list',
        }),
      }),
    );

    await request(app.getHttpServer())
      .patch('/api/v1/admin/system-configs/backup_retention_days')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: '180', reason: '上线前提高长期档案备份窗口' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          config_key: 'backup_retention_days',
          value: '180',
          source: 'admin',
          changed: true,
        });
      });

    expect(prismaMock.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { configKey: 'backup_retention_days' },
        update: expect.objectContaining({
          value: '180',
          updatedByAdminId: adminSuper.id,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_update_system_config',
          targetType: 'system_config',
          metadata: expect.objectContaining({
            config_key: 'backup_retention_days',
            before_value: '120',
            after_value: '180',
            reason: '上线前提高长期档案备份窗口',
          }),
        }),
      }),
    );
  });

  it('lists families and returns family detail for operations', async () => {
    const token = await adminToken();
    prismaMock.family.count.mockClear();
    prismaMock.family.findMany.mockClear();
    prismaMock.family.findFirst.mockClear();

    await request(app.getHttpServer())
      .get('/api/v1/admin/families?keyword=13800000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.list[0]).toMatchObject({
          family_no: family.familyNo,
          family_name: family.name,
          owner_user_no: user.userNo,
          owner_name: user.nickname,
          owner_mobile: user.mobile,
          status: 'active',
          members_count: 1,
          children_count: 1,
          records_count: 1,
          media_count: 1,
          archive_export_requests_count: 1,
        });
      });

    expect(prismaMock.family.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: null,
        OR: expect.any(Array),
      }),
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_list_families',
          targetType: 'list',
        }),
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/admin/families/${family.familyNo}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          family_no: family.familyNo,
          family_name: family.name,
          owner_user_no: user.userNo,
          owner_name: user.nickname,
          status: 'active',
          members: [expect.objectContaining({ user_no: user.userNo, role: 'owner' })],
          children: [expect.objectContaining({ child_no: child.childNo, name: child.name })],
          recent_records: [expect.objectContaining({ record_no: record.recordNo, child_no: child.childNo })],
          archive_export_requests: [expect.objectContaining({ request_no: archiveExportRequest.requestNo, purpose: 'adult_handoff' })],
        });
      });

    expect(prismaMock.family.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyNo: family.familyNo, deletedAt: null },
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_view_family_detail',
          targetType: 'list',
        }),
      }),
    );
  });

  it('marks live provider gates ready when a fresh live readiness report passed', async () => {
    const token = await adminToken();
    const oldReportPath = process.env.LIVE_READINESS_REPORT_PATH;
    const oldAiProvider = process.env.AI_PROVIDER;
    const oldMapProvider = process.env.MAP_PROVIDER;
    const tempDir = mkdtempSync(join(tmpdir(), 'nianlun-live-readiness-'));
    const reportFile = join(tempDir, 'live-readiness.json');

    writeFileSync(
      reportFile,
      JSON.stringify({
        status: 'passed',
        checkedAt: new Date().toISOString(),
        providers: { ai: 'openai-compatible', map: 'amap', storage: 'minio' },
        checks: [
          { name: 'aiPreview', status: 'passed', data: { hasSummary: true } },
          { name: 'poi', status: 'passed', data: { poiCount: 3 } },
        ],
        failures: [],
        nextActions: [],
      }),
      'utf8',
    );

    process.env.LIVE_READINESS_REPORT_PATH = reportFile;
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.MAP_PROVIDER = 'amap';

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/ops-readiness')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.release_gates).toMatchObject({
        status: 'ready',
        report: expect.objectContaining({
          status: 'passed',
          path: reportFile,
        }),
      });
      expect(response.body.data.release_gates.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'ai_live_readiness', status: 'ready' }),
          expect.objectContaining({ key: 'poi_live_readiness', status: 'ready' }),
          expect.objectContaining({ key: 'live_readiness_report', status: 'ready' }),
        ]),
      );
    } finally {
      if (oldReportPath === undefined) delete process.env.LIVE_READINESS_REPORT_PATH;
      else process.env.LIVE_READINESS_REPORT_PATH = oldReportPath;
      if (oldAiProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = oldAiProvider;
      if (oldMapProvider === undefined) delete process.env.MAP_PROVIDER;
      else process.env.MAP_PROVIDER = oldMapProvider;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('blocks live provider gates when report provider evidence no longer matches runtime config', async () => {
    const token = await adminToken();
    const oldReportPath = process.env.LIVE_READINESS_REPORT_PATH;
    const oldAiProvider = process.env.AI_PROVIDER;
    const oldMapProvider = process.env.MAP_PROVIDER;
    const tempDir = mkdtempSync(join(tmpdir(), 'nianlun-live-readiness-'));
    const reportFile = join(tempDir, 'live-readiness.json');

    writeFileSync(
      reportFile,
      JSON.stringify({
        status: 'passed',
        checkedAt: new Date().toISOString(),
        providers: { ai: 'openai', map: 'amap', storage: 'minio' },
        checks: [
          { name: 'aiPreview', status: 'passed', data: { hasSummary: true } },
          { name: 'poi', status: 'passed', data: { poiCount: 3 } },
        ],
        failures: [],
        nextActions: [],
      }),
      'utf8',
    );

    process.env.LIVE_READINESS_REPORT_PATH = reportFile;
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.MAP_PROVIDER = 'amap';

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/ops-readiness')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.release_gates.status).toBe('blocked');
      expect(response.body.data.release_gates.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'ai_live_readiness', status: 'blocked', helper: expect.stringContaining('provider') }),
          expect.objectContaining({ key: 'poi_live_readiness', status: 'ready' }),
        ]),
      );
    } finally {
      if (oldReportPath === undefined) delete process.env.LIVE_READINESS_REPORT_PATH;
      else process.env.LIVE_READINESS_REPORT_PATH = oldReportPath;
      if (oldAiProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = oldAiProvider;
      if (oldMapProvider === undefined) delete process.env.MAP_PROVIDER;
      else process.env.MAP_PROVIDER = oldMapProvider;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps provider action priority aligned to a conditional P1-only live readiness report', async () => {
    const token = await adminToken();
    const oldReportPath = process.env.LIVE_READINESS_REPORT_PATH;
    const oldAiProvider = process.env.AI_PROVIDER;
    const oldMapProvider = process.env.MAP_PROVIDER;
    const tempDir = mkdtempSync(join(tmpdir(), 'nianlun-live-readiness-'));
    const reportFile = join(tempDir, 'live-readiness.json');

    writeFileSync(
      reportFile,
      JSON.stringify({
        status: 'conditional_pass',
        checkedAt: new Date().toISOString(),
        providers: { ai: 'openai-compatible', map: 'amap', storage: 'minio' },
        checks: [
          { name: 'aiPreview', status: 'passed', data: { hasSummary: true } },
          { name: 'poi', status: 'failed', error: 'INVALID_USER_KEY' },
        ],
        failures: [{ name: 'poi', error: 'INVALID_USER_KEY' }],
        blockedRequirements: ['P1-03 地点真实 POI'],
        blockedRequirementDetails: [
          {
            requirement: 'P1-03 地点真实 POI',
            severity: 'P1',
            owner: '地图服务配置负责人',
            evidence: '登录后 /locations/search 返回 source=amap 的文本 POI 候选',
            next_action: '替换真实可用的高德 Web 服务 Key 后重新执行带测试账号的 verify:live-readiness。',
          },
        ],
        nextActions: ['替换真实可用的高德 Web 服务 Key 后重新执行带测试账号的 verify:live-readiness。'],
      }),
      'utf8',
    );

    process.env.LIVE_READINESS_REPORT_PATH = reportFile;
    process.env.AI_PROVIDER = 'openai-compatible';
    process.env.MAP_PROVIDER = 'amap';

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/ops-readiness')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.release_gates.status).toBe('warning');
      expect(response.body.data.release_gates.report.status).toBe('conditional_pass');
      expect(response.body.data.release_gates.report.blocked_requirement_details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requirement: 'P1-03 地点真实 POI',
            severity: 'P1',
            owner: '地图服务配置负责人',
          }),
        ]),
      );
      expect(response.body.data.release_gates.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'ai_live_readiness', status: 'ready' }),
          expect.objectContaining({ key: 'poi_live_readiness', status: 'warning' }),
          expect.objectContaining({ key: 'live_readiness_report', status: 'warning' }),
        ]),
      );
      expect(response.body.data.action_items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'P1',
            label: '复验真实 provider',
            helper: expect.stringContaining('P1 P1-03 地点真实 POI'),
          }),
        ]),
      );
    } finally {
      if (oldReportPath === undefined) delete process.env.LIVE_READINESS_REPORT_PATH;
      else process.env.LIVE_READINESS_REPORT_PATH = oldReportPath;
      if (oldAiProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = oldAiProvider;
      if (oldMapProvider === undefined) delete process.env.MAP_PROVIDER;
      else process.env.MAP_PROVIDER = oldMapProvider;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists content risk items across records media support and AI queues', async () => {
    const token = await adminToken();
    record.contentText = '记录里出现疑似虐待描述，需要内容安全复核。';
    media.status = 3;
    prismaMock.record.findMany.mockClear();
    prismaMock.recordMedia.findMany.mockClear();
    prismaMock.supportTicket.findMany.mockClear();
    prismaMock.aiJob.findMany.mockClear();

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/content-risks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.total).toBe(4);
    expect(response.body.data.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'content_safety',
          severity: 'p0',
          source_no: record.recordNo,
          action_to: '/records',
        }),
        expect.objectContaining({
          category: 'media_exception',
          severity: 'p0',
          source_no: media.mediaNo,
          action_to: '/media',
        }),
        expect.objectContaining({
          category: 'child_safety',
          severity: 'p0',
          source_no: supportTicket.ticketNo,
          action_to: '/support-tickets',
        }),
        expect.objectContaining({
          category: 'ai_exception',
          severity: 'p1',
          source_no: aiJob.jobNo,
          action_to: '/ai-jobs',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/content-risks?category=content_safety&severity=p0&keyword=虐待')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((filteredResponse) => {
        expect(filteredResponse.body.data.total).toBe(1);
        expect(filteredResponse.body.data.list[0]).toMatchObject({
          risk_no: `record:${record.recordNo}`,
          reason: '疑似儿童安全或伤害内容（命中：虐待）',
        });
      });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_list_content_risks',
          targetType: 'list',
        }),
      }),
    );
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

  it('updates user membership entitlements with audit metadata', async () => {
    const token = await adminToken();
    const expireAt = '2099-12-31T23:59:59.000Z';
    prismaMock.user.update.mockClear();

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${user.userNo}/membership`)
      .set('Authorization', `Bearer ${token}`)
      .send({ membership_type: 'ai_plus', membership_expire_at: expireAt, reason: '年付套餐开通' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          user_no: user.userNo,
          membership_type: 'ai_plus',
          membership_expire_at: expireAt,
          changed: true,
        });
      });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: {
          membershipType: 'ai_plus',
          membershipExpireAt: new Date(expireAt),
        },
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_update_user_membership',
          targetType: 'user',
          targetId: user.id,
          metadata: expect.objectContaining({
            user_no: user.userNo,
            before_membership_type: 'free',
            after_membership_type: 'ai_plus',
            after_membership_expire_at: expireAt,
            reason: '年付套餐开通',
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

  it('lists and processes support tickets with audit metadata', async () => {
    const token = await adminToken();
    prismaMock.supportTicket.count.mockClear();
    prismaMock.supportTicket.update.mockClear();

    await request(app.getHttpServer())
      .get('/api/v1/admin/support-tickets?status=submitted&priority=child_safety&keyword=注销')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.list[0]).toMatchObject({
          ticket_no: supportTicket.ticketNo,
          user_no: user.userNo,
          category: '数据异常',
          priority: 'child_safety',
          status: 'submitted',
        });
      });

    expect(prismaMock.supportTicket.count).toHaveBeenCalledWith({
      where: {
        status: 'submitted',
        priority: 'child_safety',
        OR: expect.any(Array),
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/support-tickets/${supportTicket.ticketNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'processing', note: '客服已确认监护人身份，开始处理儿童信息请求' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          ticket_no: supportTicket.ticketNo,
          status: 'processing',
          assigned_admin_name: adminSuper.displayName,
          handle_note: '客服已确认监护人身份，开始处理儿童信息请求',
          changed: true,
        });
      });

    expect(prismaMock.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: supportTicket.id },
        data: expect.objectContaining({
          status: 'processing',
          assignedAdminId: adminSuper.id,
          handleNote: '客服已确认监护人身份，开始处理儿童信息请求',
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_support_ticket_start_processing',
          targetType: 'support_ticket',
          targetId: supportTicket.id,
          metadata: expect.objectContaining({
            ticket_no: supportTicket.ticketNo,
            after_status: 'processing',
            priority: 'child_safety',
            user_no: user.userNo,
          }),
        }),
      }),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/support-tickets/${supportTicket.ticketNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', note: '已完成注销前信息核验，并通知用户后续步骤' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          ticket_no: supportTicket.ticketNo,
          status: 'resolved',
          handle_note: '已完成注销前信息核验，并通知用户后续步骤',
          changed: true,
        });
      });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_support_ticket_resolve',
          targetType: 'support_ticket',
          targetId: supportTicket.id,
          metadata: expect.objectContaining({
            before_status: 'processing',
            after_status: 'resolved',
          }),
        }),
      }),
    );
  });

  it('lists and processes archive export requests with audit metadata', async () => {
    const token = await adminToken();
    prismaMock.archiveExportRequest.count.mockClear();
    prismaMock.archiveExportRequest.update.mockClear();

    await request(app.getHttpServer())
      .get('/api/v1/admin/archive-export-requests?purpose=adult_handoff&status=submitted')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.list[0]).toMatchObject({
          request_no: archiveExportRequest.requestNo,
          user_no: user.userNo,
          child_no: child.childNo,
          purpose: 'adult_handoff',
          status: 'submitted',
          record_count: 12,
          media_count: 18,
        });
      });

    expect(prismaMock.archiveExportRequest.count).toHaveBeenCalledWith({
      where: {
        purpose: 'adult_handoff',
        status: 'submitted',
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/archive-export-requests/${archiveExportRequest.requestNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'processing', note: '身份核验通过，开始整理资产' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          request_no: archiveExportRequest.requestNo,
          status: 'processing',
          processed_by_name: adminSuper.displayName,
          process_note: '身份核验通过，开始整理资产',
          changed: true,
        });
      });

    expect(prismaMock.archiveExportRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: archiveExportRequest.id },
        data: expect.objectContaining({
          status: 'processing',
          processedByAdminId: adminSuper.id,
          processNote: '身份核验通过，开始整理资产',
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_archive_export_start_processing',
          targetType: 'archive_export_request',
          targetId: archiveExportRequest.id,
          metadata: expect.objectContaining({
            request_no: archiveExportRequest.requestNo,
            after_status: 'processing',
            purpose: 'adult_handoff',
            child_no: child.childNo,
          }),
        }),
      }),
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/archive-export-requests/${archiveExportRequest.requestNo}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed', note: '交付包已生成并完成移交确认' })
      .expect(200)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          request_no: archiveExportRequest.requestNo,
          status: 'completed',
          process_note: '交付包已生成并完成移交确认',
          changed: true,
        });
      });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin_archive_export_complete',
          targetType: 'archive_export_request',
          targetId: archiveExportRequest.id,
          metadata: expect.objectContaining({
            before_status: 'processing',
            after_status: 'completed',
          }),
        }),
      }),
    );
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

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';

describe('Admin RBAC and media contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const adminViewer = {
    id: BigInt(11),
    username: 'viewer',
    role: 'viewer',
    displayName: '只读管理员',
    status: 1,
    deletedAt: null,
  };

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
    nickname: '上传用户',
    status: 1,
    membershipType: 'free',
    mobile: '13800000000',
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
    lastLoginAt: null,
    deletedAt: null,
  };

  const family = { id: BigInt(10), familyNo: 'f_001', deletedAt: null };
  const child = { id: BigInt(20), childNo: 'c_001', familyId: family.id, deletedAt: null };
  const membership = { id: BigInt(1), familyId: family.id, userId: user.id, role: 'owner', status: 1, deletedAt: null };
  const media = {
    id: BigInt(30),
    mediaNo: 'm_001',
    familyId: family.id,
    childId: child.id,
    objectKey: 'families/f_001/children/c_001/2026/04/m_001.jpg',
    status: 2,
    deletedAt: null,
  };

  const transactionClient = {};

  const prismaMock = {
    adminUser: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint; status?: number } }) => {
        const matchesStatus = (admin: { status: number }) => where.status === undefined || where.status === admin.status;
        if (where.id === adminViewer.id && matchesStatus(adminViewer)) return adminViewer;
        if (where.id === adminSuper.id && matchesStatus(adminSuper)) return adminSuper;
        return null;
      }),
    },
    auditLog: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          actorType: 'admin',
          actorId: adminSuper.id,
          action: 'admin_login',
          targetType: 'admin_user',
          targetId: adminSuper.id,
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          createdAt: new Date('2026-04-21T00:00:00.000Z'),
        },
      ]),
      create: jest.fn(),
    },
    user: {
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: bigint }; data: { status: number } }) => {
        if (where.id === user.id) {
          user.status = data.status;
          return user;
        }
        return user;
      }),
      findFirst: jest.fn().mockResolvedValue(user),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([user]),
    },
    child: {
      findFirst: jest.fn().mockResolvedValue({ ...child, family }),
    },
    family: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(family),
    },
    familyMember: {
      findFirst: jest.fn().mockResolvedValue(membership),
    },
    recordMedia: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => ({ mediaNo: 'm_new', ...data })),
      findFirst: jest.fn().mockResolvedValue(media),
      update: jest.fn().mockResolvedValue({
        mediaNo: media.mediaNo,
        width: 100,
        height: 100,
        durationSeconds: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: typeof transactionClient) => unknown)(transactionClient);
      }

      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return input;
    }),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.STORAGE_PROVIDER = 'mock';
    process.env.UPLOAD_IMAGE_MAX_BYTES = '10485760';

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

  it('denies audit log access to viewer admins', async () => {
    adminViewer.status = 1;
    const viewerToken = await jwtService.signAsync(
      { type: 'admin', sub: adminViewer.id.toString(), username: adminViewer.username, role: adminViewer.role },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('rejects disabled admins with an existing access token', async () => {
    adminViewer.status = 2;
    const viewerToken = await jwtService.signAsync(
      { type: 'admin', sub: adminViewer.id.toString(), username: adminViewer.username, role: adminViewer.role },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(401);

    adminViewer.status = 1;
  });

  it('allows super admin audit log access and returns upload token expiry fields', async () => {
    adminSuper.status = 1;
    const superToken = await jwtService.signAsync(
      { type: 'admin', sub: adminSuper.id.toString(), username: adminSuper.username, role: adminSuper.role },
      { secret: process.env.JWT_ACCESS_SECRET },
    );
    const userToken = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const auditResponse = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(auditResponse.body.data.list[0]).toMatchObject({ action: 'admin_login' });

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/media/upload-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        child_no: child.childNo,
        file_name: 'photo.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 1024,
        media_type: 'image',
      })
      .expect(201);

    expect(uploadResponse.body.data).toMatchObject({
      media_no: expect.any(String),
      expires_in: expect.any(Number),
      expire_at: expect.any(String),
    });

    const videoUploadResponse = await request(app.getHttpServer())
      .post('/api/v1/media/upload-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        child_no: child.childNo,
        file_name: 'first-step.mp4',
        mime_type: 'video/mp4',
        size_bytes: 2048,
        media_type: 'video',
      })
      .expect(201);

    expect(videoUploadResponse.body.data).toMatchObject({
      media_no: expect.any(String),
      expires_in: expect.any(Number),
      expire_at: expect.any(String),
    });

    const heicUploadResponse = await request(app.getHttpServer())
      .post('/api/v1/media/upload-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        child_no: child.childNo,
        file_name: 'iphone-photo.heic',
        mime_type: 'image/heic',
        size_bytes: 2048,
        media_type: 'image',
      })
      .expect(201);

    expect(heicUploadResponse.body.data.object_key).toMatch(/\.heic$/);

    const audioUploadResponse = await request(app.getHttpServer())
      .post('/api/v1/media/upload-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        child_no: child.childNo,
        file_name: 'voice.m4a',
        mime_type: 'audio/x-m4a',
        size_bytes: 2048,
        media_type: 'audio',
      })
      .expect(201);

    expect(audioUploadResponse.body.data.object_key).toMatch(/\.m4a$/);

    const recordedAudioUploadResponse = await request(app.getHttpServer())
      .post('/api/v1/media/upload-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        child_no: child.childNo,
        file_name: 'native-recording.webm',
        mime_type: 'audio/webm;codecs=opus',
        size_bytes: 2048,
        media_type: 'audio',
      })
      .expect(201);

    expect(recordedAudioUploadResponse.body.data.object_key).toMatch(/\.webm$/);

    const mobileVideoUploadResponse = await request(app.getHttpServer())
      .post('/api/v1/media/upload-token')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        child_no: child.childNo,
        file_name: 'native-video.3gp',
        mime_type: 'video/3gpp',
        size_bytes: 2048,
        media_type: 'video',
      })
      .expect(201);

    expect(mobileVideoUploadResponse.body.data.object_key).toMatch(/\.3gp$/);
  });

  it('allows super admin to disable and re-enable a user with audit logging', async () => {
    const superToken = await jwtService.signAsync(
      { type: 'admin', sub: adminSuper.id.toString(), username: adminSuper.username, role: adminSuper.role },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    const disableResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${user.userNo}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'disabled', reason: 'manual review' })
      .expect(200);

    expect(disableResponse.body.data).toMatchObject({
      user_no: user.userNo,
      status: 'disabled',
      changed: true,
    });

    const enableResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${user.userNo}/status`)
      .set('Authorization', `Bearer ${superToken}`)
      .send({ status: 'active', reason: 'restore access' })
      .expect(200);

    expect(enableResponse.body.data).toMatchObject({
      user_no: user.userNo,
      status: 'active',
      changed: true,
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../../src/app.module';
import { AiJobsQueue } from '../../src/modules/ai-jobs/ai-jobs.queue';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';

describe('AI jobs async contract', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const enqueue = jest.fn();

  const user = { id: BigInt(1), userNo: 'u_001', nickname: '测试用户', deletedAt: null };
  const record = {
    id: BigInt(10),
    recordNo: 'r_001',
    familyId: BigInt(100),
    contentText: '今天小满第一次自己吃饭。',
    title: '第一次吃饭',
    eventTime: new Date('2026-04-19T10:00:00.000Z'),
    tags: [{ tagName: '成长' }],
  };

  const aiJobs: Array<any> = [];

  const transactionClient = {
    aiJob: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const job = {
          id: BigInt(aiJobs.length + 1),
          jobNo: data.jobNo,
          jobType: data.jobType,
          familyId: data.familyId,
          recordId: data.recordId,
          requesterUserId: data.requesterUserId,
          provider: data.provider,
          status: data.status,
          inputSnapshot: data.inputSnapshot,
          outputJson: null,
          errorMessage: null,
          retryCount: 0,
          startedAt: null,
          finishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          record,
        };
        aiJobs.push(job);
        return job;
      }),
    },
  };

  const prismaMock = {
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint } }) => {
        if (where.id === user.id) {
          return user;
        }
        return null;
      }),
    },
    record: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { recordNo?: string } }) => {
        if (where.recordNo === record.recordNo) {
          return {
            ...record,
            child: { childNo: 'c_001' },
            creator: { userNo: user.userNo, nickname: user.nickname },
            media: [],
            tags: record.tags,
          };
        }
        return null;
      }),
    },
    familyMember: {
      findFirst: jest.fn().mockResolvedValue({ familyId: record.familyId, userId: user.id, role: 'owner', deletedAt: null }),
    },
    aiJob: {
      count: jest.fn().mockResolvedValue(0),
      create: transactionClient.aiJob.create,
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { jobNo: string } }) => {
        return aiJobs.find((job) => job.jobNo === where.jobNo) ?? null;
      }),
    },
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: typeof transactionClient) => unknown)(transactionClient);
      }
      return input;
    }),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.AI_PROVIDER = 'mock';
    process.env.AI_DAILY_LIMIT_PER_USER = '20';

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

  beforeEach(() => {
    enqueue.mockClear();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('creates pending jobs and enqueues them instead of processing inline', async () => {
    const token = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .post(`/api/v1/records/${record.recordNo}/ai-jobs`)
      .set('Authorization', `Bearer ${token}`)
      .send({ job_types: ['record_title', 'record_summary'] })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.list).toHaveLength(2);
        expect(response.body.data.list[0].status).toBe('pending');
        expect(response.body.data.list[1].status).toBe('pending');
      });

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenNthCalledWith(1, BigInt(1));
    expect(enqueue).toHaveBeenNthCalledWith(2, BigInt(2));
  });

  it('returns ai preview without creating a job', async () => {
    const token = await jwtService.signAsync(
      { type: 'user', sub: user.id.toString(), user_no: user.userNo },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await request(app.getHttpServer())
      .post('/api/v1/ai-jobs/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '第一次吃饭', content_text: '今天第一次自己吃饭', tags: ['成长'] })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toEqual(
          expect.objectContaining({
            suggested_title: expect.any(String),
            summary: expect.any(String),
            tags: expect.arrayContaining(['成长']),
            provider: 'mock',
          }),
        );
      });

    expect(enqueue).not.toHaveBeenCalled();
  });
});

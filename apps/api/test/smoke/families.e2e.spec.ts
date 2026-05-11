import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApiExceptionFilter } from '../../src/shared/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/shared/api-response.interceptor';

describe('Families invite flow', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const owner = {
    id: BigInt(1),
    userNo: 'u_owner',
    nickname: '家长',
    mobile: '13800000000',
    deletedAt: null,
  };
  const family = {
    id: BigInt(100),
    familyNo: 'f_001',
    deletedAt: null,
  };

  const invites: Array<{ id: bigint; tokenHash: string; inviteNo: string; familyId: bigint; inviterUserId: bigint; inviteeMobile: string | null; role: 'viewer' | 'editor'; status: number; expiresAt: Date; acceptedAt: Date | null; inviteeUserId: bigint | null }> = [];
  const memberships = [
    {
      id: BigInt(1),
      familyId: family.id,
      userId: owner.id,
      role: 'owner',
      status: 1,
      deletedAt: null,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: owner,
      inviter: null,
    },
  ];

  const prismaMock = {
    family: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { familyNo?: string } }) => {
        return where.familyNo === family.familyNo ? family : null;
      }),
    },
    familyMember: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { familyId: bigint; userId: bigint } }) => {
        return memberships.find((item) => item.familyId === where.familyId && item.userId === where.userId && item.deletedAt === null) ?? null;
      }),
      findMany: jest.fn().mockImplementation(async () => memberships),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: bigint }; data: { role: string } }) => {
        const membership = memberships.find((item) => item.id === where.id)!;
        membership.role = data.role;
        membership.updatedAt = new Date();
        return membership;
      }),
    },
    memberInvite: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (where.tokenHash) {
          const invite = invites.find((item) => item.tokenHash === where.tokenHash) ?? null;
          return invite ? { ...invite, family } : null;
        }
        if (where.familyId && where.inviteeMobile) {
          return invites.find((item) => item.familyId === where.familyId && item.inviteeMobile === where.inviteeMobile && item.status === where.status) ?? null;
        }
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const invite = { id: BigInt(invites.length + 1), acceptedAt: null, inviteeUserId: null, ...data, family };
        invites.push(invite);
        return invite;
      }),
    },
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint; userNo?: string } }) => {
        if (where.id === owner.id) return owner;
        return null;
      }),
    },
    $transaction: jest.fn(async (input: unknown) => input),
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';

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

  it('creates an invite code for registration and lists members', async () => {
    const ownerToken = await jwtService.signAsync({ type: 'user', sub: owner.id.toString(), user_no: owner.userNo }, { secret: process.env.JWT_ACCESS_SECRET });

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/families/${family.familyNo}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mobile: '13900000000', role: 'viewer' })
      .expect(201);

    const inviteToken = createResponse.body.data.invite_token;
    expect(inviteToken).toBeTruthy();

    const membersResponse = await request(app.getHttpServer())
      .get(`/api/v1/families/${family.familyNo}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(createResponse.body.data).toMatchObject({
      family_no: family.familyNo,
      role: 'viewer',
      invitee_mobile: '13900000000',
    });
    expect(membersResponse.body.data.list).toHaveLength(1);
    expect(membersResponse.body.data.list[0].user_no).toBe(owner.userNo);
  });
});

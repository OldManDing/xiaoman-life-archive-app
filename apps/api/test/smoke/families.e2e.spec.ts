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
  const invitee = {
    id: BigInt(2),
    userNo: 'u_viewer',
    nickname: '家人',
    mobile: '13900000000',
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

  const transactionClient = {
    familyMember: {
      upsert: jest.fn().mockImplementation(async ({ where, create, update }: { where: { familyId_userId: { familyId: bigint; userId: bigint } }; create: any; update: any }) => {
        const existing = memberships.find((item) => item.familyId === where.familyId_userId.familyId && item.userId === where.familyId_userId.userId);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }

        const created = {
          id: BigInt(memberships.length + 1),
          ...create,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: invitee,
          inviter: owner,
        };
        memberships.push(created);
        return created;
      }),
    },
    memberInvite: {
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: bigint }; data: any }) => {
        const invite = invites.find((item) => item.id === where.id)!;
        Object.assign(invite, data);
        return invite;
      }),
    },
  };

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
      upsert: transactionClient.familyMember.upsert,
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
      update: transactionClient.memberInvite.update,
    },
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: bigint; userNo?: string } }) => {
        if (where.id === owner.id) return owner;
        if (where.id === invitee.id) return invitee;
        if (where.userNo === invitee.userNo) return invitee;
        return null;
      }),
    },
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: typeof transactionClient) => unknown)(transactionClient);
      }

      return input;
    }),
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
    await app.close();
  });

  it('creates invite, accepts it, and lists members', async () => {
    const ownerToken = await jwtService.signAsync({ type: 'user', sub: owner.id.toString(), user_no: owner.userNo }, { secret: process.env.JWT_ACCESS_SECRET });
    const inviteeToken = await jwtService.signAsync({ type: 'user', sub: invitee.id.toString(), user_no: invitee.userNo }, { secret: process.env.JWT_ACCESS_SECRET });

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/families/${family.familyNo}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ mobile: invitee.mobile, role: 'viewer' })
      .expect(201);

    const inviteToken = createResponse.body.data.invite_token;
    expect(inviteToken).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(201);

    const membersResponse = await request(app.getHttpServer())
      .get(`/api/v1/families/${family.familyNo}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(membersResponse.body.data.list).toHaveLength(2);
    expect(membersResponse.body.data.list[1]).toMatchObject({
      user_no: invitee.userNo,
      role: 'viewer',
    });
  });
});

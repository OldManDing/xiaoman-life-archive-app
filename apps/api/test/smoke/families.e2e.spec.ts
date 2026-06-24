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
    avatarUrl: 'stored://avatar-owner',
    mobile: '13800000000',
    deletedAt: null,
  };
  const editor = {
    id: BigInt(2),
    userNo: 'u_editor',
    nickname: '家人',
    avatarUrl: 'stored://avatar-editor',
    mobile: '13900000000',
    deletedAt: null,
  };
  const family = {
    id: BigInt(100),
    familyNo: 'f_001',
    deletedAt: null,
  };

  const invites: Array<{ id: bigint; tokenHash: string; inviteNo: string; familyId: bigint; inviterUserId: bigint; inviteeMobile: string | null; role: 'viewer' | 'editor'; status: number; expiresAt: Date; acceptedAt: Date | null; inviteeUserId: bigint | null }> = [];
  const auditLogs: Array<{ id: bigint; actorType: string; actorId: bigint; action: string; targetType: string; targetId: bigint | null; metadata: any; createdAt: Date }> = [];
  const memberships: Array<{
    id: bigint;
    familyId: bigint;
    userId: bigint;
    role: 'owner' | 'editor' | 'viewer';
    status: number;
    deletedAt: Date | null;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    user: typeof owner | typeof editor;
    inviter: typeof owner | null;
  }> = [
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
    {
      id: BigInt(2),
      familyId: family.id,
      userId: editor.id,
      role: 'editor',
      status: 1,
      deletedAt: null,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: editor,
      inviter: owner,
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
      findMany: jest.fn().mockImplementation(async () => memberships.filter((item) => item.deletedAt === null && item.status === 1)),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: bigint }; data: { role?: 'owner' | 'editor' | 'viewer'; status?: number; deletedAt?: Date } }) => {
        const membership = memberships.find((item) => item.id === where.id)!;
        if (data.role) membership.role = data.role;
        if (typeof data.status === 'number') membership.status = data.status;
        if (data.deletedAt) membership.deletedAt = data.deletedAt;
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
        if (where.id === editor.id) return editor;
        if (where.userNo === owner.userNo) return owner;
        if (where.userNo === editor.userNo) return editor;
        return null;
      }),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
        const item = {
          id: BigInt(auditLogs.length + 1),
          actorType: data.actorType,
          actorId: data.actorId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          metadata: data.metadata,
          createdAt: new Date(Date.UTC(2026, 5, 21, 10, auditLogs.length, 0)),
        };
        auditLogs.push(item);
        return item;
      }),
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { action: { in: string[] }; targetType: string; targetId: bigint } }) =>
        auditLogs
          .filter((item) => where.action.in.includes(item.action) && item.targetType === where.targetType && item.targetId === where.targetId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      ),
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
    expect(membersResponse.body.data.list).toHaveLength(2);
    expect(membersResponse.body.data.list[0].user_no).toBe(owner.userNo);
    expect(membersResponse.body.data.list[0].avatar_url).toBe(owner.avatarUrl);
  });

  it('updates, lists operations, and removes a family member', async () => {
    const ownerToken = await jwtService.signAsync({ type: 'user', sub: owner.id.toString(), user_no: owner.userNo }, { secret: process.env.JWT_ACCESS_SECRET });

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/v1/families/${family.familyNo}/members/${editor.userNo}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'viewer' })
      .expect(200);

    expect(updateResponse.body.data).toMatchObject({
      family_no: family.familyNo,
      user_no: editor.userNo,
      role: 'viewer',
    });

    const operationsResponse = await request(app.getHttpServer())
      .get(`/api/v1/families/${family.familyNo}/member-operations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(operationsResponse.body.data.list[0]).toMatchObject({
      action: 'family.member_role_updated',
      target_user_no: editor.userNo,
      target_nickname: editor.nickname,
      before_role: 'editor',
      after_role: 'viewer',
    });

    const removeResponse = await request(app.getHttpServer())
      .delete(`/api/v1/families/${family.familyNo}/members/${editor.userNo}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(removeResponse.body.data).toMatchObject({
      family_no: family.familyNo,
      user_no: editor.userNo,
      removed: true,
    });

    const membersResponse = await request(app.getHttpServer())
      .get(`/api/v1/families/${family.familyNo}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(membersResponse.body.data.list.map((item: { user_no: string }) => item.user_no)).toEqual([owner.userNo]);

    const filteredOperationsResponse = await request(app.getHttpServer())
      .get(`/api/v1/families/${family.familyNo}/member-operations`)
      .query({ user_no: editor.userNo })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(filteredOperationsResponse.body.data.list.map((item: { action: string }) => item.action)).toEqual([
      'family.member_removed',
      'family.member_role_updated',
    ]);
  });
});

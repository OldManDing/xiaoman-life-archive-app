import bcrypt from 'bcrypt';

import { UsersService } from '../../src/modules/users/users.service';

describe('UsersService', () => {
  const user = {
    id: BigInt(1),
    userNo: 'u_001',
    nickname: '测试用户',
    avatarUrl: null,
    mobile: null,
    membershipType: 'free',
    membershipExpireAt: null,
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
    deletedAt: null,
  };

  it('returns stable avatar media number with resolved profile avatar URL', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ ...user, avatarUrl: 'media:m_user_avatar' }),
      },
      recordMedia: {
        findFirst: jest.fn().mockResolvedValue({ objectKey: 'avatars/m_user_avatar.jpg', thumbnailObjectKey: 'avatars/m_user_avatar_thumb.jpg' }),
      },
    };
    const storageService = {
      createAccessUrl: jest.fn().mockResolvedValue({ access_url: 'https://cdn.example.test/avatars/m_user_avatar_thumb.jpg' }),
    };
    const service = new UsersService(prisma as never, {} as never, {} as never, storageService as never, {} as never);

    const result = await service.me(user.id);

    expect(result).toMatchObject({
      user_no: user.userNo,
      avatar_url: 'https://cdn.example.test/avatars/m_user_avatar_thumb.jpg',
      avatar_media_no: 'm_user_avatar',
    });
  });

  it('changes password after verifying the current password', async () => {
    const currentHash = await bcrypt.hash('OldPass123', 4);
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({}),
      },
      userAuthAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: BigInt(10),
          credentialHash: currentHash,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      userSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn().mockImplementation(async (operations: unknown[]) => Promise.all(operations)),
    };
    const auditLogService = {
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new UsersService(prisma as never, {} as never, auditLogService as never, {} as never, {} as never);

    const result = await service.changePassword(
      user.id,
      {
        current_password: 'OldPass123',
        new_password: 'NewPass123',
        new_password_confirm: 'NewPass123',
      },
      { ip_address: '127.0.0.1', user_agent: 'jest' },
    );

    expect(result).toMatchObject({ success: true, message: '登录密码已更新' });
    expect(prisma.userAuthAccount.update).toHaveBeenCalledWith({
      where: { id: BigInt(10) },
      data: { credentialHash: expect.any(String) },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { tokenInvalidBefore: expect.any(Date) },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const nextHash = prisma.userAuthAccount.update.mock.calls[0][0].data.credentialHash;
    expect(await bcrypt.compare('NewPass123', nextHash)).toBe(true);
    expect(auditLogService.create).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: user.id,
      action: 'user.password_changed',
      ip_address: '127.0.0.1',
      user_agent: 'jest',
    }));
  });

  it('rejects an incorrect current password', async () => {
    const currentHash = await bcrypt.hash('OldPass123', 4);
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      userAuthAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: BigInt(10),
          credentialHash: currentHash,
        }),
        update: jest.fn(),
      },
    };
    const service = new UsersService(prisma as never, {} as never, { create: jest.fn() } as never, {} as never, {} as never);

    await expect(
      service.changePassword(user.id, {
        current_password: 'WrongPass123',
        new_password: 'NewPass123',
        new_password_confirm: 'NewPass123',
      }),
    ).rejects.toThrow('当前密码不正确');
    expect(prisma.userAuthAccount.update).not.toHaveBeenCalled();
  });
});

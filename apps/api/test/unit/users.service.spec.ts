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

  it('reports a version update even when the APK URL is not configured', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { configKey: 'mobile_latest_version', value: '2.0.3' },
          { configKey: 'mobile_latest_build_number', value: '9' },
          { configKey: 'mobile_release_notes', value: '新增首次进入海报介绍。' },
          { configKey: 'mobile_apk_url', value: '' },
          { configKey: 'mobile_force_update', value: 'false' },
        ]),
      },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.checkAppUpdate(user.id, {
      platform: 'android',
      version: '2.0.2',
      build_number: 8,
    });

    expect(result).toMatchObject({
      latest_version: '2.0.3',
      latest_build_number: 9,
      apk_url: null,
      apk_sha256: null,
      apk_size_bytes: null,
      update_available: true,
      download_available: false,
      force_update: false,
    });
  });

  it('advertises an app update when a downloadable APK URL is configured', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { configKey: 'mobile_latest_version', value: '2.0.3' },
          { configKey: 'mobile_latest_build_number', value: '9' },
          { configKey: 'mobile_release_notes', value: '新增首次进入海报介绍。' },
          { configKey: 'mobile_apk_url', value: 'https://download.example.com/nianlun-v2.0.3.apk' },
          { configKey: 'mobile_apk_sha256', value: 'A'.repeat(64) },
          { configKey: 'mobile_apk_size_bytes', value: '1234567' },
          { configKey: 'mobile_force_update', value: 'false' },
        ]),
      },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.checkAppUpdate(user.id, {
      platform: 'android',
      version: '2.0.2',
      build_number: 8,
    });

    expect(result).toMatchObject({
      latest_version: '2.0.3',
      latest_build_number: 9,
      apk_url: 'https://download.example.com/nianlun-v2.0.3.apk',
      apk_sha256: 'a'.repeat(64),
      apk_size_bytes: 1234567,
      update_available: true,
      download_available: true,
      force_update: false,
    });
  });

  it('rejects non-HTTPS APK config without exposing a download URL', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { configKey: 'mobile_latest_version', value: '2.0.3' },
          { configKey: 'mobile_latest_build_number', value: '9' },
          { configKey: 'mobile_apk_url', value: 'http://download.example.com/nianlun.apk' },
          { configKey: 'mobile_force_update', value: 'false' },
        ]),
      },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.checkAppUpdate(user.id, {
      platform: 'android',
      version: '2.0.2',
      build_number: 8,
    });

    expect(result).toMatchObject({
      update_available: true,
      download_available: false,
      apk_url: null,
    });
  });

  it('uses build number as the authoritative boundary when configured', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { configKey: 'mobile_latest_version', value: '2.0.3' },
          { configKey: 'mobile_latest_build_number', value: '9' },
          { configKey: 'mobile_apk_url', value: 'https://download.example.com/nianlun.apk' },
          { configKey: 'mobile_force_update', value: 'false' },
        ]),
      },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(
      service.checkAppUpdate(user.id, { platform: 'android', version: '2.0.2', build_number: 9 }),
    ).resolves.toMatchObject({ update_available: false, download_available: false });
    await expect(
      service.checkAppUpdate(user.id, { platform: 'android', version: '2.0.4', build_number: 10 }),
    ).resolves.toMatchObject({ update_available: false, download_available: false });
  });

  it('compares prerelease versions when build numbers are unavailable', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { configKey: 'mobile_latest_version', value: '2.0.0' },
          { configKey: 'mobile_latest_build_number', value: '0' },
          { configKey: 'mobile_apk_url', value: 'https://download.example.com/nianlun.apk' },
          { configKey: 'mobile_apk_sha256', value: 'B'.repeat(64) },
          { configKey: 'mobile_apk_size_bytes', value: '1234567' },
          { configKey: 'mobile_force_update', value: 'false' },
        ]),
      },
    };
    const service = new UsersService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(
      service.checkAppUpdate(user.id, { platform: 'android', version: '2.0.0-beta.1', build_number: 0 }),
    ).resolves.toMatchObject({ update_available: true, download_available: true });
    await expect(
      service.checkAppUpdate(user.id, { platform: 'android', version: '2.0.0', build_number: 0 }),
    ).resolves.toMatchObject({ update_available: false, download_available: false });
  });
});

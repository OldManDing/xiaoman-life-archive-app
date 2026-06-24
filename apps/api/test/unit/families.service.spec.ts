import { MEDIA_STATUS_READY } from '../../src/shared/constants';
import { FamiliesService } from '../../src/modules/families/families.service';

describe('FamiliesService', () => {
  it('resolves media avatar references for family members', async () => {
    const family = { id: BigInt(100), familyNo: 'f_001' };
    const joinedAt = new Date('2026-06-22T10:00:00.000Z');
    const prisma = {
      familyMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: BigInt(2),
            user: {
              userNo: 'u_member',
              nickname: '家人',
              avatarUrl: 'media:m_avatar_001',
              mobile: '13900000000',
            },
            inviter: null,
            role: 'editor',
            status: 1,
            joinedAt,
          },
        ]),
      },
      recordMedia: {
        findFirst: jest.fn().mockResolvedValue({ objectKey: 'avatars/m_avatar_001.jpg' }),
      },
    };
    const accessControlService = {
      ensureFamilyReadable: jest.fn().mockResolvedValue({ family }),
    };
    const storageService = {
      createAccessUrl: jest.fn().mockResolvedValue({ access_url: 'https://cdn.example.test/avatars/m_avatar_001.jpg' }),
    };

    const service = new FamiliesService(prisma as never, accessControlService as never, {} as never, storageService as never);
    const result = await service.listMembers(BigInt(1), family.familyNo);

    expect(result.list[0]).toMatchObject({
      user_no: 'u_member',
      nickname: '家人',
      avatar_url: 'https://cdn.example.test/avatars/m_avatar_001.jpg',
      avatar_media_no: 'm_avatar_001',
      role: 'editor',
      joined_at: joinedAt.toISOString(),
    });
    expect(prisma.recordMedia.findFirst).toHaveBeenCalledWith({
      where: {
        mediaNo: 'm_avatar_001',
        uploaderUserId: BigInt(2),
        status: MEDIA_STATUS_READY,
      },
      select: { objectKey: true, thumbnailObjectKey: true },
    });
  });
});

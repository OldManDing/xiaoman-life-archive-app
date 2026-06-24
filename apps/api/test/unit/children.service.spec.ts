import { ChildrenService } from '../../src/modules/children/children.service';

describe('ChildrenService', () => {
  it('includes family_no and stable avatar media numbers in child list items', async () => {
    const child = {
      id: BigInt(30),
      childNo: 'c_001',
      familyId: BigInt(100),
      ownerUserId: BigInt(1),
      owner: { userNo: 'u_001' },
      family: { familyNo: 'f_001' },
      name: '小满',
      avatarUrl: 'media:m_child_avatar',
      birthday: new Date('2021-05-01T00:00:00.000Z'),
      gender: 'unknown',
      birthPlace: null,
      remark: null,
      status: 1,
      deletedAt: null,
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      updatedAt: new Date('2026-04-22T00:00:00.000Z'),
    };
    const prisma = {
      child: {
        findMany: jest.fn().mockResolvedValue([child]),
      },
      recordMedia: {
        findFirst: jest.fn().mockResolvedValue({ objectKey: 'children/m_child_avatar.jpg', thumbnailObjectKey: 'children/m_child_avatar_thumb.jpg' }),
      },
    };
    const storageService = {
      createAccessUrl: jest.fn().mockResolvedValue({ access_url: 'https://cdn.example.test/children/m_child_avatar_thumb.jpg' }),
    };

    const service = new ChildrenService(prisma as never, {} as never, storageService as never);
    const result = await service.list(BigInt(1));

    expect(result.list[0]).toMatchObject({
      child_no: 'c_001',
      family_no: 'f_001',
      owner_user_no: 'u_001',
      name: '小满',
      avatar_url: 'https://cdn.example.test/children/m_child_avatar_thumb.jpg',
      avatar_media_no: 'm_child_avatar',
    });
    expect(prisma.child.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { owner: true, family: true },
    }));
  });
});

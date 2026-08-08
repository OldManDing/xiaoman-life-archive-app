import { ensureRecordMediaCountLimits } from '../../src/modules/media/media-policy';
import { RecordsService, normalizeRecordTypeForMedia } from '../../src/modules/records/records.service';
import { RECORD_STATUS_DRAFT, RECORD_STATUS_PUBLISHED } from '../../src/shared/constants';

describe('RecordsService helpers', () => {
  it('limits the number of images attached to one record', () => {
    expect(() => ensureRecordMediaCountLimits(Array.from({ length: 10 }, () => ({ mediaType: 'image' })))).toThrow('每条记录最多上传9张图片');
  });

  it('limits video and audio to one item per record', () => {
    expect(() => ensureRecordMediaCountLimits([{ mediaType: 'video' }, { mediaType: 'video' }])).toThrow('每条记录最多上传1条视频');
    expect(() => ensureRecordMediaCountLimits([{ mediaType: 'audio' }, { mediaType: 'audio' }])).toThrow('每条记录最多上传1条语音');
  });

  it('keeps text records as text when no media is attached', () => {
    expect(normalizeRecordTypeForMedia('text', [])).toBe('text');
  });

  it('normalizes text records with media to mixed records', () => {
    expect(normalizeRecordTypeForMedia('text', ['m_001'])).toBe('mixed');
  });

  it('keeps explicit media record types unchanged', () => {
    expect(normalizeRecordTypeForMedia('video', ['m_001'])).toBe('video');
  });

  it('filters draft record lists to the current creator only', async () => {
    const child = { id: BigInt(10), childNo: 'c_001' };
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([0, []]),
      record: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const accessControlService = {
      ensureChildReadable: jest.fn().mockResolvedValue({ child }),
    };
    const service = new RecordsService(prisma as never, accessControlService as never, {} as never, {} as never, {} as never);

    await service.list(BigInt(1), {
      child_no: child.childNo,
      status: 'draft',
      page: 1,
      page_size: 10,
    });

    expect(prisma.record.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        childId: child.id,
        status: RECORD_STATUS_DRAFT,
        creatorUserId: BigInt(1),
      }),
    });
    expect(prisma.record.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        childId: child.id,
        status: RECORD_STATUS_DRAFT,
        creatorUserId: BigInt(1),
      }),
    }));
  });

  it('excludes other members drafts from the default record list', async () => {
    const child = { id: BigInt(10), childNo: 'c_001' };
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([0, []]),
      record: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const accessControlService = {
      ensureChildReadable: jest.fn().mockResolvedValue({ child }),
    };
    const service = new RecordsService(prisma as never, accessControlService as never, {} as never, {} as never, {} as never);

    await service.list(BigInt(1), {
      child_no: child.childNo,
      page: 1,
      page_size: 10,
    });

    const expectedVisibility = [
      { status: RECORD_STATUS_PUBLISHED },
      { status: RECORD_STATUS_DRAFT, creatorUserId: BigInt(1) },
    ];
    expect(prisma.record.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        childId: child.id,
        OR: expectedVisibility,
      }),
    });
    expect(prisma.record.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        childId: child.id,
        OR: expectedVisibility,
      }),
    }));
  });

  it('returns creator avatar references in record lists', async () => {
    const child = { id: BigInt(10), childNo: 'c_001' };
    const record = {
      recordNo: 'r_001',
      title: '带头像的记录',
      contentText: '家庭动态需要显示发布者头像。',
      eventTime: new Date('2026-06-21T10:00:00.000Z'),
      locationText: null,
      recordType: 'text',
      isMilestone: false,
      aiSummary: null,
      creator: {
        id: BigInt(1),
        userNo: 'u_001',
        nickname: '测试用户',
        avatarUrl: 'media:m_creator_avatar',
      },
      tags: [],
      media: [],
      status: RECORD_STATUS_PUBLISHED,
    };
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([1, [record]]),
      record: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      recordMedia: {
        findFirst: jest.fn().mockResolvedValue({
          objectKey: 'avatars/m_creator_avatar.jpg',
          thumbnailObjectKey: 'avatars/m_creator_avatar_thumb.jpg',
        }),
      },
    };
    const accessControlService = {
      ensureChildReadable: jest.fn().mockResolvedValue({ child }),
    };
    const storageService = {
      createAccessUrl: jest.fn().mockResolvedValue({ access_url: 'https://cdn.example.test/avatar-thumb.jpg' }),
    };
    const service = new RecordsService(prisma as never, accessControlService as never, storageService as never, {} as never, {} as never);

    const response = await service.list(BigInt(1), {
      child_no: child.childNo,
      status: 'published',
      page: 1,
      page_size: 10,
    });

    expect(response.list[0]).toEqual(expect.objectContaining({
      creator_user_no: 'u_001',
      creator_name: '测试用户',
      creator_avatar_url: 'https://cdn.example.test/avatar-thumb.jpg',
      creator_avatar_media_no: 'm_creator_avatar',
    }));
    expect(prisma.recordMedia.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        mediaNo: 'm_creator_avatar',
        uploaderUserId: BigInt(1),
      }),
      select: { objectKey: true, thumbnailObjectKey: true },
    });
  });
});

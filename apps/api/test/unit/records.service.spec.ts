import { RecordsService, normalizeRecordTypeForMedia } from '../../src/modules/records/records.service';
import { RECORD_STATUS_DRAFT, RECORD_STATUS_PUBLISHED } from '../../src/shared/constants';

describe('RecordsService helpers', () => {
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
});

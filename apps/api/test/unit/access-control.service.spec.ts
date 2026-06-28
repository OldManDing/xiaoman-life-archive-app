import { ForbiddenException } from '@nestjs/common';

import { AccessControlService } from '../../src/shared/services/access-control.service';
import { FAMILY_MEMBER_ACTIVE_STATUS, RECORD_STATUS_DRAFT, RECORD_STATUS_PUBLISHED } from '../../src/shared/constants';

describe('AccessControlService', () => {
  const membership = {
    id: BigInt(100),
    familyId: BigInt(20),
    userId: BigInt(1),
    role: 'editor',
    status: FAMILY_MEMBER_ACTIVE_STATUS,
    deletedAt: null,
  };

  const createPrisma = (record: { status: number; creatorUserId: bigint }) => ({
    record: {
      findFirst: jest.fn().mockResolvedValue({
        id: BigInt(30),
        recordNo: 'r_001',
        familyId: BigInt(20),
        childId: BigInt(10),
        ...record,
        child: {},
        creator: {},
        media: [],
        tags: [],
        deletedAt: null,
      }),
    },
    familyMember: {
      findFirst: jest.fn().mockResolvedValue(membership),
    },
  });

  it('rejects reading another family member draft record', async () => {
    const prisma = createPrisma({ status: RECORD_STATUS_DRAFT, creatorUserId: BigInt(2) });
    const service = new AccessControlService(prisma as never);

    await expect(service.ensureRecordReadable(BigInt(1), 'r_001')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows reading a published family record from another member', async () => {
    const prisma = createPrisma({ status: RECORD_STATUS_PUBLISHED, creatorUserId: BigInt(2) });
    const service = new AccessControlService(prisma as never);

    await expect(service.ensureRecordReadable(BigInt(1), 'r_001')).resolves.toMatchObject({
      membership,
      record: expect.objectContaining({ recordNo: 'r_001' }),
    });
  });
});

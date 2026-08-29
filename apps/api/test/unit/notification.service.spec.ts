import { NotificationService } from '../../src/shared/services/notification.service';

describe('NotificationService', () => {
  const originalPushEnabled = process.env.HUAWEI_PUSH_ENABLED;
  const huaweiPushDeliveryService = {
    processPendingDeliveries: jest.fn().mockResolvedValue({ processed_count: 0 }),
  };

  beforeAll(() => {
    process.env.HUAWEI_PUSH_ENABLED = 'true';
  });

  afterAll(() => {
    if (originalPushEnabled === undefined) delete process.env.HUAWEI_PUSH_ENABLED;
    else process.env.HUAWEI_PUSH_ENABLED = originalPushEnabled;
  });

  it('creates unread record-published notifications for active family members except the publisher', async () => {
    const prisma = {
      familyMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: BigInt(1) }, { userId: BigInt(2) }]),
      },
      userNotification: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: BigInt(100), userId: BigInt(2) }]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      userDeviceToken: {
        findMany: jest.fn().mockResolvedValue([{ userId: BigInt(2), provider: 'hms' }]),
      },
      notificationDelivery: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    };
    const service = new NotificationService(prisma as never, huaweiPushDeliveryService as never);

    const result = await service.createRecordPublishedNotifications({
      record_no: 'r_001',
      record_title: '第一次骑车',
      record_event_time: new Date('2026-06-22T08:00:00.000Z'),
      family_id: BigInt(10),
      family_no: 'f_001',
      child_no: 'c_001',
      child_name: '小满',
      actor_user_id: BigInt(1),
      actor_user_no: 'u_dad',
      actor_nickname: '小满爸爸',
    });

    expect(result).toEqual({ created_count: 1 });
    expect(prisma.familyMember.findMany).toHaveBeenCalledWith({
      where: {
        familyId: BigInt(10),
        status: 1,
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: { userId: true },
    });
    expect(prisma.userNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: BigInt(2),
          familyId: BigInt(10),
          actorUserId: BigInt(1),
          notificationType: 'family.record_published',
          title: '新的家庭记录',
          body: '小满爸爸 发布了《第一次骑车》',
          targetType: 'record',
          targetNo: 'r_001',
          readAt: null,
        }),
      ]),
      skipDuplicates: true,
    });
    expect(prisma.userNotification.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(prisma.userDeviceToken.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: [BigInt(2)] },
        provider: 'hms',
        status: 1,
        deletedAt: null,
      },
      select: { userId: true, provider: true },
    });
    expect(prisma.notificationDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          notificationId: BigInt(100),
          userId: BigInt(2),
          channel: 'push',
          provider: 'hms',
          status: 'queued',
          attempts: 0,
          nextRetryAt: expect.any(Date),
        }),
      ],
      skipDuplicates: true,
    });
    expect(huaweiPushDeliveryService.processPendingDeliveries).toHaveBeenCalled();
  });

  it('does not create a notification when the publisher is the only active member', async () => {
    const prisma = {
      familyMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: BigInt(1) }]),
      },
      userNotification: {
        findMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const service = new NotificationService(prisma as never, huaweiPushDeliveryService as never);

    const result = await service.createRecordPublishedNotifications({
      record_no: 'r_001',
      record_title: '只有自己的记录',
      record_event_time: new Date('2026-06-22T08:00:00.000Z'),
      family_id: BigInt(10),
      family_no: 'f_001',
      child_no: 'c_001',
      child_name: '小满',
      actor_user_id: BigInt(1),
      actor_user_no: 'u_dad',
      actor_nickname: '小满爸爸',
    });

    expect(result).toEqual({ created_count: 0 });
    expect(prisma.userNotification.findMany).not.toHaveBeenCalled();
    expect(prisma.userNotification.createMany).not.toHaveBeenCalled();
  });
});

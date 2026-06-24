import { NotificationService } from '../../src/shared/services/notification.service';

describe('NotificationService', () => {
  it('creates record-published notifications for active family members and marks publisher read', async () => {
    const prisma = {
      familyMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: BigInt(1) }, { userId: BigInt(2) }]),
      },
      userNotification: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new NotificationService(prisma as never);

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

    expect(result).toEqual({ created_count: 2 });
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
          userId: BigInt(1),
          familyId: BigInt(10),
          actorUserId: BigInt(1),
          notificationType: 'family.record_published',
          title: '新的家庭记录',
          body: '小满爸爸 发布了《第一次骑车》',
          targetType: 'record',
          targetNo: 'r_001',
          readAt: expect.any(Date),
        }),
        expect.objectContaining({
          userId: BigInt(2),
          readAt: null,
        }),
      ]),
    });
  });
});

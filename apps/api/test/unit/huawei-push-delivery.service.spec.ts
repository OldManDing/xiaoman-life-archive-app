import { HuaweiPushDeliveryService } from '../../src/shared/services/huawei-push-delivery.service';

describe('HuaweiPushDeliveryService', () => {
  const originalEnv = { ...process.env };
  const notification = {
    notificationNo: 'msg_001',
    userId: BigInt(2),
    title: '新的家庭记录',
    body: '妈妈 发布了《第一次骑车》',
    targetType: 'record',
    targetNo: 'r_001',
  };

  beforeEach(() => {
    process.env.HUAWEI_PUSH_ENABLED = 'true';
    process.env.HUAWEI_PUSH_APP_ID = 'test-app-id';
    process.env.HUAWEI_PUSH_APP_SECRET = 'test-app-secret';
    process.env.HUAWEI_PUSH_AUTH_URL = 'https://oauth.example.test/token';
    process.env.HUAWEI_PUSH_API_URL = 'https://push.example.test/v1';
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('claims a queued delivery and marks it sent after Huawei accepts it', async () => {
    const prisma = createPrismaMock();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ code: '80000000', msg: 'Success' }));
    const service = new HuaweiPushDeliveryService(prisma as never);

    await expect(service.processPendingDeliveries()).resolves.toEqual({ processed_count: 1 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://push.example.test/v1/test-app-id/messages:send',
      expect.objectContaining({ method: 'POST' }),
    );
    const message = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(message.message).toMatchObject({
      token: ['hms-device-token'],
      notification: notification.title ? { title: notification.title, body: notification.body } : undefined,
      android: { notification: { channel_id: 'nianlun_family_updates', icon: 'ic_stat_nianlun' } },
    });
    expect(JSON.parse(message.message.data)).toMatchObject({ path: '/record/r_001', target_no: 'r_001' });
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: BigInt(10) },
      data: expect.objectContaining({ status: 'sent', deliveredAt: expect.any(Date), lastError: null }),
    });
  });

  it('keeps a rejected delivery retryable without exposing credentials in the error', async () => {
    const prisma = createPrismaMock();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ code: '80100000', msg: 'Rejected' }));
    const service = new HuaweiPushDeliveryService(prisma as never);

    await service.processPendingDeliveries();

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: BigInt(10) },
      data: expect.objectContaining({
        status: 'failed',
        lastError: 'HMS 80100000: Rejected',
        nextRetryAt: expect.any(Date),
      }),
    });
  });

  it('skips a delivery when the user has no active HMS token', async () => {
    const prisma = createPrismaMock();
    prisma.userDeviceToken.findMany.mockResolvedValue([]);
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new HuaweiPushDeliveryService(prisma as never);

    await service.processPendingDeliveries();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: BigInt(10) },
      data: { status: 'skipped', lastError: 'No active HMS device token', nextRetryAt: null },
    });
  });

  function createPrismaMock() {
    return {
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([{ id: BigInt(10) }]),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: BigInt(10),
          userId: BigInt(2),
          attempts: 1,
          notification,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      userDeviceToken: {
        findMany: jest.fn().mockResolvedValue([{ pushToken: 'hms-device-token' }]),
      },
    };
  }

  function jsonResponse(payload: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(payload),
    } as unknown as Response;
  }
});

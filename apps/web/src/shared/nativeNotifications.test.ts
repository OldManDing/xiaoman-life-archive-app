import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkPermissionsMock = vi.fn();
const requestPermissionsMock = vi.fn();
const scheduleMock = vi.fn();
let nativePlatform = true;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativePlatform,
    getPlatform: () => (nativePlatform ? 'android' : 'web'),
  },
  registerPlugin: () => ({}),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: checkPermissionsMock,
    requestPermissions: requestPermissionsMock,
    schedule: scheduleMock,
    addListener: vi.fn(),
  },
}));

const familyNotification = {
  notification_no: 'msg_family',
  notification_type: 'family.record_published',
  title: '新的家庭记录',
  body: '小满妈妈发布了一条记录',
  family_no: 'f_001',
  actor_user_no: 'u_mom',
  actor_nickname: '小满妈妈',
  target_type: 'record',
  target_no: 'r_001',
  read_at: null,
  created_at: '2026-07-06T00:00:00.000Z',
  updated_at: '2026-07-06T00:00:00.000Z',
} as const;

describe('nativeNotifications', () => {
  beforeEach(() => {
    vi.resetModules();
    nativePlatform = true;
    checkPermissionsMock.mockReset();
    checkPermissionsMock.mockResolvedValue({ display: 'granted' });
    requestPermissionsMock.mockReset();
    scheduleMock.mockReset();
    window.localStorage.clear();
  });

  it('checks permission without silently requesting native notification access', async () => {
    checkPermissionsMock.mockResolvedValue({ display: 'denied' });
    const { scheduleNativeNotificationsForNewItems } = await import('./nativeNotifications');

    await scheduleNativeNotificationsForNewItems([familyNotification]);

    expect(checkPermissionsMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionsMock).not.toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('skips family notifications when the local family notification switch is off', async () => {
    window.localStorage.setItem(
      'xiaoman-web-local-settings',
      JSON.stringify({
        notificationPushEnabled: true,
        notificationFamilyEnabled: false,
        notificationUpdateEnabled: true,
      }),
    );
    const { scheduleNativeNotificationsForNewItems } = await import('./nativeNotifications');

    await scheduleNativeNotificationsForNewItems([familyNotification]);

    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('schedules allowed native notifications after permission has already been granted', async () => {
    const { scheduleNativeNotificationsForNewItems } = await import('./nativeNotifications');

    await scheduleNativeNotificationsForNewItems([familyNotification]);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][0].notifications[0]).toMatchObject({
      title: '新的家庭记录',
      body: '小满妈妈发布了一条记录',
      extra: {
        notificationNo: 'msg_family',
        targetType: 'record',
        targetNo: 'r_001',
      },
    });
  });
});

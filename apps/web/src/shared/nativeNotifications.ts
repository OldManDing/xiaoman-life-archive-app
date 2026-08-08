import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import type { UserNotificationItem } from './api/types';
import { getHmsPushConnectionStatus } from './hmsPush';
import { loadLocalSettings } from './localSettings';

const seenNotificationKey = 'nianlun.seenNativeNotificationNos';
const maxSeenNotificationCount = 80;

const isNativeNotificationAvailable = () => Capacitor.isNativePlatform();

export type NativeNotificationPermissionStatus = 'web' | 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';

const readSeenNotificationNos = () => {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(seenNotificationKey);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
};

const saveSeenNotificationNos = (values: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(seenNotificationKey, JSON.stringify(Array.from(values).slice(-maxSeenNotificationCount)));
  } catch {
    // Notification dedupe is best effort only.
  }
};

export const markNativeNotificationSeen = (notificationNos: string[]) => {
  const seen = readSeenNotificationNos();
  notificationNos.forEach((notificationNo) => {
    if (notificationNo) seen.add(notificationNo);
  });
  saveSeenNotificationNos(seen);
};

const normalizePermissionStatus = (value?: string): NativeNotificationPermissionStatus => {
  if (value === 'granted' || value === 'denied' || value === 'prompt' || value === 'prompt-with-rationale') {
    return value;
  }
  return 'unknown';
};

export const getNativeNotificationPermissionStatus = async (): Promise<NativeNotificationPermissionStatus> => {
  if (!isNativeNotificationAvailable()) return 'web';
  try {
    const current = await LocalNotifications.checkPermissions();
    return normalizePermissionStatus(current.display);
  } catch {
    return 'unknown';
  }
};

export const requestNativeNotificationPermission = async (): Promise<NativeNotificationPermissionStatus> => {
  if (!isNativeNotificationAvailable()) return 'web';
  try {
    const requested = await LocalNotifications.requestPermissions();
    return normalizePermissionStatus(requested.display);
  } catch {
    return 'unknown';
  }
};

const canScheduleNotificationItem = (item: UserNotificationItem) => {
  const settings = loadLocalSettings();
  if (!settings.notificationPushEnabled) return false;
  if (item.notification_type === 'family.record_published') return settings.notificationFamilyEnabled;
  if (item.notification_type === 'system.update_available') return settings.notificationUpdateEnabled;
  return true;
};

export const scheduleNativeNotificationsForNewItems = async (items: UserNotificationItem[]) => {
  if (!items.length || !isNativeNotificationAvailable()) return;
  if (getHmsPushConnectionStatus() === 'registered') return;
  const permissionStatus = await getNativeNotificationPermissionStatus();
  if (permissionStatus !== 'granted') return;

  const seen = readSeenNotificationNos();
  const freshItems = items.filter((item) => !item.read_at && !seen.has(item.notification_no) && canScheduleNotificationItem(item)).slice(0, 3);
  if (!freshItems.length) return;

  const now = Date.now();
  await LocalNotifications.schedule({
    notifications: freshItems.map((item, index) => ({
      id: Math.abs(hashNotificationNo(item.notification_no)) % 2_000_000_000,
      title: item.title || '\u65b0\u7684\u5bb6\u5ead\u6d88\u606f',
      body: item.body || '\u6709\u4e00\u6761\u65b0\u7684\u5bb6\u5ead\u901a\u77e5',
      schedule: { at: new Date(now + 250 + index * 300) },
      extra: {
        notificationNo: item.notification_no,
        targetType: item.target_type,
        targetNo: item.target_no,
      },
    })),
  });

  freshItems.forEach((item) => seen.add(item.notification_no));
  saveSeenNotificationNos(seen);
};

export const registerNativeNotificationTapHandler = (navigate: (path: string) => void) => {
  if (!isNativeNotificationAvailable()) return () => undefined;
  let active = true;
  let removeNotificationListener: (() => void) | undefined;

  void LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    if (!active) return;
    const extra = event.notification.extra as { targetType?: string; targetNo?: string } | undefined;
    if (extra?.targetType === 'record' && extra.targetNo) {
      navigate(`/record/${extra.targetNo}`);
      return;
    }
    navigate('/profile/messages');
  }).then((handle) => {
    if (!active) {
      void handle.remove();
      return;
    }
    removeNotificationListener = () => void handle.remove();
  });

  return () => {
    active = false;
    removeNotificationListener?.();
  };
};

const hashNotificationNo = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
};

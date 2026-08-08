import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

import { webApi } from './api/webApi';
import { loadLocalSettings } from './localSettings';

const connectionStatusKey = 'nianlun.hmsPushConnectionStatus';

export type HmsPushConnectionStatus = 'registered' | 'connecting' | 'unavailable' | 'failed';

type HmsTokenResult = { token: string };
type HmsNotificationEvent = { data?: Record<string, unknown> } & Record<string, unknown>;
type HmsPushBridgePlugin = {
  getToken: () => Promise<HmsTokenResult>;
  turnOnPush: () => Promise<void>;
  turnOffPush: () => Promise<void>;
  getInitialNotification: () => Promise<HmsNotificationEvent>;
  addListener: (eventName: 'tokenReceived' | 'notificationOpened', listener: (event: HmsNotificationEvent) => void) => Promise<PluginListenerHandle>;
};

const HmsPushBridge = registerPlugin<HmsPushBridgePlugin>('HmsPushBridge');
const isHmsRuntime = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const saveConnectionStatus = (status: HmsPushConnectionStatus) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(connectionStatusKey, status);
    window.dispatchEvent(new CustomEvent('nianlun:hms-push-status', { detail: status }));
  } catch {
    // Status persistence only keeps the notification settings page accurate.
  }
};

export const getHmsPushConnectionStatus = (): HmsPushConnectionStatus => {
  if (!isHmsRuntime() || typeof window === 'undefined') return 'unavailable';
  try {
    const value = window.localStorage.getItem(connectionStatusKey);
    if (value === 'registered' || value === 'connecting' || value === 'failed') return value;
  } catch {
    return 'failed';
  }
  return 'connecting';
};

const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const resolveHmsNotificationPath = (event: unknown): string => {
  const visited = new Set<unknown>();
  const queue: unknown[] = [event];

  while (queue.length) {
    const current = parseJsonValue(queue.shift());
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    const value = current as Record<string, unknown>;
    const path = typeof value.path === 'string' ? value.path.trim() : '';
    if (/^\/record\/[A-Za-z0-9_-]+$/.test(path)) return path;
    const targetType = typeof value.target_type === 'string' ? value.target_type : value.targetType;
    const targetNo = typeof value.target_no === 'string' ? value.target_no : value.targetNo;
    if (targetType === 'record' && typeof targetNo === 'string' && /^[A-Za-z0-9_-]+$/.test(targetNo)) {
      return `/record/${targetNo}`;
    }
    ['data', 'extras', 'remoteMessage', 'msg', 'message', 'pushMsg', 'msgContent', 'notification'].forEach((key) => {
      if (value[key] !== undefined) queue.push(value[key]);
    });
  }

  return '/profile/messages';
};

const registerToken = async (token: string) => {
  const normalized = token.trim();
  if (normalized.length < 16) throw new Error('HMS returned an empty push token');
  const result = await webApi.registerDeviceToken({
    platform: 'android',
    provider: 'hms',
    push_token: normalized,
    device_label: navigator.userAgent.slice(0, 128),
  });
  saveConnectionStatus(result.remote_push_enabled ? 'registered' : 'failed');
  if (!result.remote_push_enabled) throw new Error('Remote push is not enabled on the server');
};

export const initializeHmsPush = async (navigate: (path: string) => void) => {
  if (!isHmsRuntime()) {
    saveConnectionStatus('unavailable');
    return () => undefined;
  }

  const settings = loadLocalSettings();
  if (!settings.notificationPushEnabled || !settings.notificationFamilyEnabled) {
    saveConnectionStatus('unavailable');
    return () => undefined;
  }

  saveConnectionStatus('connecting');
  const handles: PluginListenerHandle[] = [];
  let active = true;

  try {
    handles.push(
      await HmsPushBridge.addListener('tokenReceived', (event) => {
        const token = typeof event.token === 'string' ? event.token : '';
        if (active && token) void registerToken(token).catch(() => saveConnectionStatus('failed'));
      }),
    );
    handles.push(
      await HmsPushBridge.addListener('notificationOpened', (event) => {
        if (active) navigate(resolveHmsNotificationPath(event));
      }),
    );
    await HmsPushBridge.turnOnPush();
    const { token } = await HmsPushBridge.getToken();
    await registerToken(token);
    const initialNotification = await HmsPushBridge.getInitialNotification();
    if (initialNotification && Object.keys(initialNotification).length) {
      navigate(resolveHmsNotificationPath(initialNotification));
    }
  } catch {
    saveConnectionStatus('failed');
  }

  return () => {
    active = false;
    handles.forEach((handle) => void handle.remove());
  };
};

export const setHmsRemotePushEnabled = async (enabled: boolean) => {
  if (!isHmsRuntime()) return 'unavailable' as const;
  try {
    if (enabled) {
      await HmsPushBridge.turnOnPush();
      const { token } = await HmsPushBridge.getToken();
      await registerToken(token);
      return 'registered' as const;
    }
    try {
      const { token } = await HmsPushBridge.getToken();
      if (token) {
        await webApi.unregisterDeviceToken({ platform: 'android', provider: 'hms', push_token: token });
      }
    } finally {
      await HmsPushBridge.turnOffPush();
    }
    saveConnectionStatus('unavailable');
    return 'unavailable' as const;
  } catch {
    saveConnectionStatus('failed');
    return 'failed' as const;
  }
};

export const unregisterHmsDeviceToken = async () => {
  if (!isHmsRuntime()) return;
  try {
    const { token } = await HmsPushBridge.getToken();
    if (token) {
      await webApi.unregisterDeviceToken({ platform: 'android', provider: 'hms', push_token: token });
    }
  } catch {
    // Logout must continue even if HMS or the network is temporarily unavailable.
  } finally {
    saveConnectionStatus('connecting');
  }
};

import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeGetCurrentPositionMock = vi.fn();
const geolocationCheckPermissionsMock = vi.fn();
const geolocationRequestPermissionsMock = vi.fn();
const geolocationGetCurrentPositionMock = vi.fn();

let nativePlatform = false;
let platform = 'web';
let nativeLocationAvailable = false;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => nativePlatform,
    getPlatform: () => platform,
    isPluginAvailable: (name: string) => name === 'NativeLocation' && nativeLocationAvailable,
  },
  registerPlugin: () => ({
    getCurrentPosition: nativeGetCurrentPositionMock,
  }),
}));

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: geolocationCheckPermissionsMock,
    requestPermissions: geolocationRequestPermissionsMock,
    getCurrentPosition: geolocationGetCurrentPositionMock,
  },
}));

describe('deviceLocation', () => {
  beforeEach(() => {
    nativePlatform = false;
    platform = 'web';
    nativeLocationAvailable = false;
    nativeGetCurrentPositionMock.mockReset();
    geolocationCheckPermissionsMock.mockReset();
    geolocationRequestPermissionsMock.mockReset();
    geolocationGetCurrentPositionMock.mockReset();
  });

  it('uses the Android native location plugin before Google Play backed geolocation', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    nativePlatform = true;
    platform = 'android';
    nativeLocationAvailable = true;
    nativeGetCurrentPositionMock.mockResolvedValue({ latitude: 31.2, longitude: 121.5, accuracy: 16 });

    await expect(getCurrentDeviceLocation()).resolves.toEqual({ latitude: 31.2, longitude: 121.5, accuracy: 16 });
    expect(nativeGetCurrentPositionMock).toHaveBeenCalledTimes(1);
    expect(geolocationGetCurrentPositionMock).not.toHaveBeenCalled();
  });

  it('normalizes Google Play service errors before they reach the UI', async () => {
    const { normalizeLocationError } = await import('./deviceLocation');

    expect(normalizeLocationError(new Error('Google Play services are not available'))).toBe(
      '当前手机定位服务不可用，可手动填写地点或选择常用地点。',
    );
  });
});

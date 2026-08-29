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

  it('treats ten metres as the inclusive accuracy boundary', async () => {
    const { hasRequiredLocationAccuracy } = await import('./deviceLocation');

    expect(hasRequiredLocationAccuracy(10)).toBe(true);
    expect(hasRequiredLocationAccuracy(10.1)).toBe(false);
  });

  it('uses the Android native location plugin before Google Play backed geolocation', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    nativePlatform = true;
    platform = 'android';
    nativeLocationAvailable = true;
    nativeGetCurrentPositionMock.mockResolvedValue({ latitude: 31.2, longitude: 121.5, accuracy: 8 });

    await expect(getCurrentDeviceLocation()).resolves.toEqual({ latitude: 31.2, longitude: 121.5, accuracy: 8 });
    expect(nativeGetCurrentPositionMock).toHaveBeenCalledTimes(1);
    expect(geolocationGetCurrentPositionMock).not.toHaveBeenCalled();
  });

  it('rejects an Android fix outside the ten-metre accuracy requirement', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    nativePlatform = true;
    platform = 'android';
    nativeLocationAvailable = true;
    nativeGetCurrentPositionMock.mockResolvedValue({ latitude: 31.2, longitude: 121.5, accuracy: 16 });

    await expect(getCurrentDeviceLocation()).rejects.toThrow('当前定位精度约 16 米，未达到 10 米要求');
    expect(geolocationGetCurrentPositionMock).not.toHaveBeenCalled();
  });

  it('keeps the decimal boundary visible when accuracy is just over ten metres', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    nativePlatform = true;
    platform = 'android';
    nativeLocationAvailable = true;
    nativeGetCurrentPositionMock.mockResolvedValue({ latitude: 31.2, longitude: 121.5, accuracy: 10.1 });

    await expect(getCurrentDeviceLocation()).rejects.toThrow('当前定位精度约 10.1 米，未达到 10 米要求');
  });

  it('rejects a Capacitor fix when its reported accuracy is too wide', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    geolocationCheckPermissionsMock.mockResolvedValue({ location: 'granted' });
    geolocationGetCurrentPositionMock.mockResolvedValue({
      coords: { latitude: 31.2, longitude: 121.5, accuracy: 25 },
    });

    await expect(getCurrentDeviceLocation()).rejects.toThrow('当前定位精度约 25 米，未达到 10 米要求');
  });

  it('keeps sampling until a later Capacitor fix reaches ten metres', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    geolocationCheckPermissionsMock.mockResolvedValue({ location: 'granted' });
    geolocationGetCurrentPositionMock
      .mockResolvedValueOnce({ coords: { latitude: 31.2, longitude: 121.5, accuracy: 18 } })
      .mockResolvedValueOnce({ coords: { latitude: 31.2001, longitude: 121.5001, accuracy: 7 } });

    await expect(getCurrentDeviceLocation()).resolves.toEqual({
      latitude: 31.2001,
      longitude: 121.5001,
      accuracy: 7,
    });
    expect(geolocationGetCurrentPositionMock).toHaveBeenCalledTimes(2);
  });

  it('requires a reported accuracy value instead of accepting an unknown radius', async () => {
    const { getCurrentDeviceLocation } = await import('./deviceLocation');
    geolocationCheckPermissionsMock.mockResolvedValue({ location: 'granted' });
    geolocationGetCurrentPositionMock.mockResolvedValue({
      coords: { latitude: 31.2, longitude: 121.5, accuracy: null },
    });

    await expect(getCurrentDeviceLocation()).rejects.toThrow('当前定位精度未达到 10 米要求');
  });

  it('explains that Android approximate permission cannot meet the requirement', async () => {
    const { normalizeLocationError } = await import('./deviceLocation');

    expect(normalizeLocationError(new Error('precise location permission required'))).toBe(
      '请在手机系统权限中开启“精确定位”，然后再点手机定位。',
    );
  });

  it('normalizes a browser permission error even when the browser omits its message', async () => {
    const { normalizeLocationError } = await import('./deviceLocation');

    expect(normalizeLocationError({ code: 1 })).toBe('请在手机系统权限中允许年轮访问定位，然后再点手机定位。');
  });

  it('normalizes Google Play service errors before they reach the UI', async () => {
    const { normalizeLocationError } = await import('./deviceLocation');

    expect(normalizeLocationError(new Error('Google Play services are not available'))).toBe(
      '当前手机定位服务不可用，可手动填写地点或选择常用地点。',
    );
  });
});

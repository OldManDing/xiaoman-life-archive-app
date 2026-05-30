import { Geolocation } from '@capacitor/geolocation';

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

const normalizeLocationError = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    if (/google\s*play|play services|gms|service_version|service missing|service disabled/i.test(error.message)) {
      return '当前手机定位服务不可用，可手动填写地点或选择常用地点。';
    }
    if (/denied|permission|not allowed/i.test(error.message)) {
      return '请在手机系统权限中允许年轮访问定位，然后再点手机定位。';
    }
    if (/timeout/i.test(error.message)) {
      return '定位超时，请确认手机定位服务已开启，并保持网络可用。';
    }
    return '定位暂时不可用，请手动填写地点或选择常用地点。';
  }
  return '定位失败，请检查手机定位服务和应用定位权限。';
};

const getBrowserLocation = () =>
  new Promise<DeviceLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前设备不支持定位。'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 },
    );
  });

export const getCurrentDeviceLocation = async (): Promise<DeviceLocation> => {
  try {
    try {
      const current = await Geolocation.checkPermissions();
      if (current.location !== 'granted') {
        const requested = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (requested.location !== 'granted') {
          throw new Error('location permission denied');
        }
      }
    } catch (permissionError) {
      if (permissionError instanceof Error && permissionError.message === 'location permission denied') {
        throw permissionError;
      }
      // Browser previews may not support explicit permission requests.
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 0,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    };
  } catch (error) {
    try {
      return await getBrowserLocation();
    } catch {
      throw new Error(normalizeLocationError(error));
    }
  }
};

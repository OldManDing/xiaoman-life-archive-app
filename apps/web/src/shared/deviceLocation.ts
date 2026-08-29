import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

/** The app only uses a device fix when the provider reports a ten-metre radius or better. */
export const MAX_LOCATION_ACCURACY_METERS = 10;

const LOCATION_ACCURACY_ERROR_PREFIX = 'location accuracy insufficient';
const LOCATION_ATTEMPT_TIMEOUT_MS = 5000;
const LOCATION_ATTEMPTS = 3;
const LOCATION_RETRY_DELAY_MS = 250;

const formatAccuracyMeters = (accuracy: number) => (Number.isInteger(accuracy) ? String(accuracy) : accuracy.toFixed(1));

const createLocationAccuracyError = (accuracy: number | null) => {
  const accuracyText = Number.isFinite(accuracy) ? `: ${formatAccuracyMeters(accuracy as number)}m` : '';
  return new Error(`${LOCATION_ACCURACY_ERROR_PREFIX}${accuracyText}`);
};

export const hasRequiredLocationAccuracy = (accuracy: number | null | undefined): accuracy is number =>
  typeof accuracy === 'number' &&
  Number.isFinite(accuracy) &&
  accuracy >= 0 &&
  accuracy <= MAX_LOCATION_ACCURACY_METERS;

type NativeLocationResult = DeviceLocation & {
  provider?: string;
  timestamp?: number;
};

type NativeLocationPlugin = {
  getCurrentPosition: () => Promise<NativeLocationResult>;
};

const NativeLocation = registerPlugin<NativeLocationPlugin>('NativeLocation');

export const normalizeLocationError = (error: unknown) => {
  const browserErrorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: unknown }).code
      : null;
  const errorMessage =
    error instanceof Error
      ? error.message.trim()
      : typeof error === 'string'
        ? error.trim()
        : browserErrorCode === 1
          ? 'permission denied'
          : '';

  if (errorMessage) {
    if (/location accuracy insufficient|location accuracy unavailable/i.test(errorMessage)) {
      const reportedAccuracy = errorMessage.match(/(?:insufficient\s*:\s*|accuracy\s*[=:]?\s*)(\d+(?:\.\d+)?)\s*m?/i)?.[1];
      return reportedAccuracy
        ? `当前定位精度约 ${formatAccuracyMeters(Number(reportedAccuracy))} 米，未达到 10 米要求，请移至开阔处后重试。`
        : '当前定位精度未达到 10 米要求，请移至开阔处后重试。';
    }
    if (/precise location permission|required.*precise location/i.test(errorMessage)) {
      return '请在手机系统权限中开启“精确定位”，然后再点手机定位。';
    }
    if (/google\s*play|play services|gms|service_version|service missing|service disabled/i.test(errorMessage)) {
      return '当前手机定位服务不可用，可手动填写地点或选择常用地点。';
    }
    if (/denied|permission|not allowed/i.test(errorMessage)) {
      return '请在手机系统权限中允许年轮访问定位，然后再点手机定位。';
    }
    if (/timeout/i.test(errorMessage)) {
      return '定位超时，请确认手机定位服务已开启，并保持网络可用。';
    }
    return '定位暂时不可用，请手动填写地点或选择常用地点。';
  }
  return '定位失败，请检查手机定位服务和应用定位权限。';
};

const normalizeLocationResult = (location: DeviceLocation): DeviceLocation => ({
  latitude: location.latitude,
  longitude: location.longitude,
  accuracy: Number.isFinite(location.accuracy) ? location.accuracy : null,
});

const requireLocationAccuracy = (location: DeviceLocation): DeviceLocation => {
  const normalized = normalizeLocationResult(location);
  if (!hasRequiredLocationAccuracy(normalized.accuracy)) {
    throw createLocationAccuracyError(normalized.accuracy);
  }
  return normalized;
};

const waitForLocationRetry = () => new Promise<void>((resolve) => setTimeout(resolve, LOCATION_RETRY_DELAY_MS));

const isTerminalLocationError = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const browserPermissionDenied = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 1;
  return browserPermissionDenied || /denied|permission|not allowed|google\s*play|play services|gms|service_version|service missing|service disabled/i.test(message);
};

const locationFromBrowserPosition = (position: GeolocationPosition): DeviceLocation =>
  requireLocationAccuracy({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  });

const getNativeAndroidLocation = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !Capacitor.isPluginAvailable('NativeLocation')) {
    return null;
  }

  return requireLocationAccuracy(await NativeLocation.getCurrentPosition());
};

const getBrowserLocation = () =>
  new Promise<DeviceLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前设备不支持定位。'));
      return;
    }

    let lastError: unknown = null;
    let attempt = 1;
    const request = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            resolve(locationFromBrowserPosition(position));
          } catch (error) {
            lastError = error;
            if (attempt >= LOCATION_ATTEMPTS) {
              reject(lastError);
              return;
            }
            attempt += 1;
            window.setTimeout(request, LOCATION_RETRY_DELAY_MS);
          }
        },
        (error) => {
          lastError = error;
          if (isTerminalLocationError(error) || attempt >= LOCATION_ATTEMPTS) {
            reject(error);
            return;
          }
          attempt += 1;
          window.setTimeout(request, LOCATION_RETRY_DELAY_MS);
        },
        { enableHighAccuracy: true, timeout: LOCATION_ATTEMPT_TIMEOUT_MS, maximumAge: 0 },
      );
    };
    request();
  });

export const getCurrentDeviceLocation = async (): Promise<DeviceLocation> => {
  let firstError: unknown = null;

  try {
    const nativeLocation = await getNativeAndroidLocation();
    if (nativeLocation) {
      return nativeLocation;
    }
  } catch (error) {
    firstError = error;
  }

  if (!firstError) {
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

      let lastLocationError: unknown = null;
      for (let attempt = 0; attempt < LOCATION_ATTEMPTS; attempt += 1) {
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: LOCATION_ATTEMPT_TIMEOUT_MS,
            maximumAge: 0,
          });
          try {
            return requireLocationAccuracy({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          } catch (accuracyError) {
            lastLocationError = accuracyError;
          }
        } catch (locationError) {
          lastLocationError = locationError;
          if (isTerminalLocationError(locationError)) {
            throw locationError;
          }
        }
        if (attempt < LOCATION_ATTEMPTS - 1) {
          await waitForLocationRetry();
        }
      }
      throw lastLocationError ?? new Error('location timeout');
    } catch (error) {
      firstError = error;
    }
  }

  try {
    return await getBrowserLocation();
  } catch (browserError) {
    throw new Error(normalizeLocationError(firstError ?? browserError));
  }
};

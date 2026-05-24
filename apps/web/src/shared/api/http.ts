import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/tokenMemory';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
type ErrorEnvelope = { message?: unknown };
type ApiRuntimeSnapshot = {
  configuredBaseUrl?: string;
  origin?: string;
  isNativePlatform?: boolean;
};

const NATIVE_API_BASE_URL = 'https://webapi.xmlga.top/api/v1';

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

const getRuntimeSnapshot = (): ApiRuntimeSnapshot => {
  if (typeof window === 'undefined') {
    return {};
  }

  const capacitorWindow = window as CapacitorWindow;
  return {
    configuredBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim(),
    origin: window.location.origin,
    isNativePlatform: capacitorWindow.Capacitor?.isNativePlatform?.() ?? false,
  };
};

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const isNativeOrigin = (origin?: string) => origin === 'https://localhost' || origin === 'capacitor://localhost' || origin === 'ionic://localhost';

export const resolveApiBaseUrl = (snapshot: ApiRuntimeSnapshot = getRuntimeSnapshot()) => {
  const configuredBaseUrl = snapshot.configuredBaseUrl?.trim();
  const isNativeRuntime = Boolean(snapshot.isNativePlatform) || isNativeOrigin(snapshot.origin);

  if (isNativeRuntime) {
    if (configuredBaseUrl && isAbsoluteHttpUrl(configuredBaseUrl) && !/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredBaseUrl)) {
      return configuredBaseUrl;
    }

    return NATIVE_API_BASE_URL;
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return '/api/v1';
};

const toUserFacingError = (error: AxiosError) => {
  const responseMessage = (error.response?.data as ErrorEnvelope | undefined)?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return new Error(responseMessage);
  }

  if (error.message === 'Network Error') {
    return new Error('网络连接失败，请稍后重试');
  }

  if (error.code === 'ECONNABORTED') {
    return new Error('请求超时，请稍后重试');
  }

  return new Error('请求失败，请稍后重试');
};

const http = axios.create({
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;
const shouldSkipRefresh = (url?: string) =>
  Boolean(url && ['/auth/login', '/auth/register', '/auth/send-code', '/auth/refresh'].some((path) => url.includes(path)));

http.interceptors.request.use((config) => {
  config.baseURL = resolveApiBaseUrl();
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(toUserFacingError(error));
    }

    if (shouldSkipRefresh(originalRequest.url)) {
      clearAccessToken();
      return Promise.reject(toUserFacingError(error));
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = http
          .post('/auth/refresh')
          .then((response) => {
            const nextToken = response.data?.data?.access_token ?? null;
            setAccessToken(nextToken);
            return nextToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const nextToken = await refreshPromise;
      if (!nextToken) {
        clearAccessToken();
        return Promise.reject(new Error('登录状态已失效，请重新登录'));
      }

      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return http(originalRequest);
    } catch (refreshError) {
      clearAccessToken();
      if (axios.isAxiosError(refreshError)) {
        return Promise.reject(toUserFacingError(refreshError));
      }
      return Promise.reject(refreshError);
    }
  },
);

export default http;

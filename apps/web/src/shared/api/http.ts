import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/tokenMemory';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
type ErrorEnvelope = {
  message?: unknown;
  data?: {
    fields?: Array<{ field?: unknown; reason?: unknown }>;
  } | null;
};
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

const validationReasonMap: Array<[RegExp, string]> = [
  [/credential must be longer than or equal to 3 characters/i, '账号至少需要 3 位'],
  [/credential must be shorter than or equal to 64 characters/i, '账号不能超过 64 位'],
  [/credential must match/i, '账号不能包含空格'],
  [/password must be longer than or equal to 8 characters/i, '密码需为 8 到 72 位'],
  [/password must be shorter than or equal to 72 characters/i, '密码需为 8 到 72 位'],
  [/password_confirm must be longer than or equal to 8 characters/i, '确认密码需为 8 到 72 位'],
  [/password_confirm must be shorter than or equal to 72 characters/i, '确认密码需为 8 到 72 位'],
  [/invite_code must be longer than or equal to 6 characters/i, '邀请码需为 6 到 128 位'],
  [/invite_code must be shorter than or equal to 128 characters/i, '邀请码需为 6 到 128 位'],
];

const normalizeValidationReason = (reason: string) => {
  const normalized = reason.trim();
  const mapped = validationReasonMap.find(([pattern]) => pattern.test(normalized));
  return mapped?.[1] ?? normalized;
};

export const extractApiErrorMessage = (responseData: unknown) => {
  const data = responseData as ErrorEnvelope | undefined;
  const fieldReason = data?.data?.fields
    ?.map((field) => (typeof field.reason === 'string' ? normalizeValidationReason(field.reason) : null))
    .find((reason): reason is string => Boolean(reason));
  const responseMessage = data?.message;

  if (fieldReason && responseMessage === '参数校验失败') {
    return fieldReason;
  }

  if (responseMessage === '参数校验失败') {
    return '请检查表单信息是否完整';
  }

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  return fieldReason ?? null;
};

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
  const responseMessage = extractApiErrorMessage(error.response?.data);
  if (responseMessage) {
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

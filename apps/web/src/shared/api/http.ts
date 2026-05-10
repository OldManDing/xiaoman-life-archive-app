import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/tokenMemory';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };
type ErrorEnvelope = { message?: unknown };

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
  baseURL: '/api/v1',
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

http.interceptors.request.use((config) => {
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

    if (originalRequest.url?.includes('/auth/refresh')) {
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

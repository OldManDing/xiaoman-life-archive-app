import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { clearAccessToken, getAccessToken, setAccessToken } from '../auth/tokenMemory';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

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
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/auth/refresh')) {
      clearAccessToken();
      return Promise.reject(error);
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
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return http(originalRequest);
    } catch (refreshError) {
      clearAccessToken();
      return Promise.reject(refreshError);
    }
  },
);

export default http;

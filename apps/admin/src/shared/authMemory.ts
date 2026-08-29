import type { AdminProfile } from './authContext';

const ACCESS_TOKEN_STORAGE_KEY = 'nianlun_admin_access_token';
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'nianlun_admin_access_token_expires_at';
const ADMIN_PROFILE_STORAGE_KEY = 'nianlun_admin_profile';

// 提前 30 秒视为过期，避免临界点上发出注定失败的请求。
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

const removeStoredSession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    window.sessionStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; the in-memory session is still cleared.
  }
};

const readStoredToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return token && token.trim() ? token : null;
  } catch {
    return null;
  }
};

const readStoredExpiresAt = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const isAdminProfile = (value: unknown): value is AdminProfile => {
  if (!value || typeof value !== 'object') return false;
  const admin = value as Partial<AdminProfile>;
  return typeof admin.username === 'string' && typeof admin.display_name === 'string' && typeof admin.role === 'string';
};

const readStoredAdminProfile = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isAdminProfile(parsed)) {
      return parsed;
    }
  } catch {
    // Invalid storage should not block the login page.
  }
  removeStoredSession();
  return null;
};

let accessTokenMemory: string | null = readStoredToken();
let accessTokenExpiresAtMemory: number | null = readStoredExpiresAt();
let adminProfileMemory: AdminProfile | null = readStoredAdminProfile();

const isSessionUsable = (token: string | null, expiresAt: number | null) =>
  Boolean(token && adminProfileMemory && (!expiresAt || Date.now() < expiresAt - EXPIRY_SAFETY_MARGIN_MS));

if (!isSessionUsable(accessTokenMemory, accessTokenExpiresAtMemory)) {
  accessTokenMemory = null;
  accessTokenExpiresAtMemory = null;
  adminProfileMemory = null;
  removeStoredSession();
}

export const getAccessToken = () => {
  if (accessTokenMemory && accessTokenExpiresAtMemory && Date.now() >= accessTokenExpiresAtMemory - EXPIRY_SAFETY_MARGIN_MS) {
    return null;
  }
  return accessTokenMemory;
};

export const getAdminProfile = () => adminProfileMemory;

export const getTokenExpiresAt = () => accessTokenExpiresAtMemory;

export const setAccessTokenMemory = (token: string | null, expiresInSeconds?: number) => {
  accessTokenMemory = token;
  accessTokenExpiresAtMemory = token && expiresInSeconds && expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : null;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
        if (accessTokenExpiresAtMemory) {
          window.sessionStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(accessTokenExpiresAtMemory));
        } else {
          window.sessionStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
        }
      } else {
        window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        window.sessionStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
      }
    } catch {
      // Session storage can be disabled; memory fallback keeps the current tab working.
    }
  }
};

export const setAdminProfileMemory = (admin: AdminProfile | null) => {
  adminProfileMemory = admin;
  if (typeof window !== 'undefined') {
    try {
      if (admin) {
        window.sessionStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(admin));
      } else {
        window.sessionStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
      }
    } catch {
      // Session storage can be disabled; memory fallback keeps the current tab working.
    }
  }
};

export const clearAccessTokenMemory = () => {
  accessTokenMemory = null;
  accessTokenExpiresAtMemory = null;
  adminProfileMemory = null;
  removeStoredSession();
};

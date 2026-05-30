import type { AdminProfile } from './authContext';

const ACCESS_TOKEN_STORAGE_KEY = 'nianlun_admin_access_token';
const ADMIN_PROFILE_STORAGE_KEY = 'nianlun_admin_profile';

const removeStoredSession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
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

const persistToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Session storage can be disabled; memory fallback keeps the current tab working.
  }
};

const persistAdminProfile = (admin: AdminProfile | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (admin) {
      window.sessionStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(admin));
    } else {
      window.sessionStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
    }
  } catch {
    // Session storage can be disabled; memory fallback keeps the current tab working.
  }
};

let accessTokenMemory: string | null = readStoredToken();
let adminProfileMemory: AdminProfile | null = readStoredAdminProfile();

if (!accessTokenMemory || !adminProfileMemory) {
  accessTokenMemory = null;
  adminProfileMemory = null;
  removeStoredSession();
}

export const getAccessToken = () => accessTokenMemory;

export const getAdminProfile = () => adminProfileMemory;

export const setAccessTokenMemory = (token: string | null) => {
  accessTokenMemory = token;
  persistToken(token);
};

export const setAdminProfileMemory = (admin: AdminProfile | null) => {
  adminProfileMemory = admin;
  persistAdminProfile(admin);
};

export const clearAccessTokenMemory = () => {
  accessTokenMemory = null;
  adminProfileMemory = null;
  removeStoredSession();
};

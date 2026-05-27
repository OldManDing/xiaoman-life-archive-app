import type { AdminProfile } from './authContext';

const ACCESS_TOKEN_STORAGE_KEY = 'nianlun_admin_access_token';
const ADMIN_PROFILE_STORAGE_KEY = 'nianlun_admin_profile';

let accessTokenMemory: string | null = null;
let adminProfileMemory: AdminProfile | null = null;

const clearLegacySessionStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; new admin sessions remain memory-only.
  }
};

clearLegacySessionStorage();

export const getAccessToken = () => accessTokenMemory;

export const getAdminProfile = () => adminProfileMemory;

export const setAccessTokenMemory = (token: string | null) => {
  accessTokenMemory = token;
  clearLegacySessionStorage();
};

export const setAdminProfileMemory = (admin: AdminProfile | null) => {
  adminProfileMemory = admin;
  clearLegacySessionStorage();
};

export const clearAccessTokenMemory = () => {
  accessTokenMemory = null;
  adminProfileMemory = null;
  clearLegacySessionStorage();
};

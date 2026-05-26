import type { AdminProfile } from './authContext';

const ACCESS_TOKEN_STORAGE_KEY = 'nianlun_admin_access_token';
const ADMIN_PROFILE_STORAGE_KEY = 'nianlun_admin_profile';

let accessTokenMemory: string | null = null;
let adminProfileMemory: AdminProfile | null = null;

const getSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const readStoredAdminProfile = () => {
  const storage = getSessionStorage();
  const stored = storage?.getItem(ADMIN_PROFILE_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AdminProfile;
  } catch {
    storage?.removeItem(ADMIN_PROFILE_STORAGE_KEY);
    return null;
  }
};

export const getAccessToken = () => {
  if (accessTokenMemory) return accessTokenMemory;
  const storedToken = getSessionStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
  accessTokenMemory = storedToken;
  return storedToken;
};

export const getAdminProfile = () => {
  if (adminProfileMemory) return adminProfileMemory;
  adminProfileMemory = readStoredAdminProfile();
  return adminProfileMemory;
};

export const setAccessTokenMemory = (token: string | null) => {
  accessTokenMemory = token;
  const storage = getSessionStorage();
  if (!storage) return;
  if (token) {
    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
};

export const setAdminProfileMemory = (admin: AdminProfile | null) => {
  adminProfileMemory = admin;
  const storage = getSessionStorage();
  if (!storage) return;
  if (admin) {
    storage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(admin));
  } else {
    storage.removeItem(ADMIN_PROFILE_STORAGE_KEY);
  }
};

export const clearAccessTokenMemory = () => {
  accessTokenMemory = null;
  adminProfileMemory = null;
  const storage = getSessionStorage();
  storage?.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  storage?.removeItem(ADMIN_PROFILE_STORAGE_KEY);
};

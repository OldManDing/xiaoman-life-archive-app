const ACCESS_TOKEN_STORAGE_KEY = 'nianlun:access-token';

const removeLegacyStoredAccessToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures; new tokens still remain memory-only.
  }
};

removeLegacyStoredAccessToken();
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  removeLegacyStoredAccessToken();
};

export const clearAccessToken = () => {
  accessToken = null;
  removeLegacyStoredAccessToken();
};

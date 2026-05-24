const ACCESS_TOKEN_STORAGE_KEY = 'nianlun:access-token';

const readStoredAccessToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

let accessToken: string | null = readStoredAccessToken();

const writeStoredAccessToken = (token: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
      return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage write failures and keep the in-memory token usable.
  }
};

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  writeStoredAccessToken(token);
};

export const clearAccessToken = () => {
  accessToken = null;
  writeStoredAccessToken(null);
};

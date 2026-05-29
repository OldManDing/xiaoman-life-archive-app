const ACCESS_TOKEN_STORAGE_KEY = 'nianlun:access-token';
const SESSION_HINT_STORAGE_KEY = 'nianlun:session-hint';

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

const setSessionHint = (enabled: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, '1');
      return;
    }

    window.localStorage.removeItem(SESSION_HINT_STORAGE_KEY);
  } catch {
    // A blocked storage write must not break login, refresh, or logout.
  }
};

export const getAccessToken = () => accessToken;

export const hasStoredSessionHint = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(SESSION_HINT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  removeLegacyStoredAccessToken();
  setSessionHint(Boolean(token));
};

export const clearAccessToken = () => {
  accessToken = null;
  removeLegacyStoredAccessToken();
  setSessionHint(false);
};

const welcomeIntroStorageKey = 'nianlun.welcomeIntro.seen.v1';

export const hasSeenWelcomeIntro = () => {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(welcomeIntroStorageKey) === '1';
  } catch {
    return true;
  }
};

export const markWelcomeIntroSeen = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(welcomeIntroStorageKey, '1');
  } catch {
    // Ignore storage failures; the user can still continue to login.
  }
};

export const clearWelcomeIntroSeen = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(welcomeIntroStorageKey);
  } catch {
    // Ignore storage failures in tests or restricted WebViews.
  }
};

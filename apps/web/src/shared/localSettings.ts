const STORAGE_KEY = 'xiaoman-web-local-settings';

export interface LocalSettings {
  hideMobileMask: boolean;
  autoRefreshHome: boolean;
}

export const defaultLocalSettings: LocalSettings = {
  hideMobileMask: false,
  autoRefreshHome: true,
};

export const loadLocalSettings = (): LocalSettings => {
  if (typeof window === 'undefined') {
    return defaultLocalSettings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLocalSettings;
    return { ...defaultLocalSettings, ...(JSON.parse(raw) as Partial<LocalSettings>) };
  } catch {
    return defaultLocalSettings;
  }
};

export const saveLocalSettings = (settings: LocalSettings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const clearLocalSettings = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};

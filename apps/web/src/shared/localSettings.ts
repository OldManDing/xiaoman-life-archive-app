const STORAGE_KEY = 'xiaoman-web-local-settings';

export interface LocalSettings {
  hideMobileMask: boolean;
  autoRefreshHome: boolean;
}

export const defaultLocalSettings: LocalSettings = {
  hideMobileMask: false,
  autoRefreshHome: true,
};

export interface UserPreferenceSnapshot {
  allow_mobile_search?: boolean;
  show_history_to_new_members?: boolean;
}

export const localSettingsToPreferences = (settings: LocalSettings) => ({
  allow_mobile_search: !settings.hideMobileMask,
  show_history_to_new_members: settings.autoRefreshHome,
});

export const preferencesToLocalSettings = (preferences: UserPreferenceSnapshot): LocalSettings => ({
  hideMobileMask:
    typeof preferences.allow_mobile_search === 'boolean'
      ? !preferences.allow_mobile_search
      : defaultLocalSettings.hideMobileMask,
  autoRefreshHome:
    typeof preferences.show_history_to_new_members === 'boolean'
      ? preferences.show_history_to_new_members
      : defaultLocalSettings.autoRefreshHome,
});

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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Local settings are an optional device preference and should never block UI actions.
  }
};

export const clearLocalSettings = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures in restricted WebViews.
  }
};

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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const clearLocalSettings = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};

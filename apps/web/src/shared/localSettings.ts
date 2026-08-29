const STORAGE_KEY = 'xiaoman-web-local-settings';
let activeScope: string | null = null;

export interface LocalSettings {
  hideMobileMask: boolean;
  showHistoryToNewMembers: boolean;
  notificationPushEnabled: boolean;
  notificationFamilyEnabled: boolean;
  notificationUpdateEnabled: boolean;
}

export const defaultLocalSettings: LocalSettings = {
  hideMobileMask: false,
  showHistoryToNewMembers: true,
  notificationPushEnabled: true,
  notificationFamilyEnabled: true,
  notificationUpdateEnabled: true,
};

export interface UserPreferenceSnapshot {
  allow_mobile_search?: boolean;
  show_history_to_new_members?: boolean;
}

export const localSettingsToPreferences = (settings: LocalSettings) => ({
  allow_mobile_search: !settings.hideMobileMask,
  show_history_to_new_members: settings.showHistoryToNewMembers,
});

export const preferencesToLocalSettings = (preferences: UserPreferenceSnapshot): LocalSettings => ({
  ...defaultLocalSettings,
  hideMobileMask:
    typeof preferences.allow_mobile_search === 'boolean'
      ? !preferences.allow_mobile_search
      : defaultLocalSettings.hideMobileMask,
  showHistoryToNewMembers:
    typeof preferences.show_history_to_new_members === 'boolean'
      ? preferences.show_history_to_new_members
      : defaultLocalSettings.showHistoryToNewMembers,
});

export const setLocalSettingsScope = (scope: string | null | undefined) => {
  activeScope = scope?.trim() || null;
};

export const getLocalSettingsScope = () => activeScope;

const scopedStorageKey = (scope?: string | null) => {
  const normalizedScope = (scope ?? activeScope)?.trim();
  return normalizedScope ? `${STORAGE_KEY}:${normalizedScope}` : STORAGE_KEY;
};

const migrateLegacySettings = (scope: string | null) => {
  if (!scope || typeof window === 'undefined') return null;
  try {
    const scopedKey = scopedStorageKey(scope);
    const scopedValue = window.localStorage.getItem(scopedKey);
    if (scopedValue) return scopedValue;
    const legacyValue = window.localStorage.getItem(STORAGE_KEY);
    if (legacyValue) window.localStorage.setItem(scopedKey, legacyValue);
    return legacyValue;
  } catch {
    return null;
  }
};

export const loadLocalSettings = (scope?: string | null): LocalSettings => {
  if (typeof window === 'undefined') {
    return defaultLocalSettings;
  }

  try {
    const raw = window.localStorage.getItem(scopedStorageKey(scope)) ?? migrateLegacySettings((scope ?? activeScope)?.trim() || null);
    const fallbackRaw = scope || activeScope ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw && !fallbackRaw) return defaultLocalSettings;
    return { ...defaultLocalSettings, ...(JSON.parse(raw ?? fallbackRaw ?? '{}') as Partial<LocalSettings>) };
  } catch {
    return defaultLocalSettings;
  }
};

export const saveLocalSettings = (settings: LocalSettings, scope?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(settings);
    window.localStorage.setItem(scopedStorageKey(scope), serialized);
    if ((scope ?? activeScope)?.trim()) window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Local settings are an optional device preference and should never block UI actions.
  }
};

export const clearLocalSettings = (scope?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(scopedStorageKey(scope));
    if ((scope ?? activeScope)?.trim()) window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures in restricted WebViews.
  }
};

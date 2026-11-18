/**
 * 阅读偏好（长辈模式 / 夜间暖光）需要在应用启动时立即生效，
 * 否则用户设置后只要离开设置页就会回到默认样式（审计 11 屏 P1）。
 */

const DISPLAY_PREF_KEY = 'nianlun:display-prefs:v1';

export interface DisplayPreferences {
  elder: boolean;
  night: boolean;
}

export const readDisplayPreferences = (): DisplayPreferences => {
  if (typeof window === 'undefined') return { elder: false, night: false };
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREF_KEY);
    if (!raw) return { elder: false, night: false };
    const parsed = JSON.parse(raw) as Partial<DisplayPreferences>;
    return { elder: Boolean(parsed.elder), night: Boolean(parsed.night) };
  } catch {
    return { elder: false, night: false };
  }
};

export const applyDisplayPreferences = ({ elder, night }: DisplayPreferences) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (elder) root.dataset.elder = 'true';
  else delete root.dataset.elder;
  if (night) root.dataset.theme = 'night';
  else delete root.dataset.theme;
};

export const saveDisplayPreferences = (preferences: DisplayPreferences) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISPLAY_PREF_KEY, JSON.stringify(preferences));
  } catch {
    // 存储被禁用时不应影响设置页本身
  }
};

/** 应用启动时调用一次，把已保存的阅读偏好重新挂到 <html> 上 */
export const bootstrapDisplayPreferences = () => {
  applyDisplayPreferences(readDisplayPreferences());
};

export { DISPLAY_PREF_KEY };

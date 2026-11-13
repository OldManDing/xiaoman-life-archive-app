import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { clearAccessToken, getAccessToken, hasStoredSessionHint, setAccessToken as persistAccessToken } from './auth/tokenMemory';
import type { ChildRecord, UserProfile } from './api/types';
import { webApi, type LoginPayload, type RegisterPayload } from './api/webApi';
import { unregisterHmsDeviceToken } from './hmsPush';
import { cancelScheduledNativeNotifications } from './nativeNotifications';
import { setLocalSettingsScope } from './localSettings';
import { bumpSessionEpoch, onSessionExpired } from './api/http';
import { clearMediaAccessUrlCache } from './hooks';

interface AuthContextValue {
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  needsOnboarding: boolean;
  user: UserProfile | null;
  activeChild: ChildRecord | null;
  children: ChildRecord[];
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  setUserProfile: (profile: UserProfile) => void;
  setActiveChild: (child: ChildRecord | null) => void;
  refreshChildren: () => Promise<ChildRecord[]>;
  completeOnboarding: (child: ChildRecord) => void;
  skipOnboarding: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const pickDefaultChild = (children: ChildRecord[]) =>
  children.find((child) => child.name?.trim()) ?? children[0] ?? null;

const shouldSkipAnonymousRefresh = () => {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname === '/legal') return true;
  if (window.location.pathname === '/auth/login') return !hasStoredSessionHint();
  return false;
};

// 「先逛逛」：建档页点跳过时按账号记住，本次会话不再强制回建档页；建档成功后自然失效
const onboardingSkipKey = (userNo?: string | null) => `nianlun.onboarding.skipped:${userNo ?? 'anon'}`;
const hasSkippedOnboarding = (userNo?: string | null) => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(onboardingSkipKey(userNo)) === '1' || window.sessionStorage.getItem(onboardingSkipKey(userNo)) === '1';
  } catch {
    return false;
  }
};
const rememberOnboardingSkip = (userNo?: string | null, skipped = true) => {
  if (typeof window === 'undefined') return;
  try {
    if (skipped) {
      window.localStorage.setItem(onboardingSkipKey(userNo), '1');
      window.sessionStorage.setItem(onboardingSkipKey(userNo), '1');
    } else {
      window.localStorage.removeItem(onboardingSkipKey(userNo));
      window.sessionStorage.removeItem(onboardingSkipKey(userNo));
    }
  } catch {
    // 部分内嵌 WebView 会禁用 storage，跳过仍应在当前内存状态内生效
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessTokenState] = useState<string | null>(getAccessToken());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [childrenList, setChildrenList] = useState<ChildRecord[]>([]);
  const [activeChild, setActiveChildState] = useState<ChildRecord | null>(null);
  const bootstrapRunRef = useRef(0);
  const userNoRef = useRef<string | null>(null);
  useEffect(() => {
    userNoRef.current = user?.user_no ?? null;
  }, [user?.user_no]);

  const activeChildStorageKey = () => `nianlun.active-child:${userNoRef.current ?? 'anon'}`;
  const readStoredChildNo = () => {
    try {
      return window.sessionStorage.getItem(activeChildStorageKey());
    } catch {
      return null;
    }
  };
  const rememberActiveChildNo = (childNo?: string | null) => {
    try {
      if (childNo) window.sessionStorage.setItem(activeChildStorageKey(), childNo);
      else window.sessionStorage.removeItem(activeChildStorageKey());
    } catch {
      /* storage may be unavailable */
    }
  };

  const setAccessToken = useCallback((token: string | null) => {
    persistAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const refreshChildren = useCallback(async () => {
    const enrichedChildren = await webApi.listChildren();
    setChildrenList(enrichedChildren);
    setActiveChildState((current) => {
      if (current?.name?.trim()) {
        return enrichedChildren.find((item) => item.child_no === current.child_no) ?? current;
      }
      const refreshedCurrent = current ? enrichedChildren.find((item) => item.child_no === current.child_no) : null;
      if (refreshedCurrent?.name?.trim()) return refreshedCurrent;
      const storedChildNo = readStoredChildNo();
      const storedChild = storedChildNo ? enrichedChildren.find((item) => item.child_no === storedChildNo) : null;
      return storedChild ?? pickDefaultChild(enrichedChildren);
    });
    return enrichedChildren;
  }, []);

  const hydrateAfterAuth = useCallback(
    async (payload: { access_token: string; user: UserProfile; need_create_child: boolean }) => {
      setAccessToken(payload.access_token);
      setLocalSettingsScope(payload.user.user_no);
      setUser(payload.user);
      setNeedsOnboarding(payload.need_create_child && !hasSkippedOnboarding(payload.user.user_no));

      if (!payload.need_create_child) {
        try {
          await refreshChildren();
        } catch (err) {
          console.warn('[auth] 孩子列表加载失败，不阻断登录', err);
        }
      } else {
        setChildrenList([]);
        setActiveChildState(null);
      }
    },
    [refreshChildren, setAccessToken],
  );

  const bootstrap = useCallback(async () => {
    const bootstrapRun = bootstrapRunRef.current;
    const isCurrentBootstrapRun = () => bootstrapRun === bootstrapRunRef.current;

    try {
      const persistedToken = getAccessToken();
      if (persistedToken) {
        try {
          const profile = await webApi.me();
          if (!isCurrentBootstrapRun()) return;
          setAccessToken(persistedToken);
          setLocalSettingsScope(profile.user_no);
          setUser(profile);
          const nextChildren = await refreshChildren();
          if (!isCurrentBootstrapRun()) return;
          setNeedsOnboarding(nextChildren.length === 0 && !hasSkippedOnboarding(profile.user_no));
        } catch {
          const session = await webApi.refresh();
          if (!isCurrentBootstrapRun()) return;
          await hydrateAfterAuth(session);
        }
      } else if (shouldSkipAnonymousRefresh()) {
        if (!isCurrentBootstrapRun()) return;
        clearAccessToken();
        setAccessTokenState(null);
        setUser(null);
        setNeedsOnboarding(false);
        setChildrenList([]);
        setActiveChildState(null);
      } else {
        const session = await webApi.refresh();
        if (!isCurrentBootstrapRun()) return;
        await hydrateAfterAuth(session);
      }
    } catch {
      if (!isCurrentBootstrapRun()) return;
      clearAccessToken();
      setLocalSettingsScope(null);
      setAccessTokenState(null);
      setUser(null);
      setNeedsOnboarding(false);
      setChildrenList([]);
      setActiveChildState(null);
    } finally {
      setIsBootstrapping(false);
    }
  }, [hydrateAfterAuth]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);


  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await webApi.login(payload);
      await hydrateAfterAuth(session);
    },
    [hydrateAfterAuth],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const session = await webApi.register(payload);
      await hydrateAfterAuth(session);
    },
    [hydrateAfterAuth],
  );

  const clearSession = useCallback(() => {
    bootstrapRunRef.current += 1;
    bumpSessionEpoch();
    clearMediaAccessUrlCache();
    clearAccessToken();
    setLocalSettingsScope(null);
    setAccessTokenState(null);
    setUser(null);
    setNeedsOnboarding(false);
    setChildrenList([]);
    setActiveChildState(null);
    setIsBootstrapping(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterHmsDeviceToken();
      await webApi.logout();
    } catch {
      // Local sign-out must still complete if the server session is already invalidated.
    } finally {
      await cancelScheduledNativeNotifications();
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => onSessionExpired(() => clearSession()), [clearSession]);

  const setActiveChild = useCallback((child: ChildRecord | null) => {
    setActiveChildState(child);
    rememberActiveChildNo(child?.child_no ?? null);
  }, []);

  const setUserProfile = useCallback((profile: UserProfile) => {
    setUser(profile);
  }, []);

  const completeOnboarding = useCallback((child: ChildRecord) => {
    rememberOnboardingSkip(child.owner_user_no ?? null, false);
    setNeedsOnboarding(false);
    setChildrenList([child]);
    setActiveChildState(child);
  }, []);

  const skipOnboarding = useCallback(() => {
    rememberOnboardingSkip(user?.user_no ?? null, true);
    setNeedsOnboarding(false);
  }, [user?.user_no]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isBootstrapping,
      needsOnboarding,
      user,
      activeChild,
      children: childrenList,
      login,
      register,
      logout,
      clearSession,
      setUserProfile,
      setActiveChild,
      refreshChildren,
      completeOnboarding,
      skipOnboarding,
    }),
    [
      accessToken,
      activeChild,
      childrenList,
      completeOnboarding,
      isBootstrapping,
      login,
      register,
      logout,
      clearSession,
      needsOnboarding,
      refreshChildren,
      setUserProfile,
      setActiveChild,
      skipOnboarding,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

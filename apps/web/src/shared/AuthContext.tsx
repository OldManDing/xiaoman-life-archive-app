import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { clearAccessToken, getAccessToken, setAccessToken as persistAccessToken } from './auth/tokenMemory';
import type { ChildRecord, UserProfile } from './api/types';
import { webApi, type LoginPayload } from './api/webApi';

interface AuthContextValue {
  accessToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  needsOnboarding: boolean;
  user: UserProfile | null;
  activeChild: ChildRecord | null;
  children: ChildRecord[];
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  setUserProfile: (profile: UserProfile) => void;
  setActiveChild: (child: ChildRecord | null) => void;
  refreshChildren: () => Promise<ChildRecord[]>;
  completeOnboarding: (child: ChildRecord) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessTokenState] = useState<string | null>(getAccessToken());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [childrenList, setChildrenList] = useState<ChildRecord[]>([]);
  const [activeChild, setActiveChildState] = useState<ChildRecord | null>(null);

  const setAccessToken = useCallback((token: string | null) => {
    persistAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const refreshChildren = useCallback(async () => {
    const nextChildren = await webApi.listChildren();
    const enrichedChildren = await Promise.all(
      nextChildren.map(async (child) => {
        try {
          return await webApi.detailChild(child.child_no);
        } catch {
          return child;
        }
      }),
    );
    setChildrenList(enrichedChildren);
    setActiveChildState((current) => {
      if (current) {
        return enrichedChildren.find((item) => item.child_no === current.child_no) ?? current;
      }
      return enrichedChildren[0] ?? null;
    });
    return enrichedChildren;
  }, []);

  const hydrateAfterAuth = useCallback(
    async (payload: { access_token: string; user: UserProfile; need_create_child: boolean }) => {
      setAccessToken(payload.access_token);
      setUser(payload.user);
      setNeedsOnboarding(payload.need_create_child);

      if (!payload.need_create_child) {
        await refreshChildren();
      } else {
        setChildrenList([]);
        setActiveChildState(null);
      }
    },
    [refreshChildren, setAccessToken],
  );

  const bootstrap = useCallback(async () => {
    try {
      const session = await webApi.refresh();
      await hydrateAfterAuth(session);
    } catch {
      clearAccessToken();
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

  const logout = useCallback(async () => {
    try {
      await webApi.logout();
    } finally {
      clearAccessToken();
      setAccessTokenState(null);
      setUser(null);
      setNeedsOnboarding(false);
      setChildrenList([]);
      setActiveChildState(null);
    }
  }, []);

  const setActiveChild = useCallback((child: ChildRecord | null) => {
    setActiveChildState(child);
  }, []);

  const setUserProfile = useCallback((profile: UserProfile) => {
    setUser(profile);
  }, []);

  const completeOnboarding = useCallback((child: ChildRecord) => {
    setNeedsOnboarding(false);
    setChildrenList([child]);
    setActiveChildState(child);
  }, []);

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
      logout,
      setUserProfile,
      setActiveChild,
      refreshChildren,
      completeOnboarding,
    }),
    [
      accessToken,
      activeChild,
      childrenList,
      completeOnboarding,
      isBootstrapping,
      login,
      logout,
      needsOnboarding,
      refreshChildren,
      setUserProfile,
      setActiveChild,
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

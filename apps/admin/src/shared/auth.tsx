import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { adminApi } from './request';
import { AuthContext, type AuthContextValue, type AdminProfile } from './authContext';
import { clearAccessTokenMemory, getAccessToken, getAdminProfile, setAccessTokenMemory, setAdminProfileMemory } from './authMemory';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
  const [admin, setAdmin] = useState<AdminProfile | null>(getAdminProfile());

  const login = useCallback(async (payload: { username: string; password: string }) => {
    const response = await adminApi.login(payload);
    setAccessTokenMemory(response.access_token);
    setAdminProfileMemory(response.admin);
    setAccessToken(response.access_token);
    setAdmin(response.admin);
  }, []);

  const logout = useCallback(() => {
    clearAccessTokenMemory();
    setAccessToken(null);
    setAdmin(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      admin,
      isAuthenticated: Boolean(accessToken),
      login,
      logout,
    }),
    [accessToken, admin, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { adminApi } from './request';
import { AuthContext, type AuthContextValue, type AdminProfile } from './authContext';
import { clearAccessTokenMemory, getAccessToken, getAdminProfile, setAccessTokenMemory, setAdminProfileMemory } from './authMemory';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
  const [admin, setAdmin] = useState<AdminProfile | null>(getAdminProfile());

  const login = useCallback(async (payload: { username: string; password: string }) => {
    const response = await adminApi.login(payload);
    // 过期时刻写入 authMemory，由 getAccessToken 统一判定本地过期。
    setAccessTokenMemory(response.access_token, response.expires_in);
    setAdminProfileMemory(response.admin);
    setAccessToken(response.access_token);
    setAdmin(response.admin);
  }, []);

  const logout = useCallback(() => {
    // 先通知服务端撤销会话；本地会话无论如何都要清掉，接口失败不阻塞退出。
    void adminApi.logout().catch(() => undefined);
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

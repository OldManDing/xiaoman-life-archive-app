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
    // 顺序很关键：先把当前 token 取出来显式交给撤销接口，再清本地会话。
    // clearAccessTokenMemory() 是同步执行的，而 axios 的请求拦截器要到微任务里才读 token，
    // 若先清本地，「退出登录」请求就会丢掉 Authorization 头 → 服务端返回 401 →
    // 本地界面看起来退出了，服务端会话其实没有被撤销（E2E 巡检的 401 控制台报错就是这个）。
    const revokeToken = getAccessToken();
    clearAccessTokenMemory();
    setAccessToken(null);
    setAdmin(null);
    void adminApi.logout(revokeToken).catch(() => undefined);
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

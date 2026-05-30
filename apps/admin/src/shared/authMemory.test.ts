import { afterEach, describe, expect, it, vi } from 'vitest';

const loadAuthMemory = async () => {
  vi.resetModules();
  return import('./authMemory');
};

describe('authMemory', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.resetModules();
  });

  it('restores the admin session from sessionStorage after a page refresh', async () => {
    const authMemory = await loadAuthMemory();
    const admin = { username: 'admin', display_name: '系统管理员', role: 'super_admin' };

    authMemory.setAccessTokenMemory('admin-token');
    authMemory.setAdminProfileMemory(admin);

    const reloadedAuthMemory = await loadAuthMemory();

    expect(reloadedAuthMemory.getAccessToken()).toBe('admin-token');
    expect(reloadedAuthMemory.getAdminProfile()).toEqual(admin);
  });

  it('clears the stored admin session on logout', async () => {
    const authMemory = await loadAuthMemory();

    authMemory.setAccessTokenMemory('admin-token');
    authMemory.setAdminProfileMemory({ username: 'admin', display_name: '系统管理员', role: 'super_admin' });
    authMemory.clearAccessTokenMemory();

    expect(window.sessionStorage.getItem('nianlun_admin_access_token')).toBeNull();
    expect(window.sessionStorage.getItem('nianlun_admin_profile')).toBeNull();
    expect(authMemory.getAccessToken()).toBeNull();
    expect(authMemory.getAdminProfile()).toBeNull();
  });

  it('drops malformed stored profile data', async () => {
    window.sessionStorage.setItem('nianlun_admin_access_token', 'admin-token');
    window.sessionStorage.setItem('nianlun_admin_profile', '{"username":"admin"}');

    const authMemory = await loadAuthMemory();

    expect(authMemory.getAccessToken()).toBeNull();
    expect(authMemory.getAdminProfile()).toBeNull();
    expect(window.sessionStorage.getItem('nianlun_admin_access_token')).toBeNull();
    expect(window.sessionStorage.getItem('nianlun_admin_profile')).toBeNull();
  });
});

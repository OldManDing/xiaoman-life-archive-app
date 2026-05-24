import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearAccessToken, getAccessToken, setAccessToken } from './tokenMemory';

describe('tokenMemory', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAccessToken();
  });

  afterEach(() => {
    window.localStorage.clear();
    clearAccessToken();
  });

  it('persists the access token to localStorage', () => {
    setAccessToken('token-123');

    expect(getAccessToken()).toBe('token-123');
    expect(window.localStorage.getItem('nianlun:access-token')).toBe('token-123');
  });

  it('removes the persisted token when cleared', () => {
    setAccessToken('token-123');

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem('nianlun:access-token')).toBeNull();
  });
});

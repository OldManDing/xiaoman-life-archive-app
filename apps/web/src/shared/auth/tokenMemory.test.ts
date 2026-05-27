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

  it('keeps the access token in memory only', () => {
    setAccessToken('token-123');

    expect(getAccessToken()).toBe('token-123');
    expect(window.localStorage.getItem('nianlun:access-token')).toBeNull();
  });

  it('removes tokens persisted by an older version when cleared', () => {
    window.localStorage.setItem('nianlun:access-token', 'legacy-token');
    setAccessToken('token-123');

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem('nianlun:access-token')).toBeNull();
  });
});

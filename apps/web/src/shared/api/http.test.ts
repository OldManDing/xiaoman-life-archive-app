import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from './http';

describe('resolveApiBaseUrl', () => {
  it('uses the configured absolute API url on native when provided', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: 'https://staging.example.com/api/v1',
        isNativePlatform: true,
        origin: 'https://localhost',
      }),
    ).toBe('https://staging.example.com/api/v1');
  });

  it('falls back to the production native API url on native when config is relative', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: '/api/v1',
        isNativePlatform: true,
        origin: 'https://localhost',
      }),
    ).toBe('https://webapi.xmlga.top/api/v1');
  });

  it('falls back to the production native API url for capacitor localhost pages', () => {
    expect(
      resolveApiBaseUrl({
        origin: 'https://localhost',
      }),
    ).toBe('https://webapi.xmlga.top/api/v1');
  });

  it('keeps relative api paths for plain web when no config exists', () => {
    expect(
      resolveApiBaseUrl({
        origin: 'http://127.0.0.1:5176',
      }),
    ).toBe('/api/v1');
  });
});

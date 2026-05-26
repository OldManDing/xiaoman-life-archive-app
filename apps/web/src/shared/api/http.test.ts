import { describe, expect, it } from 'vitest';

import { extractApiErrorMessage, resolveApiBaseUrl } from './http';

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

describe('extractApiErrorMessage', () => {
  it('shows field-level registration validation details instead of generic validation text', () => {
    expect(
      extractApiErrorMessage({
        message: '参数校验失败',
        data: {
          fields: [{ field: 'password', reason: '密码需为 8 到 72 位' }],
        },
      }),
    ).toBe('密码需为 8 到 72 位');
  });

  it('maps older class-validator text to Chinese when the backend still returns raw reasons', () => {
    expect(
      extractApiErrorMessage({
        message: '参数校验失败',
        data: {
          fields: [{ field: 'unknown', reason: 'invite_code must be longer than or equal to 6 characters' }],
        },
      }),
    ).toBe('邀请码需为 6 到 128 位');
  });

  it('does not surface generic validation text when no field detail is provided', () => {
    expect(
      extractApiErrorMessage({
        message: '参数校验失败',
        data: null,
      }),
    ).toBe('请检查表单信息是否完整');
  });
});

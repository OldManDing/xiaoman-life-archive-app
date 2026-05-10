import {
  getAiProviderName,
  getAppEnv,
  getAppPort,
  getSmsProviderName,
  getStorageProviderName,
  isAdminBootstrapAllowed,
  isSecureCookieEnvironment,
  resolveCorsOrigins,
  validateRuntimeConfig,
} from '../../src/shared/env-config';

describe('env-config', () => {
  it('allows placeholder secrets in local environment', () => {
    expect(
      validateRuntimeConfig({
        APP_ENV: 'local',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'replace_me_access_secret',
        JWT_REFRESH_SECRET: 'replace_me_refresh_secret',
      }),
    ).toMatchObject({ APP_ENV: 'local' });
  });

  it('rejects placeholder jwt secrets in strict environments', () => {
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'production',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'replace_me_access_secret',
        JWT_REFRESH_SECRET: 'replace_me_refresh_secret',
        CORS_ORIGINS: 'https://app.example.com',
        SMS_PROVIDER: 'aliyun',
        STORAGE_PROVIDER: 'minio',
        AI_PROVIDER: 'mock',
      }),
    ).toThrow('JWT_ACCESS_SECRET cannot use the placeholder value outside local/test environments');
  });

  it('rejects missing cors origins in strict environments', () => {
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'staging',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'staging_access_secret',
        JWT_REFRESH_SECRET: 'staging_refresh_secret',
        SMS_PROVIDER: 'aliyun',
        STORAGE_PROVIDER: 'minio',
        AI_PROVIDER: 'mock',
      }),
    ).toThrow('CORS_ORIGINS is required outside local/test environments');
  });

  it('requires ai provider to be explicitly configured in strict environments', () => {
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'production',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'prod_access_secret',
        JWT_REFRESH_SECRET: 'prod_refresh_secret',
        CORS_ORIGINS: 'https://app.example.com',
        SMS_PROVIDER: 'aliyun',
        STORAGE_PROVIDER: 'minio',
      }),
    ).toThrow('Missing required environment variable: AI_PROVIDER');
  });

  it('disables admin bootstrap by default in strict environments', () => {
    expect(isAdminBootstrapAllowed({ APP_ENV: 'production' })).toBe(false);
    expect(isAdminBootstrapAllowed({ APP_ENV: 'local' })).toBe(true);
  });

  it('allows explicit mock providers in relaxed environments', () => {
    expect(getSmsProviderName({ APP_ENV: 'local', SMS_PROVIDER: 'mock' })).toBe('mock');
    expect(getStorageProviderName({ APP_ENV: 'test', STORAGE_PROVIDER: 'mock' })).toBe('mock');
    expect(getAiProviderName({ APP_ENV: 'local', AI_PROVIDER: 'mock' })).toBe('mock');
  });

  it('rejects mock providers in strict environments', () => {
    expect(() => getSmsProviderName({ APP_ENV: 'production', SMS_PROVIDER: 'mock' })).toThrow(
      'SMS_PROVIDER=mock is not allowed outside local/test environments',
    );
    expect(() => getStorageProviderName({ APP_ENV: 'production', STORAGE_PROVIDER: 'mock' })).toThrow(
      'STORAGE_PROVIDER=mock is not allowed outside local/test environments',
    );
  });

  it('rejects invalid provider values', () => {
    expect(() => getSmsProviderName({ APP_ENV: 'local', SMS_PROVIDER: 'foo' })).toThrow('Invalid SMS_PROVIDER value: foo');
    expect(() => getStorageProviderName({ APP_ENV: 'local', STORAGE_PROVIDER: 'bar' })).toThrow('Invalid STORAGE_PROVIDER value: bar');
  });

  it('resolves app env, port and cookie security flags consistently', () => {
    expect(getAppEnv({ APP_ENV: 'prod' })).toBe('prod');
    expect(getAppPort({ APP_PORT: '4100' })).toBe(4100);
    expect(isSecureCookieEnvironment({ APP_ENV: 'prod' })).toBe(true);
    expect(resolveCorsOrigins({ APP_ENV: 'local' })).toBe(true);
    expect(resolveCorsOrigins({ APP_ENV: 'prod', CORS_ORIGINS: 'https://a.com, https://b.com' })).toEqual(['https://a.com', 'https://b.com']);
    expect(getStorageProviderName({ APP_ENV: 'prod', STORAGE_PROVIDER: 'minio' })).toBe('minio');
  });
});

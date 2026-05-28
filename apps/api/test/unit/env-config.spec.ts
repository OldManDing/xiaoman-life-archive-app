import {
  getAiProviderName,
  getAlertContactChannel,
  getAlertContactName,
  getAuthRateLimitMaxAttempts,
  getAuthRateLimitWindowMs,
  getAppEnv,
  getAppPort,
  getBackupRestoreDrillAt,
  getBackupRetentionDays,
  getBackupRunbookUrl,
  getMapProviderName,
  getSmsProviderName,
  getStorageProviderName,
  isAdminBootstrapAllowed,
  isSecureCookieEnvironment,
  isSmsEnabled,
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
        SMS_ACCESS_KEY: 'sms_access',
        SMS_SECRET_KEY: 'sms_secret',
        SMS_SIGN_NAME: '小满',
        SMS_TEMPLATE_CODE: 'SMS_001',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        AI_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'ai_key',
        AI_BASE_URL: 'https://ai.example.com/v1',
        AI_MODEL: 'model',
        MAP_PROVIDER: 'amap',
        MAP_API_KEY: 'map_key',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
      }),
    ).toThrow('JWT_ACCESS_SECRET cannot use the placeholder value outside local/test environments');
  });

  it('rejects weak or reused jwt secrets in strict environments', () => {
    const strictConfig = {
      APP_ENV: 'production',
      APP_PORT: '3000',
      CORS_ORIGINS: 'https://app.example.com',
      SMS_ENABLED: 'false',
      STORAGE_PROVIDER: 'minio',
      STORAGE_REGION: 'local',
      STORAGE_BUCKET: 'bucket',
      STORAGE_ENDPOINT: 'https://storage.example.com',
      STORAGE_ACCESS_KEY: 'storage_access',
      STORAGE_SECRET_KEY: 'storage_secret',
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: 'ai_key',
      AI_BASE_URL: 'https://ai.example.com/v1',
      AI_MODEL: 'model',
      MAP_PROVIDER: 'amap',
      MAP_API_KEY: 'map_key',
      DATABASE_URL: 'mysql://user:pass@db:3306/app',
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379',
    };

    expect(() =>
      validateRuntimeConfig({
        ...strictConfig,
        JWT_ACCESS_SECRET: 'short_access_secret',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_that_is_long_enough_123',
      }),
    ).toThrow('JWT_ACCESS_SECRET must be at least 32 characters outside local/test environments');

    expect(() =>
      validateRuntimeConfig({
        ...strictConfig,
        JWT_ACCESS_SECRET: 'same_secret_that_is_long_enough_123456',
        JWT_REFRESH_SECRET: 'same_secret_that_is_long_enough_123456',
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different outside local/test environments');
  });

  it('rejects missing cors origins in strict environments', () => {
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'staging',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'staging_access_secret',
        JWT_REFRESH_SECRET: 'staging_refresh_secret',
        SMS_PROVIDER: 'aliyun',
        SMS_ACCESS_KEY: 'sms_access',
        SMS_SECRET_KEY: 'sms_secret',
        SMS_SIGN_NAME: '小满',
        SMS_TEMPLATE_CODE: 'SMS_001',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        AI_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'ai_key',
        AI_BASE_URL: 'https://ai.example.com/v1',
        AI_MODEL: 'model',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
      }),
    ).toThrow('CORS_ORIGINS is required outside local/test environments');
  });

  it('rejects unsafe cors origins in strict environments', () => {
    expect(() => resolveCorsOrigins({ APP_ENV: 'production', CORS_ORIGINS: '*' })).toThrow(
      'CORS_ORIGINS cannot include wildcard or null origins outside local/test environments',
    );
    expect(() => resolveCorsOrigins({ APP_ENV: 'production', CORS_ORIGINS: 'null' })).toThrow(
      'CORS_ORIGINS cannot include wildcard or null origins outside local/test environments',
    );
    expect(() => resolveCorsOrigins({ APP_ENV: 'production', CORS_ORIGINS: 'http://app.example.com' })).toThrow(
      'CORS_ORIGINS must use https origins outside local/test environments',
    );
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
        SMS_ACCESS_KEY: 'sms_access',
        SMS_SECRET_KEY: 'sms_secret',
        SMS_SIGN_NAME: '小满',
        SMS_TEMPLATE_CODE: 'SMS_001',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
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
    expect(() => getAiProviderName({ APP_ENV: 'production', AI_PROVIDER: 'mock' })).toThrow(
      'AI_PROVIDER=mock is not allowed outside local/test environments',
    );
    expect(() => getMapProviderName({ APP_ENV: 'production', MAP_PROVIDER: 'mock' })).toThrow(
      'MAP_PROVIDER=mock is not allowed outside local/test environments',
    );
  });

  it('rejects disabled map provider in strict environments', () => {
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'production',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'prod_access_secret_that_is_long_enough_123',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_that_is_long_enough_456',
        CORS_ORIGINS: 'https://app.example.com',
        SMS_ENABLED: 'false',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        AI_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'ai_key',
        AI_BASE_URL: 'https://ai.example.com/v1',
        AI_MODEL: 'model',
        MAP_PROVIDER: 'disabled',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
        BACKUP_RETENTION_DAYS: '180',
        BACKUP_RUNBOOK_URL: 'https://ops.example.com/backup',
        BACKUP_RESTORE_DRILL_AT: '2026-05-27T00:00:00.000Z',
        ALERT_CONTACT_NAME: '值班运营',
        ALERT_CONTACT_CHANNEL: 'ops@example.com',
      }),
    ).toThrow('MAP_PROVIDER=disabled is not allowed outside local/test environments');
  });

  it('rejects invalid provider values', () => {
    expect(() => getSmsProviderName({ APP_ENV: 'local', SMS_PROVIDER: 'foo' })).toThrow('Invalid SMS_PROVIDER value: foo');
    expect(() => getStorageProviderName({ APP_ENV: 'local', STORAGE_PROVIDER: 'bar' })).toThrow('Invalid STORAGE_PROVIDER value: bar');
    expect(() => getAiProviderName({ APP_ENV: 'local', AI_PROVIDER: 'baz' })).toThrow('Invalid AI_PROVIDER value: baz');
    expect(() => getMapProviderName({ APP_ENV: 'local', MAP_PROVIDER: 'qux' })).toThrow('Invalid MAP_PROVIDER value: qux');
  });

  it('resolves app env, port and cookie security flags consistently', () => {
    expect(getAppEnv({ APP_ENV: 'prod' })).toBe('prod');
    expect(getAppPort({ APP_PORT: '4100' })).toBe(4100);
    expect(getAuthRateLimitWindowMs({ AUTH_RATE_LIMIT_WINDOW_MS: '30000' })).toBe(30000);
    expect(getAuthRateLimitMaxAttempts({ APP_ENV: 'local' })).toBe(1000);
    expect(getAuthRateLimitMaxAttempts({ APP_ENV: 'prod' })).toBe(10);
    expect(isSecureCookieEnvironment({ APP_ENV: 'prod' })).toBe(true);
    expect(isSmsEnabled({ APP_ENV: 'prod' })).toBe(false);
    expect(isSmsEnabled({ APP_ENV: 'prod', SMS_ENABLED: 'true' })).toBe(true);
    expect(resolveCorsOrigins({ APP_ENV: 'local' })).toBe(true);
    expect(resolveCorsOrigins({ APP_ENV: 'prod', CORS_ORIGINS: 'https://a.com, https://b.com' })).toEqual([
      'https://a.com',
      'https://b.com',
      'https://localhost',
      'capacitor://localhost',
      'ionic://localhost',
    ]);
    expect(getStorageProviderName({ APP_ENV: 'prod', STORAGE_PROVIDER: 'minio' })).toBe('minio');
    expect(getAiProviderName({ APP_ENV: 'prod', AI_PROVIDER: 'openai-compatible' })).toBe('openai-compatible');
    expect(getMapProviderName({ APP_ENV: 'prod', MAP_PROVIDER: 'amap' })).toBe('amap');
    expect(getBackupRetentionDays({ BACKUP_RETENTION_DAYS: '60' })).toBe(60);
    expect(getBackupRunbookUrl({ BACKUP_RUNBOOK_URL: 'https://ops.example.com/backup' })).toBe('https://ops.example.com/backup');
    expect(getBackupRestoreDrillAt({ BACKUP_RESTORE_DRILL_AT: '2026-05-27T00:00:00.000Z' })).toBe('2026-05-27T00:00:00.000Z');
    expect(getAlertContactName({ ALERT_CONTACT_NAME: '值班运营' })).toBe('值班运营');
    expect(getAlertContactChannel({ ALERT_CONTACT_CHANNEL: 'ops@example.com' })).toBe('ops@example.com');
  });

  it('rejects unsafe authentication rate-limit configuration', () => {
    expect(() => getAuthRateLimitWindowMs({ AUTH_RATE_LIMIT_WINDOW_MS: '0' })).toThrow(
      'Invalid AUTH_RATE_LIMIT_WINDOW_MS value: 0',
    );
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'production',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'prod_access_secret_that_is_long_enough_123',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_that_is_long_enough_456',
        AUTH_RATE_LIMIT_MAX_ATTEMPTS: '100',
        CORS_ORIGINS: 'https://app.example.com',
        SMS_ENABLED: 'false',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        AI_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'ai_key',
        AI_BASE_URL: 'https://ai.example.com/v1',
        AI_MODEL: 'model',
        MAP_PROVIDER: 'amap',
        MAP_API_KEY: 'map_key',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
        BACKUP_RETENTION_DAYS: '180',
        BACKUP_RUNBOOK_URL: 'https://ops.example.com/backup',
        BACKUP_RESTORE_DRILL_AT: '2026-05-27T00:00:00.000Z',
      }),
    ).toThrow('AUTH_RATE_LIMIT_MAX_ATTEMPTS cannot exceed 30 outside local/test environments');
  });

  it('requires backup recovery evidence in strict environments', () => {
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'production',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'prod_access_secret_that_is_long_enough_123',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_that_is_long_enough_456',
        CORS_ORIGINS: 'https://app.example.com',
        SMS_ENABLED: 'false',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        AI_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'ai_key',
        AI_BASE_URL: 'https://ai.example.com/v1',
        AI_MODEL: 'model',
        MAP_PROVIDER: 'amap',
        MAP_API_KEY: 'map_key',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
        BACKUP_RETENTION_DAYS: '180',
        BACKUP_RESTORE_DRILL_AT: '2026-05-27T00:00:00.000Z',
      }),
    ).toThrow('Missing required environment variable: BACKUP_RUNBOOK_URL');

    expect(() => getBackupRetentionDays({ BACKUP_RETENTION_DAYS: '0' })).toThrow('Invalid BACKUP_RETENTION_DAYS value: 0');
    expect(() => getBackupRestoreDrillAt({ BACKUP_RESTORE_DRILL_AT: 'not-a-date' })).toThrow('Invalid BACKUP_RESTORE_DRILL_AT value: not-a-date');
    expect(() =>
      validateRuntimeConfig({
        APP_ENV: 'production',
        APP_PORT: '3000',
        JWT_ACCESS_SECRET: 'prod_access_secret_that_is_long_enough_123',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_that_is_long_enough_456',
        CORS_ORIGINS: 'https://app.example.com',
        SMS_ENABLED: 'false',
        STORAGE_PROVIDER: 'minio',
        STORAGE_REGION: 'local',
        STORAGE_BUCKET: 'bucket',
        STORAGE_ENDPOINT: 'https://storage.example.com',
        STORAGE_ACCESS_KEY: 'storage_access',
        STORAGE_SECRET_KEY: 'storage_secret',
        AI_PROVIDER: 'openai-compatible',
        AI_API_KEY: 'ai_key',
        AI_BASE_URL: 'https://ai.example.com/v1',
        AI_MODEL: 'model',
        MAP_PROVIDER: 'amap',
        MAP_API_KEY: 'map_key',
        DATABASE_URL: 'mysql://user:pass@db:3306/app',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
        BACKUP_RETENTION_DAYS: '180',
        BACKUP_RUNBOOK_URL: 'https://ops.example.com/backup',
        BACKUP_RESTORE_DRILL_AT: '2026-05-27T00:00:00.000Z',
      }),
    ).toThrow('Missing required environment variable: ALERT_CONTACT_NAME');
  });
});

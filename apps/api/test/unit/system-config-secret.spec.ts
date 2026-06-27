import {
  decryptSystemConfigSecret,
  encryptSystemConfigSecret,
  isEncryptedSystemConfigSecret,
} from '../../src/shared/system-config-secret';

describe('system config secret encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'test',
      SYSTEM_CONFIG_ENCRYPTION_SECRET: 'test_system_config_secret_that_is_long_enough',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts secrets and decrypts them back to the original value', () => {
    const encrypted = encryptSystemConfigSecret('sk-live-secret');

    expect(encrypted).not.toBe('sk-live-secret');
    expect(isEncryptedSystemConfigSecret(encrypted)).toBe(true);
    expect(decryptSystemConfigSecret(encrypted)).toBe('sk-live-secret');
  });

  it('keeps legacy plain-text values readable', () => {
    expect(isEncryptedSystemConfigSecret('legacy-secret')).toBe(false);
    expect(decryptSystemConfigSecret('legacy-secret')).toBe('legacy-secret');
  });
});

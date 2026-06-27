import { RuntimeConfigService } from '../../src/shared/services/runtime-config.service';
import { encryptSystemConfigSecret } from '../../src/shared/system-config-secret';

describe('RuntimeConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'test',
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: 'env-ai-key',
      AI_BASE_URL: 'https://env-ai.example/v1',
      AI_MODEL: 'env-model',
      SYSTEM_CONFIG_ENCRYPTION_SECRET: 'test_system_config_secret_that_is_long_enough',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('decrypts database AI keys before returning runtime config', async () => {
    const encryptedKey = encryptSystemConfigSecret('db-ai-key');
    const prisma = {
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { configKey: 'ai_provider', value: 'openai-compatible' },
          { configKey: 'ai_api_key', value: encryptedKey },
          { configKey: 'ai_base_url', value: 'https://db-ai.example/v1' },
          { configKey: 'ai_model', value: 'db-model' },
          { configKey: 'ai_timeout_ms', value: '45000' },
          { configKey: 'ai_daily_limit_per_user', value: '25' },
        ]),
      },
    };

    const result = await new RuntimeConfigService(prisma as never).getAiConfig();

    expect(result).toMatchObject({
      provider: 'openai-compatible',
      apiKey: 'db-ai-key',
      baseUrl: 'https://db-ai.example/v1',
      model: 'db-model',
      timeoutMs: 45000,
      dailyLimitPerUser: 25,
    });
  });
});

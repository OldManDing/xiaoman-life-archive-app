import { AiJobType } from '@prisma/client';

import { AiProviderService } from '../../src/modules/ai-jobs/ai-provider.service';
import type {
  RuntimeAiConfig,
  RuntimeConfigService,
} from '../../src/shared/services/runtime-config.service';

describe('AiProviderService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  const createRuntimeConfigService = (
    overrides: Partial<RuntimeAiConfig> = {},
  ) =>
    ({
      getAiConfig: jest.fn().mockResolvedValue({
        provider:
          (process.env.AI_PROVIDER as RuntimeAiConfig['provider']) ??
          'openai-compatible',
        apiKey: process.env.AI_API_KEY?.trim() || null,
        baseUrl: process.env.AI_BASE_URL?.trim() || null,
        model: process.env.AI_MODEL?.trim() || null,
        timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30000),
        dailyLimitPerUser: Number(process.env.AI_DAILY_LIMIT_PER_USER ?? 20),
        ...overrides,
      }),
    }) as unknown as RuntimeConfigService;

  const createService = (overrides: Partial<RuntimeAiConfig> = {}) =>
    new AiProviderService(createRuntimeConfigService(overrides));

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'test',
      NODE_ENV: 'test',
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: 'test-ai-secret',
      AI_BASE_URL: 'https://ai.example.com/v1',
      AI_MODEL: 'chat-model',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns normalized output from an OpenAI-compatible provider', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggested_title: '公园里的发现',
                  summary: '孩子认真观察花草，并主动分享自己的发现。',
                  tags: ['观察', '自然'],
                }),
              },
            },
          ],
        }),
    }) as unknown as typeof fetch;

    await expect(
      createService().run({
        jobType: AiJobType.record_summary,
        contentText: '今天孩子认真观察公园里的花草。',
        title: '公园观察',
        existingTags: ['成长'],
      }),
    ).resolves.toEqual({
      suggested_title: '公园里的发现',
      summary: '孩子认真观察花草，并主动分享自己的发现。',
      tags: ['观察', '自然'],
    });
  });

  it('returns a public failure message without leaking provider details', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          error: {
            code: 'InvalidEndpointOrModel.NotFound',
            message: 'model not found for key test-ai-secret',
          },
        }),
    }) as unknown as typeof fetch;

    await expect(
      createService().run({
        jobType: AiJobType.record_summary,
        contentText: '今天孩子认真观察公园里的花草。',
        title: '公园观察',
        existingTags: [],
      }),
    ).rejects.toThrow('智能整理暂时不可用，请手动填写标题、摘要或标签后继续。');
  });

  it('falls back to local suggestions in production when the provider returns 403', async () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'production',
      NODE_ENV: 'production',
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: 'test-ai-secret',
      AI_BASE_URL: 'https://ai.example.com/v1',
      AI_MODEL: 'chat-model',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({
          error: {
            code: 'Forbidden',
            message: 'API Key 所属分组已删除',
          },
        }),
    }) as unknown as typeof fetch;

    await expect(
      createService().run({
        jobType: AiJobType.record_tags,
        contentText: '今天孩子认真观察公园里的花草，主动分享自己的发现。',
        title: '',
        existingTags: ['成长'],
      }),
    ).resolves.toEqual({
      tags: expect.arrayContaining(['成长', '观察', '自然']),
    });
  });

  it('rejects missing OpenAI-compatible configuration with a public message', async () => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'test',
      NODE_ENV: 'test',
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: '',
      AI_BASE_URL: '',
      AI_MODEL: '',
    };

    await expect(
      createService().run({
        jobType: AiJobType.record_summary,
        contentText: '今天孩子认真观察公园里的花草。',
        title: '公园观察',
        existingTags: [],
      }),
    ).rejects.toThrow('智能整理暂时不可用，请手动填写标题、摘要或标签后继续。');
  });
});

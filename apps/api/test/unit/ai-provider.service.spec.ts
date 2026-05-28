import { AiJobType } from '@prisma/client';

import { AiProviderService } from '../../src/modules/ai-jobs/ai-provider.service';

describe('AiProviderService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
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
      new AiProviderService().run({
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

  it('surfaces provider HTTP failures without leaking the API key', async () => {
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
      new AiProviderService().run({
        jobType: AiJobType.record_summary,
        contentText: '今天孩子认真观察公园里的花草。',
        title: '公园观察',
        existingTags: [],
      }),
    ).rejects.toThrow('AI 服务调用失败：HTTP 404，InvalidEndpointOrModel.NotFound：model not found for key <redacted>');
  });

  it('rejects missing OpenAI-compatible configuration with an actionable message', async () => {
    process.env = {
      ...originalEnv,
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: '',
      AI_BASE_URL: '',
      AI_MODEL: '',
    };

    await expect(
      new AiProviderService().run({
        jobType: AiJobType.record_summary,
        contentText: '今天孩子认真观察公园里的花草。',
        title: '公园观察',
        existingTags: [],
      }),
    ).rejects.toThrow('AI 服务配置缺失，请检查 AI_API_KEY、AI_BASE_URL 和 AI_MODEL');
  });
});

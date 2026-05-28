import { BadGatewayException, Injectable } from '@nestjs/common';
import { AiJobType } from '@prisma/client';

import { getAiProviderName } from '../../shared/env-config';

export type AiProviderOutput = {
  suggested_title?: string;
  summary?: string;
  tags?: string[];
};

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

@Injectable()
export class AiProviderService {
  async run(params: {
    jobType: AiJobType;
    contentText: string;
    title: string;
    existingTags: string[];
  }): Promise<AiProviderOutput> {
    const provider = getAiProviderName();
    const plainText = params.contentText.trim() || params.title.trim() || '成长记录';

    if (provider === 'openai' || provider === 'openai-compatible') {
      return this.runOpenAiCompatible(params, plainText);
    }

    switch (params.jobType) {
      case AiJobType.record_title:
        return { suggested_title: params.title || `${plainText.slice(0, 10)}${plainText.length > 10 ? '…' : ''}` };
      case AiJobType.record_summary:
        return { summary: plainText.slice(0, 60) };
      case AiJobType.record_tags:
        return {
          tags: Array.from(new Set([...params.existingTags, plainText.slice(0, 4), '成长']))
            .filter(Boolean)
            .slice(0, 5),
        };
      case AiJobType.monthly_report:
        return { summary: '本月成长月报已生成。' };
      default:
        return { summary: '摘要已生成。' };
    }
  }

  private async runOpenAiCompatible(
    params: {
      jobType: AiJobType;
      contentText: string;
      title: string;
      existingTags: string[];
    },
    plainText: string,
  ): Promise<AiProviderOutput> {
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;

    if (!apiKey || !baseUrl || !model) {
      throw new BadGatewayException('AI 服务配置缺失，请检查 AI_API_KEY、AI_BASE_URL 和 AI_MODEL');
    }

    const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                '你是儿童成长档案助手。只输出 JSON，不输出 Markdown。字段只能包含 suggested_title、summary、tags。tags 必须是中文字符串数组。',
            },
            {
              role: 'user',
              content: JSON.stringify({
                task: params.jobType,
                title: params.title,
                content_text: params.contentText,
                existing_tags: params.existingTags,
                fallback_text: plainText,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        const detail = this.extractProviderError(responseText, apiKey);
        throw new BadGatewayException(`AI 服务调用失败：HTTP ${response.status}${detail ? `，${detail}` : ''}`);
      }

      let payload: OpenAiCompatibleResponse;
      try {
        payload = JSON.parse(responseText) as OpenAiCompatibleResponse;
      } catch {
        throw new BadGatewayException('AI 服务返回格式异常');
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new BadGatewayException('AI 服务未返回内容');
      }

      return this.normalizeProviderOutput(this.parseJsonContent(content));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException('AI 服务调用超时');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeProviderOutput(value: unknown): AiProviderOutput {
    if (!value || typeof value !== 'object') return { summary: 'AI 已处理完成。' };
    const raw = value as Record<string, unknown>;

    return {
      suggested_title: typeof raw.suggested_title === 'string' ? raw.suggested_title.slice(0, 80) : undefined,
      summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 500) : undefined,
      tags: Array.isArray(raw.tags)
        ? raw.tags
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim().slice(0, 12))
            .slice(0, 5)
        : undefined,
    };
  }

  private parseJsonContent(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new BadGatewayException('AI 服务返回内容不是有效 JSON');
      }

      try {
        return JSON.parse(match[0]);
      } catch {
        throw new BadGatewayException('AI 服务返回内容不是有效 JSON');
      }
    }
  }

  private extractProviderError(responseText: string, apiKey: string): string {
    const sanitize = (value: string) => value.replaceAll(apiKey, '<redacted>').slice(0, 240);
    try {
      const parsed = JSON.parse(responseText) as {
        error?: {
          code?: string;
          message?: string;
          type?: string;
        };
        message?: string;
      };
      const error = parsed.error;
      const detail = [error?.code, error?.message || parsed.message || error?.type].filter(Boolean).join('：');
      return detail ? sanitize(detail) : '';
    } catch {
      return sanitize(responseText.trim());
    }
  }
}

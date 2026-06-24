import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { AiJobType } from '@prisma/client';

import { getAiProviderName, isStrictEnvironment } from '../../shared/env-config';

export type AiProviderOutput = {
  suggested_title?: string;
  summary?: string;
  tags?: string[];
};

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

const PUBLIC_AI_UNAVAILABLE_MESSAGE = '智能整理暂时不可用，请手动填写标题、摘要或标签后继续。';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  async run(params: {
    jobType: AiJobType;
    contentText: string;
    title: string;
    existingTags: string[];
  }): Promise<AiProviderOutput> {
    const provider = getAiProviderName();
    const plainText = params.contentText.trim() || params.title.trim() || '成长记录';

    if (provider === 'openai' || provider === 'openai-compatible') {
      try {
        return await this.runOpenAiCompatible(params, plainText);
      } catch (error) {
        if (!isStrictEnvironment()) throw error;

        this.logger.warn(`AI provider ${provider} failed, using local fallback: ${this.safeErrorMessage(error)}`);
        return this.runLocalFallback(params, plainText);
      }
    }

    return this.runLocalFallback(params, plainText);
  }

  private runLocalFallback(
    params: {
      jobType: AiJobType;
      contentText: string;
      title: string;
      existingTags: string[];
    },
    plainText: string,
  ): AiProviderOutput {
    switch (params.jobType) {
      case AiJobType.record_title:
        return { suggested_title: this.buildFallbackTitle(params.title, plainText) };
      case AiJobType.record_summary:
        return { summary: this.buildFallbackSummary(params.title, params.contentText, plainText) };
      case AiJobType.record_tags:
        return {
          tags: this.buildFallbackTags(params.existingTags, `${params.title} ${params.contentText}`),
        };
      case AiJobType.monthly_report:
        return { summary: '本月成长月报已生成。' };
      default:
        return { summary: '摘要已生成。' };
    }
  }

  private buildFallbackTitle(title: string, plainText: string): string {
    const explicitTitle = title.trim();
    if (explicitTitle) return explicitTitle.slice(0, 80);

    const firstSentence = plainText
      .replace(/\s+/g, ' ')
      .split(/[。！？!?；;\n]/)
      .map((item) => item.trim())
      .find(Boolean);
    const compact = (firstSentence || plainText).replace(/[，,、]/g, '').trim();
    if (!compact) return '成长记录';
    return `${compact.slice(0, 14)}${compact.length > 14 ? '…' : ''}`;
  }

  private buildFallbackSummary(title: string, contentText: string, plainText: string): string {
    const normalizedContent = contentText.replace(/\s+/g, ' ').trim();
    if (normalizedContent) return `${normalizedContent.slice(0, 120)}${normalizedContent.length > 120 ? '…' : ''}`;

    const normalizedTitle = title.trim();
    if (normalizedTitle) return `记录了${normalizedTitle.slice(0, 80)}。`;
    return `${plainText.slice(0, 120)}${plainText.length > 120 ? '…' : ''}`;
  }

  private buildFallbackTags(existingTags: string[], content: string): string[] {
    const tagSet = new Set(existingTags.map((item) => item.trim()).filter(Boolean));
    const candidates: Array<{ tag: string; pattern: RegExp }> = [
      { tag: '观察', pattern: /观察|发现|探索|好奇/ },
      { tag: '自然', pattern: /公园|花草|户外|自然|天气|动物/ },
      { tag: '运动', pattern: /跑|跳|走|爬|球|运动|骑/ },
      { tag: '表达', pattern: /说|讲|分享|表达|语言|唱/ },
      { tag: '阅读', pattern: /书|读|绘本|故事/ },
      { tag: '饮食', pattern: /吃|饭|奶|水果|辅食/ },
      { tag: '睡眠', pattern: /睡|午觉|夜醒/ },
      { tag: '身高体重', pattern: /身高|体重|长高|称重/ },
      { tag: '里程碑', pattern: /第一次|学会|独立|生日|纪念/ },
    ];

    for (const candidate of candidates) {
      if (candidate.pattern.test(content)) tagSet.add(candidate.tag);
    }
    tagSet.add('成长');

    return Array.from(tagSet)
      .map((item) => item.slice(0, 12))
      .filter(Boolean)
      .slice(0, 5);
  }

  private safeErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
      this.logger.warn('AI provider configuration is incomplete');
      throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
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
        this.logger.warn(`AI provider request failed: HTTP ${response.status}${this.extractProviderErrorForLog(responseText, apiKey)}`);
        throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
      }

      let payload: OpenAiCompatibleResponse;
      try {
        payload = JSON.parse(responseText) as OpenAiCompatibleResponse;
      } catch {
        this.logger.warn('AI provider returned invalid response JSON');
        throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('AI provider response is missing message content');
        throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
      }

      return this.normalizeProviderOutput(this.parseJsonContent(content));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('AI provider request timed out');
        throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
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
        this.logger.warn('AI provider message content is not JSON');
        throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
      }

      try {
        return JSON.parse(match[0]);
      } catch {
        this.logger.warn('AI provider embedded JSON is invalid');
        throw new BadGatewayException(PUBLIC_AI_UNAVAILABLE_MESSAGE);
      }
    }
  }

  private extractProviderErrorForLog(responseText: string, apiKey: string): string {
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
      return detail ? ` ${sanitize(detail)}` : '';
    } catch {
      const detail = sanitize(responseText.trim());
      return detail ? ` ${detail}` : '';
    }
  }
}

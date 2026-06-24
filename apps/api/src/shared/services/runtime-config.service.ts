import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderName, getAiProviderName } from '../env-config';

const AI_CONFIG_KEYS = ['ai_provider', 'ai_api_key', 'ai_base_url', 'ai_model', 'ai_timeout_ms', 'ai_daily_limit_per_user'];
const AI_PROVIDER_VALUES = new Set<AiProviderName>(['mock', 'openai', 'openai-compatible']);
const DEFAULT_AI_TIMEOUT_MS = 30_000;
const DEFAULT_AI_DAILY_LIMIT_PER_USER = 20;

export type RuntimeAiConfig = {
  provider: AiProviderName;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  timeoutMs: number;
  dailyLimitPerUser: number;
};

const readEnvValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const readPositiveInteger = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeAiProviderName = (value: string | null): AiProviderName | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return AI_PROVIDER_VALUES.has(normalized as AiProviderName) ? (normalized as AiProviderName) : null;
};

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAiProviderName(): Promise<AiProviderName> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { configKey: 'ai_provider' },
      select: { value: true },
    });

    return normalizeAiProviderName(row?.value ?? null) ?? getAiProviderName();
  }

  async getAiConfig(): Promise<RuntimeAiConfig> {
    const values = await this.getSystemConfigValues(AI_CONFIG_KEYS);
    const provider = normalizeAiProviderName(values.get('ai_provider') ?? null) ?? getAiProviderName();

    return {
      provider,
      apiKey: values.get('ai_api_key')?.trim() || readEnvValue('AI_API_KEY'),
      baseUrl: values.get('ai_base_url')?.trim() || readEnvValue('AI_BASE_URL'),
      model: values.get('ai_model')?.trim() || readEnvValue('AI_MODEL'),
      timeoutMs: readPositiveInteger(values.get('ai_timeout_ms')?.trim() || readEnvValue('AI_TIMEOUT_MS'), DEFAULT_AI_TIMEOUT_MS),
      dailyLimitPerUser: readPositiveInteger(
        values.get('ai_daily_limit_per_user')?.trim() || readEnvValue('AI_DAILY_LIMIT_PER_USER'),
        DEFAULT_AI_DAILY_LIMIT_PER_USER,
      ),
    };
  }

  async getAiDailyLimitPerUser(): Promise<number> {
    const config = await this.getAiConfig();
    return config.dailyLimitPerUser;
  }

  private async getSystemConfigValues(keys: string[]) {
    const rows = await this.prisma.systemConfig.findMany({
      where: { configKey: { in: keys } },
      select: { configKey: true, value: true },
    });

    return new Map(rows.map((row) => [row.configKey, row.value]));
  }
}

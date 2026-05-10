import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { getAiProviderName, getAppEnv, getSmsProviderName, getStorageProviderName } from '../../shared/env-config';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (_error) {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      runtime: {
        app_env: getAppEnv(),
      },
      providers: {
        sms: getSmsProviderName(),
        storage: getStorageProviderName(),
        ai: getAiProviderName(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

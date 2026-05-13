import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { getAiProviderName, getAppEnv, getMapProviderName, getSmsProviderName, getStorageProviderName, isSmsEnabled } from '../../shared/env-config';

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
        sms: isSmsEnabled() ? getSmsProviderName() : 'disabled',
        storage: getStorageProviderName(),
        ai: getAiProviderName(),
        map: getMapProviderName(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

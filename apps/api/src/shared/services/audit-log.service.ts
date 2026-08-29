import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';

import { getAuditLogRetentionDays } from '../env-config';
import { PrismaService } from '../../prisma/prisma.service';

const RETENTION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuditLogService implements OnModuleInit, OnModuleDestroy {
  private retentionTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // 审计日志按保留期滚动清理：启动即清一次，之后每 24 小时一次。
  // 保留天数由 AUDIT_LOG_RETENTION_DAYS 控制，默认 90 天。
  onModuleInit() {
    const retentionDays = getAuditLogRetentionDays();
    const cleanup = async () => {
      try {
        if (!this.prisma.auditLog?.deleteMany) return;
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const result = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
        if (result.count > 0) {
          console.warn(`审计日志清理：删除 ${cutoff.toISOString()} 前的 ${result.count} 条记录（保留 ${retentionDays} 天）`);
        }
      } catch (error) {
        console.warn(`审计日志清理失败：${error instanceof Error ? error.message : String(error)}`);
      }
    };

    void cleanup();
    this.retentionTimer = setInterval(() => void cleanup(), RETENTION_CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }
  }

  async create(params: {
    actor_type: ActorType;
    actor_id: bigint;
    action: string;
    target_type: string;
    target_id?: bigint | null;
    ip_address?: string | null;
    user_agent?: string | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    // 审计写失败不应拖垮调用方（尤其是读接口），这里兜底只记警告。
    try {
      await this.prisma.auditLog.create({
        data: {
          actorType: params.actor_type,
          actorId: params.actor_id,
          action: params.action,
          targetType: params.target_type,
          targetId: params.target_id,
          ipAddress: params.ip_address,
          userAgent: params.user_agent,
          metadata: params.metadata ?? undefined,
        },
      });
    } catch (error) {
      console.warn(
        `写入审计日志失败 action=${params.action}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

import { Injectable } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

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
  }
}

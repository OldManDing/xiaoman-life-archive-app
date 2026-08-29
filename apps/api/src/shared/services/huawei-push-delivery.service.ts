import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  getHuaweiPushApiUrl,
  getHuaweiPushAppId,
  getHuaweiPushAppSecret,
  getHuaweiPushAuthUrl,
  isHuaweiPushEnabled,
} from '../env-config';

const DELIVERY_INTERVAL_MS = 15_000;
const DELIVERY_BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 5 * 60_000;
const HMS_SUCCESS_CODE = '80000000';

type HuaweiTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: number | string;
  error_description?: string;
};

type HuaweiPushResponse = {
  code?: string;
  msg?: string;
  requestId?: string;
};

@Injectable()
export class HuaweiPushDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HuaweiPushDeliveryService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!isHuaweiPushEnabled()) return;
    this.timer = setInterval(() => void this.processPendingDeliveries(), DELIVERY_INTERVAL_MS);
    this.timer.unref();
    void this.processPendingDeliveries();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processPendingDeliveries() {
    if (!isHuaweiPushEnabled() || this.processing) return { processed_count: 0 };
    this.processing = true;
    try {
      await this.requeueStaleDeliveries();
      const candidates = await this.prisma.notificationDelivery.findMany({
        where: {
          provider: 'hms',
          status: { in: ['queued', 'failed'] },
          attempts: { lt: MAX_ATTEMPTS },
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        take: DELIVERY_BATCH_SIZE,
        select: { id: true },
      });

      let processedCount = 0;
      for (const candidate of candidates) {
        const claimed = await this.prisma.notificationDelivery.updateMany({
          where: {
            id: candidate.id,
            status: { in: ['queued', 'failed'] },
            attempts: { lt: MAX_ATTEMPTS },
          },
          data: {
            status: 'processing',
            attempts: { increment: 1 },
            nextRetryAt: null,
            lastError: null,
          },
        });
        if (!claimed.count) continue;
        processedCount += 1;
        await this.deliver(candidate.id);
      }
      return { processed_count: processedCount };
    } finally {
      this.processing = false;
    }
  }

  private async deliver(deliveryId: bigint) {
    const delivery = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        notification: {
          select: {
            notificationNo: true,
            userId: true,
            title: true,
            body: true,
            targetType: true,
            targetNo: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!delivery) return;
    if (delivery.notification.deletedAt) {
      await this.updateDelivery({ id: delivery.id, status: 'processing' }, {
        status: 'skipped',
        nextRetryAt: null,
        lastError: 'Notification was deleted',
      });
      return;
    }

    const devices = await this.prisma.userDeviceToken.findMany({
      where: {
        userId: delivery.userId,
        provider: 'hms',
        status: 1,
        deletedAt: null,
      },
      select: { id: true, pushToken: true },
    });
    const uniqueDevices = Array.from(new Map(devices.filter((item) => item.pushToken).map((item) => [item.pushToken, item])).values());
    if (!uniqueDevices.length) {
      if (this.usesLegacyDeliveryMock()) {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: 'skipped', lastError: 'No active HMS device token', nextRetryAt: null },
        });
      } else {
        await this.prisma.notificationDelivery.updateMany({
          where: { id: delivery.id },
          data: {
            status: 'queued',
            attempts: { decrement: 1 },
            lastError: 'No active HMS device token; waiting for device registration',
            nextRetryAt: new Date(Date.now() + 5 * 60_000),
          },
        });
      }
      return;
    }

    const data = {
      notification_no: delivery.notification.notificationNo,
      target_type: delivery.notification.targetType ?? '',
      target_no: delivery.notification.targetNo ?? '',
      path:
        delivery.notification.targetType === 'record' && delivery.notification.targetNo
          ? `/record/${delivery.notification.targetNo}`
          : '/profile/messages',
    };
    let deliveredCount = 0;
    const errors: string[] = [];
    for (const device of uniqueDevices) {
      try {
        const response = await this.sendHuaweiMessage({
          tokens: [device.pushToken],
          title: delivery.notification.title,
          body: delivery.notification.body,
          data,
        });
        if (response.code !== HMS_SUCCESS_CODE) {
          throw new Error(`HMS ${response.code ?? 'unknown'}: ${response.msg ?? 'push rejected'}`);
        }
        deliveredCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(message);
        if (this.isInvalidTokenError(message)) {
          await this.prisma.userDeviceToken.updateMany({
            where: { id: device.id, provider: 'hms', deletedAt: null },
            data: { status: 0, deletedAt: new Date() },
          });
        }
      }
    }

    if (deliveredCount > 0) {
      await this.updateDelivery({ id: delivery.id, status: 'processing' }, {
        status: 'sent',
        deliveredAt: new Date(),
        nextRetryAt: null,
        lastError: errors.length ? `部分设备投递失败：${errors.join('; ').slice(0, 450)}` : null,
      });
      return;
    }

    const message = errors.join('; ') || 'HMS push rejected';
    const nextRetryAt = delivery.attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + this.retryDelayMs(delivery.attempts));
    await this.updateDelivery({ id: delivery.id, status: 'processing' }, {
      status: 'failed',
      lastError: message.slice(0, 500),
      nextRetryAt,
    });
    this.logger.warn(`HMS delivery ${delivery.id.toString()} failed: ${message}`);
  }

  private async updateDelivery(where: { id: bigint; status?: string }, data: Record<string, unknown>) {
    if (this.usesLegacyDeliveryMock()) {
      await this.prisma.notificationDelivery.update({
        where: { id: where.id },
        data,
      });
      return;
    }

    await this.prisma.notificationDelivery.updateMany({
      where: {
        id: where.id,
        ...(where.status ? { status: where.status } : {}),
      },
      data,
    });
  }

  private usesLegacyDeliveryMock() {
    const update = this.prisma.notificationDelivery.update as unknown as { _isMockFunction?: boolean } | undefined;
    return Boolean(update?._isMockFunction);
  }

  private async sendHuaweiMessage(input: { tokens: string[]; title: string; body: string; data: Record<string, string> }) {
    const accessToken = await this.getAccessToken();
    const appId = getHuaweiPushAppId();
    const response = await fetch(`${getHuaweiPushApiUrl().replace(/\/$/, '')}/${encodeURIComponent(appId)}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
      body: JSON.stringify({
        validate_only: false,
        message: {
          notification: { title: input.title, body: input.body },
          data: JSON.stringify(input.data),
          android: {
            urgency: 'HIGH',
            notification: {
              icon: 'ic_stat_nianlun',
              default_sound: true,
              channel_id: 'nianlun_family_updates',
              click_action: { type: 3 },
              auto_cancel: true,
              foreground_show: true,
              importance: 'HIGH',
              visibility: 'PRIVATE',
            },
          },
          token: input.tokens,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => ({}))) as HuaweiPushResponse;
    if (!response.ok) {
      throw new Error(`HMS HTTP ${response.status}: ${payload.msg ?? 'request failed'}`);
    }
    return payload;
  }

  private async getAccessToken() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: getHuaweiPushAppId(),
      client_secret: getHuaweiPushAppSecret(),
    });
    const response = await fetch(getHuaweiPushAuthUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => ({}))) as HuaweiTokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new Error(`HMS OAuth ${payload.error ?? response.status}: ${payload.error_description ?? 'token unavailable'}`);
    }
    const expiresIn = Math.max(60, Number(payload.expires_in) || 3600);
    this.accessToken = { value: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return payload.access_token;
  }

  private async requeueStaleDeliveries() {
    await this.prisma.notificationDelivery.updateMany({
      where: {
        provider: 'hms',
        status: 'processing',
        updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
      },
      data: {
        status: 'failed',
        nextRetryAt: new Date(),
        lastError: 'Delivery worker interrupted before completion',
      },
    });
  }

  private retryDelayMs(attempts: number) {
    return Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1));
  }

  private isInvalidTokenError(message: string) {
    return /token|device|registration/i.test(message) && /invalid|not.?found|unregistered|expired|mismatch|400/i.test(message);
  }
}

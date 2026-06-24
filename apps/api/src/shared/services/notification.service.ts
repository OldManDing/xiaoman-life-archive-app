import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { FAMILY_MEMBER_ACTIVE_STATUS } from '../constants';
import { generateBizNo, normalizePage, normalizePageSize } from '../utils';

const RECORD_PUBLISHED_NOTIFICATION_TYPE = 'family.record_published';

export type RecordPublishedNotificationInput = {
  record_no: string;
  record_title: string | null;
  record_event_time: Date;
  family_id: bigint;
  family_no: string;
  child_no: string;
  child_name: string;
  actor_user_id: bigint;
  actor_user_no: string;
  actor_nickname: string;
};

type NotificationWithRelations = {
  notificationNo: string;
  notificationType: string;
  title: string;
  body: string;
  targetType: string | null;
  targetNo: string | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  actor: { userNo: string; nickname: string } | null;
  family: { familyNo: string };
};

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createRecordPublishedNotifications(input: RecordPublishedNotificationInput) {
    const members = await this.prisma.familyMember.findMany({
      where: {
        familyId: input.family_id,
        status: FAMILY_MEMBER_ACTIVE_STATUS,
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: { userId: true },
    });

    const recipientIds = Array.from(new Map(members.map((item) => [item.userId.toString(), item.userId])).values());
    if (!recipientIds.length) {
      return { created_count: 0 };
    }

    const existing = await this.prisma.userNotification.findMany({
      where: {
        userId: { in: recipientIds },
        familyId: input.family_id,
        notificationType: RECORD_PUBLISHED_NOTIFICATION_TYPE,
        targetType: 'record',
        targetNo: input.record_no,
        deletedAt: null,
      },
      select: { userId: true },
    });
    const existingRecipientIds = new Set(existing.map((item) => item.userId.toString()));
    const now = new Date();
    const recordTitle = input.record_title?.trim() || '未命名记录';
    const rows = recipientIds
      .filter((userId) => !existingRecipientIds.has(userId.toString()))
      .map((userId) => ({
        notificationNo: generateBizNo('msg'),
        userId,
        familyId: input.family_id,
        actorUserId: input.actor_user_id,
        notificationType: RECORD_PUBLISHED_NOTIFICATION_TYPE,
        title: '新的家庭记录',
        body: `${input.actor_nickname} 发布了《${recordTitle}》`,
        targetType: 'record',
        targetNo: input.record_no,
        readAt: userId === input.actor_user_id ? now : null,
      }));

    if (!rows.length) {
      return { created_count: 0 };
    }

    await this.prisma.userNotification.createMany({ data: rows });
    return { created_count: rows.length };
  }

  async listUserNotifications(userId: bigint, pageInput?: number, pageSizeInput?: number) {
    const page = normalizePage(pageInput);
    const pageSize = normalizePageSize(pageSizeInput);
    const where = { userId, deletedAt: null };
    const [total, list] = await this.prisma.$transaction([
      this.prisma.userNotification.count({ where }),
      this.prisma.userNotification.findMany({
        where,
        include: {
          actor: { select: { userNo: true, nickname: true } },
          family: { select: { familyNo: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      list: list.map((item) => this.toNotificationItem(item)),
      page,
      page_size: pageSize,
      total,
      has_more: page * pageSize < total,
    };
  }

  async unreadCount(userId: bigint) {
    const count = await this.prisma.userNotification.count({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
    });

    return { unread_count: count };
  }

  async markNotificationRead(userId: bigint, notificationNo: string) {
    const notification = await this.prisma.userNotification.findFirst({
      where: { userId, notificationNo, deletedAt: null },
      select: { id: true },
    });
    if (!notification) {
      throw new NotFoundException('消息不存在');
    }

    const readAt = new Date();
    await this.prisma.userNotification.update({
      where: { id: notification.id },
      data: { readAt },
    });

    return {
      success: true,
      notification_no: notificationNo,
      read_at: readAt.toISOString(),
    };
  }

  async markAllRead(userId: bigint) {
    const result = await this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
      data: { readAt: new Date() },
    });

    return {
      success: true,
      updated_count: result.count,
    };
  }

  private toNotificationItem(item: NotificationWithRelations) {
    return {
      notification_no: item.notificationNo,
      notification_type: item.notificationType,
      title: item.title,
      body: item.body,
      family_no: item.family.familyNo,
      actor_user_no: item.actor?.userNo ?? null,
      actor_nickname: item.actor?.nickname ?? null,
      target_type: item.targetType,
      target_no: item.targetNo,
      read_at: item.readAt?.toISOString() ?? null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }
}

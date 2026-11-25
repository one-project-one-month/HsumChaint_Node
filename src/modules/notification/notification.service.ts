import type { Prisma } from 'prisma-client';
import { sendPush } from '@/lib/firebase';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import {
  type GetNotificationsQueryInput,
  NOTIFICATION_TYPE,
  resolveNotificationType,
} from './notification.schema';

export const createNotificationService = async (data: {
  userId: number;
  type?: number;
  notificationType?: string | number;
  message: string;
  title?: string;
  fcmToken?: string;
}) => {
  const user = await prisma.user.findFirst({
    where: { id: data.userId, isDeleted: false },
    select: { id: true, fcmToken: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const notificationType =
    data.type ??
    (data.notificationType !== undefined
      ? resolveNotificationType(data.notificationType)
      : NOTIFICATION_TYPE.DonationReminder);

  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: notificationType,
      message: data.message,
      isRead: false,
      isDeleted: false,
    },
  });

  const targetToken = data.fcmToken?.trim() || user.fcmToken;

  if (targetToken) {
    try {
      await sendPush(
        targetToken,
        data.message,
        {
          type: String(notificationType),
          notificationId: String(notification.id),
        },
        data.title ?? 'Notification'
      );
    } catch (error) {
      logger.error(
        { error, userId: data.userId },
        'Push notification failed; in-app notification retained'
      );
    }
  }

  return notification;
};

export const getUserNotificationsService = async (
  userId: number,
  query: GetNotificationsQueryInput
) => {
  const pageNumber = Number(query.pageNumber ?? query.page) || 1;
  const pageSize = Number(query.pageSize ?? query.limit) || 10;
  const skip = (pageNumber - 1) * pageSize;

  const where: Prisma.NotificationWhereInput = {
    userId,
    isDeleted: false,
  };

  if (query.isRead !== undefined) {
    where.isRead = query.isRead;
  }

  if (query.type !== undefined) {
    where.type = query.type;
  }

  const [notifications, totals, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId,
        isDeleted: false,
        isRead: false,
      },
    }),
  ]);

  const totalPages = Math.ceil(totals / pageSize) || 1;
  const pagination = {
    pageNumber,
    pageSize,
    totalCount: totals,
    totalPages,
    hasPreviousPage: pageNumber > 1,
    hasNextPage: pageNumber < totalPages,
  };

  return {
    items: {
      unreadCount,
      items: notifications,
    },
    notifications,
    unreadCount,
    totals,
    pageNumber,
    pageSize,
    pagination,
  };
};

export const markNotificationAsReadService = async (notificationId: number, userId: number) => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId, isDeleted: false },
  });

  if (!existing) {
    throw new AppError('Notification not found', 404);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated;
};

export const deleteNotificationService = async (notificationId: number, userId: number) => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId, isDeleted: false },
  });

  if (!existing) {
    throw new AppError('Notification not found', 404);
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isDeleted: true },
  });

  return { id: existing.id, notificationId: existing.id };
};

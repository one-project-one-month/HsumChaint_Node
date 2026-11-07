import type { Prisma } from 'prisma-client';
import { sendPush } from '@/lib/firebase';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import { type GetNotificationsQueryInput, NOTIFICATION_TYPE } from './notification.schema';

export const createNotificationService = async (data: {
  userId: number;
  type?: number;
  message: string;
  title?: string;
}) => {
  const user = await prisma.user.findFirst({
    where: { id: data.userId, isDeleted: false },
    select: { id: true, fcmToken: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const notificationType = data.type ?? NOTIFICATION_TYPE.DonationReminder;

  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: notificationType,
      message: data.message,
      isRead: false,
      isDeleted: false,
    },
  });

  if (user.fcmToken) {
    try {
      await sendPush(
        user.fcmToken,
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
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

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
      take: limit,
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

  return {
    notifications,
    unreadCount,
    totals,
    pageNumber: page,
    pageSize: limit,
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

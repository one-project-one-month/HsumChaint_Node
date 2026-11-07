import type { NextFunction, Request, Response } from 'express';
import { sendPaginatedResponse, sendSuccessResponse } from '@/utils/response';
import type {
  CreateNotificationInput,
  DeleteNotificationInput,
  GetNotificationsQueryInput,
  MarkNotificationAsReadInput,
} from './notification.schema';
import {
  createNotificationService,
  deleteNotificationService,
  getUserNotificationsService,
  markNotificationAsReadService,
} from './notification.service';

export const createNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUserId = req.user.userId;
    const body = req.body as CreateNotificationInput;
    const targetUserId = body.userId ?? currentUserId;

    const result = await createNotificationService({
      userId: targetUserId,
      type: body.type,
      message: body.message,
      title: body.title,
    });

    return sendSuccessResponse(res, result, 'Notification created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const query = req.query as unknown as GetNotificationsQueryInput;

    const result = await getUserNotificationsService(userId, query);

    const totalPages = Math.ceil(result.totals / result.pageSize) || 1;
    const pagination = {
      pageNumber: result.pageNumber,
      pageSize: result.pageSize,
      totalCount: result.totals,
      totalPages,
      hasPreviousPage: result.pageNumber > 1,
      hasNextPage: result.pageNumber < totalPages,
    };

    const data = {
      unreadCount: result.unreadCount,
      items: result.notifications,
    };

    return sendPaginatedResponse(res, data, pagination, 'Notifications retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as MarkNotificationAsReadInput;
    const targetUserId = body.userId ?? req.user.userId;

    const result = await markNotificationAsReadService(body.notificationId, targetUserId);

    return sendSuccessResponse(res, result, 'Notification marked as read.');
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as DeleteNotificationInput;
    const notificationId = Number(body?.notificationId ?? req.params?.id);
    const targetUserId = body?.userId ?? req.user.userId;

    const result = await deleteNotificationService(notificationId, targetUserId);

    return sendSuccessResponse(res, result, 'Notification deleted successfully.');
  } catch (err) {
    next(err);
  }
};

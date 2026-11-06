import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '@/utils/response';
import type {
  CreateNotificationInput,
  GetNotificationsQueryInput,
  MarkNotificationAsReadInput,
  NotificationIdParamInput,
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

    return successResponse(res, result, 'Notification created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const query = req.query as unknown as GetNotificationsQueryInput;

    const result = await getUserNotificationsService(req, userId, query);

    return successResponse(res, result, 'Notifications retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params as unknown as NotificationIdParamInput;
    const body = req.body as MarkNotificationAsReadInput;

    const result = await markNotificationAsReadService(id, userId, body?.isRead ?? true);

    return successResponse(res, result, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params as unknown as NotificationIdParamInput;

    const result = await deleteNotificationService(id, userId);

    return successResponse(res, result, 'Notification deleted successfully');
  } catch (err) {
    next(err);
  }
};

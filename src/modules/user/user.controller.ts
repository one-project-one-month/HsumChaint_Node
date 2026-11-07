import type { NextFunction, Request, Response } from 'express';
import {
  sendCursorPaginatedResponse,
  sendPaginatedResponse,
  sendSuccessResponse,
} from '@/utils/response';
import { uploadToR2 } from '@/utils/s3Storage';
import type {
  getAllUsersInput,
  idParamsInput,
  updateMonkProfileBodyInput,
  updateUserBodyInput,
  updateUserSettingsBodyInput,
  userFeedPaginationInput,
  userSubResourcePaginationInput,
} from './user.schema';
import {
  clearAllUserNotificationsService,
  deleteMonkProfileService,
  getAllUserService,
  getMeService,
  getMonkProfileService,
  getUserByIdService,
  getUserNotificationsCursorFeedService,
  getUserNotificationsOffsetService,
  getUserReceivedInvitationsFeedService,
  getUserReceivedInvitationsService,
  getUserSentInvitationsFeedService,
  getUserSentInvitationsService,
  getUserSettingsService,
  softDeleteUserService,
  updateMonkProfileService,
  updateUserService,
  updateUserSettingsService,
} from './user.service';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawQuery = (req.query ?? {}) as unknown as getAllUsersInput;
    const result = await getAllUserService(rawQuery);
    return sendPaginatedResponse(res, result.users, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const result = await getMeService(userId);
    return sendSuccessResponse(res, result, 'Success');
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = req.params as unknown as idParamsInput;
    const result = await getUserByIdService(params);
    return sendSuccessResponse(res, result, 'Success');
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetId = req.params.id
      ? Number(req.params.id)
      : Number(req.body?.id) || req.user.userId;
    const body = req.body as updateUserBodyInput;

    if (req.file) {
      const avatarUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
      body.avatar = avatarUrl;
    }

    const result = await updateUserService(targetId, body, req.user.roleId);
    return sendSuccessResponse(res, result, 'User updated successfully.');
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = req.params as unknown as idParamsInput;
    await softDeleteUserService(params);
    return sendSuccessResponse(res, undefined, 'User deleted successfully.');
  } catch (err) {
    next(err);
  }
};

// --- Monk Profile Controllers ---

export const getMonkProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const result = await getMonkProfileService(userId);
    return sendSuccessResponse(res, result, 'Success');
  } catch (err) {
    next(err);
  }
};

export const updateMonkProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const body = req.body as updateMonkProfileBodyInput;
    const result = await updateMonkProfileService(userId, body);
    return sendSuccessResponse(res, result, 'Monk profile updated successfully.');
  } catch (err) {
    next(err);
  }
};

export const deleteMonkProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    await deleteMonkProfileService(userId);
    return sendSuccessResponse(res, undefined, 'Monk profile deleted successfully.');
  } catch (err) {
    next(err);
  }
};

// --- Invitations Sub-Resource Controllers ---

export const getUserReceivedInvitations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.params.id);
    const query = req.query as unknown as userSubResourcePaginationInput;
    const result = await getUserReceivedInvitationsService(userId, query);
    return sendPaginatedResponse(res, result.items, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

export const getUserReceivedInvitationsFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.params.id);
    const query = req.query as unknown as userFeedPaginationInput;
    const result = await getUserReceivedInvitationsFeedService(userId, query);
    return sendCursorPaginatedResponse(res, result.items, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

export const getUserSentInvitations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const query = req.query as unknown as userSubResourcePaginationInput;
    const result = await getUserSentInvitationsService(userId, query);
    return sendPaginatedResponse(res, result.items, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

export const getUserSentInvitationsFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.params.id);
    const query = req.query as unknown as userFeedPaginationInput;
    const result = await getUserSentInvitationsFeedService(userId, query);
    return sendCursorPaginatedResponse(res, result.items, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

// --- Notification Sub-Resource Controllers ---

export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const query = req.query as unknown as userSubResourcePaginationInput;
    const result = await getUserNotificationsOffsetService(userId, query);
    return sendPaginatedResponse(res, result.items, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

export const getUserNotificationsFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const query = req.query as unknown as userFeedPaginationInput;
    const result = await getUserNotificationsCursorFeedService(userId, query);
    return sendCursorPaginatedResponse(res, result.items, result.pagination, 'Success');
  } catch (err) {
    next(err);
  }
};

export const clearAllUserNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = Number(req.params.id);
    await clearAllUserNotificationsService(userId);
    return sendSuccessResponse(res, undefined, 'Notifications cleared successfully.');
  } catch (err) {
    next(err);
  }
};

// --- Settings Sub-Resource Controllers ---

export const getUserSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const result = await getUserSettingsService(userId);
    return sendSuccessResponse(res, result, 'Success');
  } catch (err) {
    next(err);
  }
};

export const updateUserSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.id);
    const body = req.body as updateUserSettingsBodyInput;
    const result = await updateUserSettingsService(userId, body);
    return sendSuccessResponse(res, result, 'Settings updated successfully.');
  } catch (err) {
    next(err);
  }
};

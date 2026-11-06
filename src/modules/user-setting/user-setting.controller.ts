import type { NextFunction, Request, Response } from 'express';
import { successResponse } from '@/utils/response';
import type { UpdateUserSettingBodyInput } from './user-setting.schema';
import { getUserSettingService, updateUserSettingService } from './user-setting.service';

export const getSettingByUserId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const result = await getUserSettingService(userId);
    return successResponse(res, result, 'User settings');
  } catch (err) {
    next(err);
  }
};

export const updateSettingByUserId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const body = req.body as UpdateUserSettingBodyInput;
    const result = await updateUserSettingService(userId, body);
    return successResponse(res, result, 'Settings updated');
  } catch (err) {
    next(err);
  }
};

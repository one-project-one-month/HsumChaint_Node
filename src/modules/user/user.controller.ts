import type { NextFunction, Request, Response } from 'express';
import { generatePaginationData } from '@/helper/paginationHelper';
import { successResponse } from '@/utils/response';
import { uploadToR2 } from '@/utils/s3Storage';
import type { getAllUsersInput, idParamsInput, updateUserBodyInput } from './user.schema';
import {
  getAllUserService,
  getMeService,
  getUserByIdService,
  softDeleteUserService,
  updateUserService,
} from './user.service';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawQuery = req.query as Record<string, string>;
    const page = Number(rawQuery.page) || 1;
    const limit = Number(rawQuery.limit) || 10;

    // Create a clean object for the service
    const queryData: getAllUsersInput = {
      ...rawQuery,
      page,
      limit,
    };
    const { users, totals } = await getAllUserService(queryData);

    // 4. Generate pagination
    const paginationData = generatePaginationData(req, totals, page, limit);

    return successResponse(res, { users, paginationData }, 'All Users are Retrieved Successfully');
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const result = await getMeService(userId);
    return successResponse(res, result, 'Current user retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = req.params as unknown as idParamsInput;
    const result = await getUserByIdService(params);
    return successResponse(res, result, 'User retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as unknown as idParamsInput;
    const body = req.body as updateUserBodyInput;

    if (req.file) {
      const avatarUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
      body.avatar = avatarUrl;
    }

    const result = await updateUserService(id, body);
    return successResponse(res, result, 'User updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = req.params as unknown as idParamsInput;
    const deletedUser = await softDeleteUserService(params);
    const { id, username } = deletedUser;

    return successResponse(
      res,
      { id, username },
      `User Account: ${username} has been deleted successfully`
    );
  } catch (err) {
    next(err);
  }
};

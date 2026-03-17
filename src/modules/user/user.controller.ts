import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { successResponse } from '../../utils/response';
import { CreateUserSchema } from './user.schema';
import { userService } from './user.service';

export class UserController {
  async getAllUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.getAllUsers();
      successResponse(res, users, 'Users retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(Number(id));
      if (!user) {
        throw new AppError('User not found', 404);
      }
      successResponse(res, user, 'User retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = CreateUserSchema.parse(req.body);
      const user = await userService.createUser(validatedData);
      successResponse(res, user, 'User created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await userService.deleteUser(Number(id));
      successResponse(res, null, 'User deleted successfully', 204);
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();

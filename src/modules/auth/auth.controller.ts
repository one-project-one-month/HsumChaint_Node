import { successResponse } from '@/utils/response';
import type { NextFunction, Request, Response } from 'express';
import type { LoginInput, RegisterInput } from './auth.schema';
import { loginUser, registerUser } from './auth.service';
export const register = async (
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await registerUser(req.body);
    return successResponse(res, user, 'Register successful');
  } catch (error) {
    next(error);
  }
};
export const login = async (
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await loginUser(req.body);
    return successResponse(res, user, 'Login successful');
  } catch (error) {
    next(error);
  }
};

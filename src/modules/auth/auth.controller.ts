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
    const result = await loginUser(req.body);
    await res.setHeader('Authorization', `Bearer ${result.accessToken}`);
    return successResponse(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

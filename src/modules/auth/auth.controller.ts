import { Request, Response, NextFunction } from 'express';
import { RegisterInput } from './auth.schema';
import { registerUser } from './auth.service';
import { successResponse } from '@/utils/response';
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

import { Request, Response, NextFunction } from 'express';
import { registerSchema } from './auth.schema';
import { registerUser } from './auth.service';
import { successResponse } from '@/utils/response';
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await registerUser(data);
    return successResponse(res, user, 'Register successful');
  } catch (error) {
    next(error);
  }
};

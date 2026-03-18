import { env } from '@/config/env';
import { AppError } from '@/utils/AppError';
import type { TokenPayload } from '@/utils/jwt';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized', 401));
  }
  const accessToken = authorization.split(' ')[1];
  try {
    const user = jwt.verify(accessToken, env.JWT_ACCESS_TOKEN_SECRET) as TokenPayload;
    if (!user.userId || !user.userType) {
      return next(new AppError('Invalid token payload', 401));
    }
    req.user = user;
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

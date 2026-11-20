import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '@/utils/AppError';
import type { TokenPayload } from '@/utils/jwt';
export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  const { authorization } = req.headers;
  if (!authorization?.startsWith('Bearer ')) {
    if (req.user?.userId && req.user?.roleId) {
      return next();
    }
    return next(new AppError('Unauthorized', 401));
  }
  const accessToken = authorization.split(' ')[1];
  try {
    const user = jwt.verify(accessToken, env.JWT_ACCESS_TOKEN_SECRET) as TokenPayload & {
      userType?: string;
    };
    // Keep signed sessions issued before the role migration usable until expiry.
    if (user.roleId === undefined) {
      if (user.userType === 'Monk') user.roleId = 1;
      if (user.userType === 'Donor') user.roleId = 2;
    }
    if (!user.userId || !user.roleId) {
      return next(new AppError('Invalid token payload', 401));
    }
    req.user = user;
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

export const authMiddleWare = authMiddleware;

import { AppError } from '@/utils/AppError';
import { successResponse } from '@/utils/response';
import type { NextFunction, Request, Response } from 'express';
import type { LoginInput, RegisterInput } from './auth.schema';
import { loginUser, refreshTokenService, registerUser } from './auth.service';
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
    const { user, accessToken, refreshToken } = await loginUser(req.body);
    //set refresh token in cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader('Authorization', `Bearer ${accessToken}`);
    //return only accessToken + user
    return successResponse(res, { accessToken, user }, 'Login successful');
  } catch (error) {
    next(error);
  }
};
export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh token missing', 401);
    }
    const result = await refreshTokenService(refreshToken);
    return successResponse(res, result, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

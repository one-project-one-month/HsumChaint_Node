import { AppError } from '@/utils/AppError';
import { successResponse } from '@/utils/response';
import type { NextFunction, Request, Response } from 'express';
import type { LoginInput, RegisterInput } from './auth.schema';
import { loginUser, logoutUser, refreshTokenService, registerUser } from './auth.service';
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
    //update cookie with new refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return successResponse(res, { accessToken: result.accessToken }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh Token is missing', 401);
    }
    await logoutUser(refreshToken);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return successResponse(res, null, 'Logout successfully');
  } catch (error) {
    next(error);
  }
};

import { AppError } from '@/utils/AppError';
import { successResponse } from '@/utils/response';
import type { NextFunction, Request, Response } from 'express';
import type {
  LoginInput,
  RegisterInput,
  forgotPasswordInput,
  resetPasswordInput,
} from './auth.schema';
import {
  forgotPasswordService,
  loginUser,
  logoutUser,
  refreshTokenService,
  registerUser,
  resetPasswordService,
} from './auth.service';
export const register = async (
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await registerUser(req.body);
    //set refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader('Authorization', `Bearer ${result.accessToken}`);
    return successResponse(res, result, 'Register successful');
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
    //set refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader('Authorization', `Bearer ${result.accessToken}`);
    //return only accessToken + user
    return successResponse(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};
export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
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
    return successResponse(res, result, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
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
export const forgotPassword = async (
  req: Request<unknown, unknown, forgotPasswordInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await forgotPasswordService(req.body.phone);
    return successResponse(res, result, 'Reset Token generated successfully');
  } catch (error) {
    next(error);
  }
};
export const resetPassword = async (
  req: Request<unknown, unknown, resetPasswordInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await resetPasswordService(req.body);
    return successResponse(res, result, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};

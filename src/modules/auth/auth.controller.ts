import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/AppError';
import { sendSuccessResponse } from '@/utils/response';
import type {
  forgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  RegisterInput,
  resetPasswordInput,
} from './auth.schema';
import {
  forgotPasswordService,
  getLoginModeService,
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
    // set refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader('Authorization', `Bearer ${result.accessToken}`);
    return sendSuccessResponse(res, undefined, 'Register Successful', 200);
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
    // set refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader('Authorization', `Bearer ${result.accessToken}`);
    return sendSuccessResponse(res, result, 'Login Successful');
  } catch (error) {
    next(error);
  }
};

export const refreshAccessToken = async (
  req: Request<unknown, unknown, RefreshTokenInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    // When body refreshToken is provided, prioritize it over cookies
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Invalid or expired Refresh Token', 400);
    }
    const expectedUserId = req.body?.userId ? Number(req.body.userId) : undefined;
    const result = await refreshTokenService(refreshToken, expectedUserId);
    // update cookie with new refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return sendSuccessResponse(res, result, 'Successful');
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request<unknown, unknown, LogoutInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh Token is missing', 401);
    }
    await logoutUser(refreshToken);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return sendSuccessResponse(res, undefined, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

export const getLoginMode = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getLoginModeService();
    return sendSuccessResponse(res, result, 'Success');
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
    return sendSuccessResponse(res, result, 'Password reset email sent');
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
    await resetPasswordService(req.body);
    return sendSuccessResponse(res, undefined, 'Password successfully reset');
  } catch (error) {
    next(error);
  }
};

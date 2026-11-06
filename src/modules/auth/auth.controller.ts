import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/AppError';
import { successResponse } from '@/utils/response';
import type {
  forgotPasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
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
    // set refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.setHeader('Authorization', `Bearer ${result.token}`);
    return successResponse(res, result, 'User registered successfully.', 201);
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
    res.setHeader('Authorization', `Bearer ${result.token}`);
    return successResponse(res, result, 'Login successful.');
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
    const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh token missing', 401);
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
    return successResponse(res, result, 'Token refreshed successfully.');
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      throw new AppError('Refresh Token is missing', 401);
    }
    await logoutUser(refreshToken);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return successResponse(res, null, 'Logged out successfully.');
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
    return successResponse(
      res,
      { resetToken: result.resetToken },
      'Password reset token generated successfully.'
    );
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
    return successResponse(res, null, 'Password reset successfully.');
  } catch (error) {
    next(error);
  }
};

import { successResponse } from '@/utils/response';
import type { NextFunction, Request, Response } from 'express';
import type {
  LoginInput,
  RegisterInput,
  forgotPasswordInput,
  refreshTokenInput,
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
    return successResponse(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};
export const refreshAccessToken = async (
  req: Request<unknown, unknown, refreshTokenInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await refreshTokenService(req.body.refreshToken);
    return successResponse(res, result, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};
export const logout = async (
  req: Request<unknown, unknown, refreshTokenInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await logoutUser(req.body.refreshToken);
    return successResponse(res, result, 'Logout successfully');
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

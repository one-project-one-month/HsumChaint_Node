import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/utils/AppError';
import { sendSuccessResponse } from '@/utils/response';
import {
  changePasswordService,
  forgotPasswordService,
  getLoginModeService,
  loginUser,
  logoutUser,
  refreshTokenService,
  registerUser,
  requestChangePasswordOtpService,
  requestRegistrationOtpService,
  resetPasswordService,
} from './auth.service';
import {
  type OtpChannel,
  type OtpPurpose,
  requestOtpService,
  verifyOtpService,
} from './otp.service';

// 1. Register User (with Atomic Verification & Auto-Login)
export const register = async (req: Request, res: Response, next: NextFunction) => {
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
    return sendSuccessResponse(res, result, 'Register Successful', 200);
  } catch (error) {
    next(error);
  }
};

// 1.1 Request Registration OTP
export const requestRegistrationOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await requestRegistrationOtpService(req.body);
    return sendSuccessResponse(res, result, 'OTP has been sent.', 200);
  } catch (error) {
    next(error);
  }
};

// 2. Login
export const login = async (req: Request, res: Response, next: NextFunction) => {
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

// 2.1 Get Active Login Mode Configuration
export const getLoginMode = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getLoginModeService();
    return sendSuccessResponse(res, result, 'Success');
  } catch (error) {
    next(error);
  }
};

// 3. Refresh Token
export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
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

// Logout
export const logout = async (req: Request, res: Response, next: NextFunction) => {
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

// 3.1 Forgot Password (Request Reset OTP)
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await forgotPasswordService(req.body);
    return sendSuccessResponse(res, result, 'OTP has been sent.');
  } catch (error) {
    next(error);
  }
};

// 3.2 Reset Password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await resetPasswordService(req.body);
    return sendSuccessResponse(res, undefined, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};

// 3.3 Request Change Password OTP
export const requestChangePasswordOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.userId);
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }
    const result = await requestChangePasswordOtpService(userId);
    return sendSuccessResponse(res, result, 'OTP has been sent.');
  } catch (error) {
    next(error);
  }
};

// 3.4 Change Password
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.user?.userId);
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }
    await changePasswordService(userId, req.body);
    return sendSuccessResponse(res, undefined, 'Password changed successfully.');
  } catch (error) {
    next(error);
  }
};

// 3.5 Standalone OTP Endpoints
export const requestOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await requestOtpService({
      destination: req.body.destination,
      channel: req.body.channel as OtpChannel,
      purpose: req.body.purpose as OtpPurpose,
    });
    return sendSuccessResponse(res, result, 'OTP requested successfully.');
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await verifyOtpService({
      destination: req.body.destination,
      channel: req.body.channel as OtpChannel,
      purpose: req.body.purpose as OtpPurpose,
      code: req.body.code,
    });
    return sendSuccessResponse(res, result, 'OTP verified successfully.');
  } catch (error) {
    next(error);
  }
};

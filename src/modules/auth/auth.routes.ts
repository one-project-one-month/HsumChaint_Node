import { type NextFunction, type Request, type Response, Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { validator } from '@/middlewares/validator';
import {
  changePassword,
  forgotPassword,
  getLoginMode,
  login,
  logout,
  refreshAccessToken,
  register,
  requestChangePasswordOtp,
  requestOtp,
  requestRegistrationOtp,
  resetPassword,
  verifyOtp,
} from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  requestOtpSchema,
  requestRegistrationOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './auth.schema';

const router = Router();

// Intercept attempts to register as a protected role (e.g., Admin roleId: 1 in .NET C# spec) with 403 Forbidden
const checkProtectedRole = (req: Request, res: Response, next: NextFunction) => {
  const roleId = Number(req.body?.roleId);
  if (roleId === 1) {
    return res.status(403).json({
      isSuccess: false,
      message: 'Forbidden',
      isFailure: true,
    });
  }
  next();
};

// 1. Register User (with Atomic Verification & Auto-Login)
router.post('/register', checkProtectedRole, validator(registerSchema), register);

// 1.1 Request Registration OTP
router.post(
  '/register/request-otp',
  validator(requestRegistrationOtpSchema),
  requestRegistrationOtp
);

// 2. Login
router.post('/login', validator(loginSchema), login);

// 2.1 Get Active Login Mode Configuration
router.get('/login-mode', getLoginMode);

// 3. Refresh Token & Logout
router.post('/refresh-token', validator(refreshTokenSchema), refreshAccessToken);
router.post('/logout', validator(logoutSchema), logout);

// 3.1 Forgot Password (Request Reset OTP)
router.post('/forgot-password', validator(forgotPasswordSchema), forgotPassword);

// 3.2 Reset Password
router.post('/reset-password', validator(resetPasswordSchema), resetPassword);

// 3.3 Request Change Password OTP (Authenticated)
router.post('/change-password/request-otp', authMiddleware, requestChangePasswordOtp);

// 3.4 Change Password (Authenticated)
router.post('/change-password', authMiddleware, validator(changePasswordSchema), changePassword);

// 3.5 Standalone OTP Endpoints
router.post('/otp/request', validator(requestOtpSchema), requestOtp);
router.post('/otp/verify', validator(verifyOtpSchema), verifyOtp);

export default router;

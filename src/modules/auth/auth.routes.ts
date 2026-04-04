import { validator } from '@/middlewares/validator';
import { Router } from 'express';
import {
  forgotPassword,
  login,
  logout,
  refreshAccessToken,
  register,
  resetPassword,
} from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema';
const router = Router();
router.post('/register', validator(registerSchema), register);
router.post('/login', validator(loginSchema), login);
router.post('/refresh-token', validator(refreshTokenSchema), refreshAccessToken);
router.post('/logout', validator(refreshTokenSchema), logout);
router.post('/forgot-password', validator(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validator(resetPasswordSchema), resetPassword);
export default router;

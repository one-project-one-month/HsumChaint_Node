import { type NextFunction, type Request, type Response, Router } from 'express';
import { validator } from '@/middlewares/validator';
import {
  forgotPassword,
  getLoginMode,
  login,
  logout,
  refreshAccessToken,
  register,
  resetPassword,
} from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema';

const router = Router();

// Intercept attempts to register as a protected role (e.g., Admin roleId: 3) with 403 Forbidden
const checkProtectedRole = (req: Request, res: Response, next: NextFunction) => {
  const roleId = Number(req.body?.roleId);
  if (roleId === 3) {
    return res.status(403).json({
      isSuccess: false,
      message: 'Forbidden',
      isFailure: true,
    });
  }
  next();
};

router.post('/register', checkProtectedRole, validator(registerSchema), register);
router.get('/login-mode', getLoginMode);
router.post('/login', validator(loginSchema), login);
router.post('/refresh-token', validator(refreshTokenSchema), refreshAccessToken);
router.post('/logout', validator(logoutSchema), logout);
router.post('/forgot-password', validator(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validator(resetPasswordSchema), resetPassword);

export default router;

import { validator } from '@/middlewares/validator';
import { Router } from 'express';
import { login, refreshAccessToken, register } from './auth.controller';
import { loginSchema, refreshTokenSchema, registerSchema } from './auth.schema';
const router = Router();
router.post('/register', validator(registerSchema), register);
router.post('/login', validator(loginSchema), login);
router.post('/refresh-token', validator(refreshTokenSchema), refreshAccessToken);
export default router;

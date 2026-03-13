import { Router } from 'express';
import { register } from './auth.controller';
import { validator } from '@/middlewares/validator';
import { registerSchema } from './auth.schema';
const router = Router();
router.post('/register', validator(registerSchema), register);
export default router;

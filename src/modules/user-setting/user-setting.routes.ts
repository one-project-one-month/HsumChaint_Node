import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { validator } from '@/middlewares/validator';
import { getSettingByUserId, updateSettingByUserId } from './user-setting.controller';
import { updateUserSettingSchema } from './user-setting.schema';

const router = Router();
router.use(authMiddleware);

router.get('/me', getSettingByUserId);
router.put('/me', validator(updateUserSettingSchema), updateSettingByUserId);

export { router as userSettingRouter };

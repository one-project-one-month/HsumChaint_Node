import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { validator } from '@/middlewares/validator';
import {
  createNotification,
  deleteNotification,
  getUserNotifications,
  markNotificationAsRead,
} from './notification.controller';
import {
  createNotificationSchema,
  getNotificationsSchema,
  markNotificationAsReadSchema,
  notificationIdParamSchema,
} from './notification.schema';

const router = Router();
router.use(authMiddleware);

router.post('/create', validator(createNotificationSchema), createNotification);
router.get('/', validator(getNotificationsSchema), getUserNotifications);
router.put('/:id', validator(markNotificationAsReadSchema), markNotificationAsRead);
router.delete('/:id', validator(notificationIdParamSchema), deleteNotification);

export { router as notificationRouter };

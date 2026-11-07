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
  deleteNotificationSchema,
  getNotificationsSchema,
  markNotificationAsReadSchema,
} from './notification.schema';

const router = Router();
router.use(authMiddleware);

router.post('/create', validator(createNotificationSchema), createNotification);
router.get('/', validator(getNotificationsSchema), getUserNotifications);
router.patch('/read-noti', validator(markNotificationAsReadSchema), markNotificationAsRead);
router.delete('/delete', validator(deleteNotificationSchema), deleteNotification);
router.delete('/:id', validator(deleteNotificationSchema), deleteNotification);

export { router as notificationRouter };

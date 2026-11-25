import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission } from '@/middlewares/permissionMiddleware';
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

// 41. Create and Send Push Notification (Target: Internal System Service, System Admin)
router.post(
  '/create',
  checkPermission('Notification.Manage'),
  validator(createNotificationSchema),
  createNotification
);

// 4.5. List User Notifications (Target: Recipient User)
router.get('/', validator(getNotificationsSchema), getUserNotifications);

// 42. Mark Notification as Read (Target: Notification Recipient User)
router.patch('/read-noti', validator(markNotificationAsReadSchema), markNotificationAsRead);

// 43. Soft Delete Single Notification (Target: Notification Recipient User)
router.delete('/delete', validator(deleteNotificationSchema), deleteNotification);

export { router as notificationRouter };

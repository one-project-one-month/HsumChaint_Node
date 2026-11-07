import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission, checkSelfOrPermission } from '@/middlewares/permissionMiddleware';
import { upload } from '@/middlewares/upload.Middleware';
import { validator } from '@/middlewares/validator';
import {
  clearAllUserNotifications,
  deleteMonkProfile,
  deleteUser,
  getAllUsers,
  getMe,
  getMonkProfile,
  getUserById,
  getUserNotifications,
  getUserNotificationsFeed,
  getUserReceivedInvitations,
  getUserReceivedInvitationsFeed,
  getUserSentInvitations,
  getUserSentInvitationsFeed,
  getUserSettings,
  updateMonkProfile,
  updateUser,
  updateUserSettings,
} from './user.controller';
import {
  getAllUsersSchema,
  idParamSchema,
  updateMonkProfileSchema,
  updateUserSchema,
  updateUserSettingsSchema,
  userFeedPaginationSchema,
  userSubResourcePaginationSchema,
} from './user.schema';

const router = Router();
router.use(authMiddleware);

// --- Core User Routes ---
router.get('/', validator(getAllUsersSchema), checkPermission('User.View'), getAllUsers);
router.get('/me', getMe);
router.get('/:id', validator(idParamSchema), checkSelfOrPermission('User.View'), getUserById);

// Supports both PUT / (body id) and PUT /:id (url param id)
router.put(
  '/',
  upload.single('avatar'),
  validator(updateUserSchema),
  checkSelfOrPermission('User.Update'),
  updateUser
);
router.put(
  '/:id',
  upload.single('avatar'),
  validator(updateUserSchema),
  checkSelfOrPermission('User.Update'),
  updateUser
);

router.delete('/:id', validator(idParamSchema), checkSelfOrPermission('User.Delete'), deleteUser);

// --- Monk Profile Sub-Resource ---
router.get(
  '/:id/monk-profile',
  validator(idParamSchema),
  checkSelfOrPermission('User.View'),
  getMonkProfile
);
router.patch(
  '/:id/monk-profile',
  validator(updateMonkProfileSchema),
  checkSelfOrPermission('User.Update'),
  updateMonkProfile
);
router.put(
  '/:id/monk-profile',
  validator(updateMonkProfileSchema),
  checkSelfOrPermission('User.Update'),
  updateMonkProfile
);
router.delete(
  '/:id/monk-profile',
  validator(idParamSchema),
  checkSelfOrPermission('User.Manage'),
  deleteMonkProfile
);

// --- Invitations Sub-Resource ---
router.get(
  '/:id/invitations',
  validator(userSubResourcePaginationSchema),
  checkSelfOrPermission('Invitation.View'),
  getUserReceivedInvitations
);
router.get(
  '/:id/invitations/feed',
  validator(userFeedPaginationSchema),
  checkSelfOrPermission('Invitation.View'),
  getUserReceivedInvitationsFeed
);
router.get(
  '/:id/invited-by-list',
  validator(userSubResourcePaginationSchema),
  checkSelfOrPermission('Invitation.View'),
  getUserSentInvitations
);
router.get(
  '/:id/invited-by-list/feed',
  validator(userFeedPaginationSchema),
  checkSelfOrPermission('Invitation.View'),
  getUserSentInvitationsFeed
);

// --- Notifications Sub-Resource ---
router.get(
  '/:id/notification',
  validator(userSubResourcePaginationSchema),
  checkSelfOrPermission('Notification.View'),
  getUserNotifications
);
router.get(
  '/:id/notification/feed',
  validator(userFeedPaginationSchema),
  checkSelfOrPermission('Notification.View'),
  getUserNotificationsFeed
);
router.delete(
  '/:id/notification',
  validator(idParamSchema),
  checkSelfOrPermission('Notification.Manage'),
  clearAllUserNotifications
);

// --- Settings Sub-Resource ---
router.get(
  '/:id/settings',
  validator(idParamSchema),
  checkSelfOrPermission('User.View'),
  getUserSettings
);
router.put(
  '/:id/settings',
  validator(updateUserSettingsSchema),
  checkSelfOrPermission('User.Update'),
  updateUserSettings
);

export { router as userRouter };

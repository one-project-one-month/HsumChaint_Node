import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import { getPermissions } from './permission.controller';
import { getPermissionsQuerySchema } from './permission.schema';

const router = Router();

// Require authentication for all permission routes
router.use(authMiddleware);

/**
 * 49. List All System Permissions
 * GET /api/v1/permissions
 * Required Permission: Roles.View
 * Target: System Admin
 */
router.get(
  '/',
  checkPermission('Roles.View'),
  validator(getPermissionsQuerySchema),
  getPermissions
);

export { router as permissionRouter };
export default router;

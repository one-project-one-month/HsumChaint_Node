import { Router } from 'express';
import { authMiddleWare } from '@/middlewares/authMiddleWare';
import { checkPermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import { getPermissions } from './permission.controller';
import { getPermissionsQuerySchema } from './permission.schema';

const permissionRouter = Router();

// Require authentication for all permission routes
permissionRouter.use(authMiddleWare);

/**
 * 49. List All System Permissions
 * GET /api/v1/permissions
 * Required Permission: Roles.View
 * Target: System Admin
 */
permissionRouter.get(
  '/',
  checkPermission('Roles.View'),
  validator(getPermissionsQuerySchema),
  getPermissions
);

export default permissionRouter;

import { Router } from 'express';
import { authMiddleWare } from '@/middlewares/authMiddleWare';
import { validator } from '@/middlewares/validator';
import { getSpacePermissions } from './space-permission.controller';
import { getSpacePermissionsQuerySchema } from './space-permission.schema';

const spacePermissionRouter = Router();

// Require authentication for all space-permission routes
spacePermissionRouter.use(authMiddleWare);

/**
 * 57. List All Space Permissions
 * GET /api/v1/space-permissions
 * Required Permission: Authenticated
 * Target: All Authenticated Users
 */
spacePermissionRouter.get('/', validator(getSpacePermissionsQuerySchema), getSpacePermissions);

export default spacePermissionRouter;

import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { validator } from '@/middlewares/validator';
import { getSpacePermissions } from './space-permission.controller';
import { getSpacePermissionsQuerySchema } from './space-permission.schema';

const router = Router();

// Require authentication for all space-permission routes
router.use(authMiddleware);

/**
 * 57. List All Space Permissions
 * GET /api/v1/space-permissions
 * Required Permission: Authenticated
 * Target: All Authenticated Users
 */
router.get('/', validator(getSpacePermissionsQuerySchema), getSpacePermissions);

export { router as spacePermissionRouter };
export default router;

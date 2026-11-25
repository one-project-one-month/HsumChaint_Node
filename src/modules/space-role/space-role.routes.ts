import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import {
  assignSpacePermissions,
  createSpaceRole,
  deleteSpaceRole,
  getSpaceRoleById,
  getSpaceRoles,
  updateSpaceRole,
} from './space-role.controller';
import {
  assignSpacePermissionsSchema,
  createSpaceRoleSchema,
  deleteSpaceRoleSchema,
  getSpaceRolesQuerySchema,
  spaceRoleIdParamSchema,
  updateSpaceRoleSchema,
} from './space-role.schema';

const router = Router();

// Require authentication for all space-roles routes
router.use(authMiddleware);

/**
 * 51. Get Space Roles
 * GET /api/v1/space-roles
 * Target: Space Managers, System Admin
 * Permission: Authenticated
 */
router.get('/', validator(getSpaceRolesQuerySchema), getSpaceRoles);

/**
 * 56. Assign Permissions to Space Role
 * POST /api/v1/space-roles/assign-permissions
 * Target: System Admin
 * Permission: Roles.Assign
 */
router.post(
  '/assign-permissions',
  checkPermission('Roles.Assign'),
  validator(assignSpacePermissionsSchema),
  assignSpacePermissions
);

/**
 * 53. Create Custom Space Role
 * POST /api/v1/space-roles
 * Target: System Admin
 * Permission: Roles.Manage
 */
router.post(
  '/',
  checkPermission('Roles.Manage'),
  validator(createSpaceRoleSchema),
  createSpaceRole
);

/**
 * 52. Get Space Role by ID
 * GET /api/v1/space-roles/{id}
 * Target: Space Managers, System Admin
 * Permission: Authenticated
 */
router.get('/:id', validator(spaceRoleIdParamSchema), getSpaceRoleById);

/**
 * 54. Update Space Role
 * PUT /api/v1/space-roles/{id}
 * Target: System Admin
 * Permission: Roles.Manage
 */
router.put(
  '/:id',
  checkPermission('Roles.Manage'),
  validator(updateSpaceRoleSchema),
  updateSpaceRole
);

/**
 * 55. Delete Space Role
 * DELETE /api/v1/space-roles/{id}
 * Target: System Admin
 * Permission: Roles.Manage
 */
router.delete(
  '/:id',
  checkPermission('Roles.Manage'),
  validator(deleteSpaceRoleSchema),
  deleteSpaceRole
);

export { router as spaceRoleRouter };
export default router;

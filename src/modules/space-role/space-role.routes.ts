import { Router } from 'express';
import { authMiddleWare } from '@/middlewares/authMiddleWare';
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

const spaceRoleRouter = Router();

// Require authentication for all space-roles routes
spaceRoleRouter.use(authMiddleWare);

/**
 * 51. Get Space Roles
 * GET /api/v1/space-roles
 * Target: Space Managers, System Admin
 * Permission: Authenticated
 */
spaceRoleRouter.get('/', validator(getSpaceRolesQuerySchema), getSpaceRoles);

/**
 * 56. Assign Permissions to Space Role
 * POST /api/v1/space-roles/assign-permissions
 * Target: System Admin
 * Permission: Roles.Assign
 */
spaceRoleRouter.post(
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
spaceRoleRouter.post(
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
spaceRoleRouter.get('/:id', validator(spaceRoleIdParamSchema), getSpaceRoleById);

/**
 * 54. Update Space Role
 * PUT /api/v1/space-roles/{id}
 * Target: System Admin
 * Permission: Roles.Manage
 */
spaceRoleRouter.put(
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
spaceRoleRouter.delete(
  '/:id',
  checkPermission('Roles.Manage'),
  validator(deleteSpaceRoleSchema),
  deleteSpaceRole
);

export default spaceRoleRouter;

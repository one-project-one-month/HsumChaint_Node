import { Router } from 'express';
import { authMiddleWare } from '@/middlewares/authMiddleWare';
import { checkPermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import {
  assignPermissions,
  createRole,
  deleteRole,
  getMyPermissions,
  getRoleById,
  getRoles,
  getUserPermissions,
  updateRole,
} from './role.controller';
import {
  assignPermissionsSchema,
  createRoleSchema,
  deleteRoleSchema,
  getRolesQuerySchema,
  roleIdParamSchema,
  updateRoleSchema,
} from './role.schema';

const roleRouter = Router();

// Require authentication for all role routes
roleRouter.use(authMiddleWare);

// 44. Get System Roles: GET /api/v1/roles
roleRouter.get('/', checkPermission('Roles.View'), validator(getRolesQuerySchema), getRoles);

// 50. Assign Permissions to Role: POST /api/v1/roles/assign-permissions
// (also supports legacy /assign alias for backward compatibility)
roleRouter.post(
  '/assign-permissions',
  checkPermission('Roles.Assign'),
  validator(assignPermissionsSchema),
  assignPermissions
);
roleRouter.post(
  '/assign',
  checkPermission('Roles.Assign'),
  validator(assignPermissionsSchema),
  assignPermissions
);

// User-specific permission helpers
roleRouter.get('/me/permissions', getMyPermissions);
roleRouter.get('/users/:userId/permissions', checkPermission('Roles.View'), getUserPermissions);

// 46. Create System Role: POST /api/v1/roles
roleRouter.post('/', checkPermission('Roles.Manage'), validator(createRoleSchema), createRole);

// 45. Get System Role by ID: GET /api/v1/roles/:id
roleRouter.get('/:id', checkPermission('Roles.View'), validator(roleIdParamSchema), getRoleById);

// 47. Update System Role: PUT /api/v1/roles/:id
roleRouter.put('/:id', checkPermission('Roles.Manage'), validator(updateRoleSchema), updateRole);

// 48. Delete System Role: DELETE /api/v1/roles/:id
roleRouter.delete('/:id', checkPermission('Roles.Manage'), validator(deleteRoleSchema), deleteRole);

// Re-export permissionRouter for backwards compatibility
export { default as permissionRouter } from '../permission/permission.routes';

export default roleRouter;

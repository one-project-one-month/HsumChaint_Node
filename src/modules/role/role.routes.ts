import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import {
  assignPermissions,
  createRole,
  deleteRole,
  getMyPermissions,
  getPermissions,
  getRoleById,
  getRoles,
  getUserPermissions,
  updateRole,
} from './role.controller';
import {
  assignPermissionsSchema,
  createRoleSchema,
  deleteRoleSchema,
  getPermissionsQuerySchema,
  getRolesQuerySchema,
  roleIdParamSchema,
  updateRoleSchema,
} from './role.schema';

const router = Router();

// Require authentication for all role routes
router.use(authMiddleware);

// 44. Get System Roles: GET /api/v1/roles
router.get('/', checkPermission('Roles.View'), validator(getRolesQuerySchema), getRoles);

// 50. Assign Permissions to Role: POST /api/v1/roles/assign-permissions
// (also supports legacy /assign alias for backward compatibility)
router.post(
  '/assign-permissions',
  checkPermission('Roles.Assign'),
  validator(assignPermissionsSchema),
  assignPermissions
);
router.post(
  '/assign',
  checkPermission('Roles.Assign'),
  validator(assignPermissionsSchema),
  assignPermissions
);

// User-specific permission helpers
router.get('/me/permissions', getMyPermissions);
router.get('/users/:userId/permissions', checkPermission('Roles.View'), getUserPermissions);

// 46. Create System Role: POST /api/v1/roles
router.post('/', checkPermission('Roles.Manage'), validator(createRoleSchema), createRole);

router.get(
  '/permissions',
  checkPermission('Roles.View'),
  validator(getPermissionsQuerySchema),
  getPermissions
);

// 45. Get System Role by ID: GET /api/v1/roles/:id
router.get('/:id', checkPermission('Roles.View'), validator(roleIdParamSchema), getRoleById);

// 47. Update System Role: PUT /api/v1/roles/:id
router.put('/:id', checkPermission('Roles.Manage'), validator(updateRoleSchema), updateRole);

// 48. Delete System Role: DELETE /api/v1/roles/:id
router.delete('/:id', checkPermission('Roles.Manage'), validator(deleteRoleSchema), deleteRole);

// Re-export permissionRouter for backwards compatibility
export { permissionRouter } from '../permission/permission.routes';

export { router as roleRouter };
export default router;

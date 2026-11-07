import type { NextFunction, Request, Response } from 'express';
import { sendPaginatedResponse, sendSuccessResponse } from '@/utils/response';
import type {
  AssignPermissionsInput,
  CreateRoleInput,
  GetRolesQueryInput,
  UpdateRoleInput,
} from './role.schema';
import {
  assignPermissionsService,
  createRoleService,
  deleteRoleService,
  getRoleByIdService,
  getRolesService,
  getUserPermissionsDetailService,
  updateRoleService,
} from './role.service';

// Re-export getPermissions for backwards compatibility
export { getPermissions } from '../permission/permission.controller';

/**
 * 44. Get System Roles
 * GET /api/v1/roles
 * Required Permission: Roles.View
 * Target: System Admin
 */
export const getRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawQuery = req.query as Record<string, string>;
    const pageNumber = Number(rawQuery.pageNumber || rawQuery.page) || 1;
    const pageSize = Number(rawQuery.pageSize || rawQuery.limit) || 10;
    const roleName = rawQuery.roleName || rawQuery.search;

    const queryData: GetRolesQueryInput = {
      pageNumber,
      pageSize,
      roleName,
    };

    const result = await getRolesService(queryData);

    return sendPaginatedResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasPreviousPage: result.pageNumber > 1,
        hasNextPage: result.pageNumber < result.totalPages,
      },
      'System roles retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 45. Get System Role by ID
 * GET /api/v1/roles/{id}
 * Required Permission: Roles.View
 * Target: System Admin
 */
export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const role = await getRoleByIdService(roleId);
    return sendSuccessResponse(res, role, 'Role retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 46. Create System Role
 * POST /api/v1/roles
 * Required Permission: Roles.Manage
 * Target: System Admin
 */
export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as CreateRoleInput;
    const role = await createRoleService(data);
    return sendSuccessResponse(res, role, 'Role created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 47. Update System Role
 * PUT /api/v1/roles/{id}
 * Required Permission: Roles.Manage
 * Target: System Admin
 */
export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const data = req.body as UpdateRoleInput;
    const role = await updateRoleService(roleId, data);
    return sendSuccessResponse(res, role, 'Role updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 48. Delete System Role
 * DELETE /api/v1/roles/{id}
 * Required Permission: Roles.Manage
 * Target: System Admin
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const result = await deleteRoleService(roleId);
    return sendSuccessResponse(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * 50. Assign Permissions to Role
 * POST /api/v1/roles/assign-permissions
 * Required Permission: Roles.Assign
 * Target: System Admin
 */
export const assignPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as AssignPermissionsInput;
    const result = await assignPermissionsService(data);
    return sendSuccessResponse(res, result, 'Permissions assigned successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Backward compatibility: get my permissions
 */
export const getMyPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId;
    const result = await getUserPermissionsDetailService(userId);
    return sendSuccessResponse(res, result, 'User permissions retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Backward compatibility: get specific user permissions
 */
export const getUserPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const result = await getUserPermissionsDetailService(userId);
    return sendSuccessResponse(res, result, 'User permissions retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

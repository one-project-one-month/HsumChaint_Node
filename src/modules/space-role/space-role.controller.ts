import type { NextFunction, Request, Response } from 'express';
import { pagedSuccessResponse, successResponse } from '@/utils/response';
import type {
  AssignSpacePermissionsInput,
  CreateSpaceRoleInput,
  GetSpaceRolesQueryInput,
  UpdateSpaceRoleInput,
} from './space-role.schema';
import {
  assignSpacePermissionsService,
  createSpaceRoleService,
  deleteSpaceRoleService,
  getSpaceRoleByIdService,
  getSpaceRolesService,
  updateSpaceRoleService,
} from './space-role.service';

/**
 * 51. Get Space Roles
 * GET /api/v1/space-roles
 * Required Permission: Authenticated
 * Target: Space Managers, System Admin
 */
export const getSpaceRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawQuery = req.query as Record<string, string>;
    const pageNumber = Number(rawQuery.pageNumber || rawQuery.page) || 1;
    const pageSize = Number(rawQuery.pageSize || rawQuery.limit) || 10;
    const roleName = rawQuery.roleName || rawQuery.search;

    const queryData: GetSpaceRolesQueryInput = {
      pageNumber,
      pageSize,
      roleName,
    };

    const result = await getSpaceRolesService(queryData);

    return pagedSuccessResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
      },
      'Space roles retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 52. Get Space Role by ID
 * GET /api/v1/space-roles/{id}
 * Required Permission: Authenticated
 * Target: Space Managers, System Admin
 */
export const getSpaceRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const role = await getSpaceRoleByIdService(roleId);
    return successResponse(res, role, 'Space role retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 53. Create Custom Space Role
 * POST /api/v1/space-roles
 * Required Permission: Roles.Manage
 * Target: System Admin
 */
export const createSpaceRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as CreateSpaceRoleInput;
    const role = await createSpaceRoleService(data);
    return successResponse(res, role, 'Space role created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 54. Update Space Role
 * PUT /api/v1/space-roles/{id}
 * Required Permission: Roles.Manage
 * Target: System Admin
 */
export const updateSpaceRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const data = req.body as UpdateSpaceRoleInput;
    const role = await updateSpaceRoleService(roleId, data);
    return successResponse(res, role, 'Space role updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 55. Delete Space Role
 * DELETE /api/v1/space-roles/{id}
 * Required Permission: Roles.Manage
 * Target: System Admin
 */
export const deleteSpaceRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const result = await deleteSpaceRoleService(roleId);
    return successResponse(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * 56. Assign Permissions to Space Role
 * POST /api/v1/space-roles/assign-permissions
 * Required Permission: Roles.Assign
 * Target: System Admin
 */
export const assignSpacePermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as AssignSpacePermissionsInput;
    const result = await assignSpacePermissionsService(data);
    return successResponse(res, result, 'Permissions assigned to space role successfully.');
  } catch (err) {
    next(err);
  }
};

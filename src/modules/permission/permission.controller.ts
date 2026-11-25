import type { NextFunction, Request, Response } from 'express';
import { sendPaginatedResponse } from '@/utils/response';
import type { GetPermissionsQueryInput } from './permission.schema';
import { getPermissionsService } from './permission.service';

/**
 * 49. List All System Permissions
 * GET /api/v1/permissions
 * Required Permission: Roles.View
 * Target: System Admin
 */
export const getPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as GetPermissionsQueryInput;
    const result = await getPermissionsService(query);

    return sendPaginatedResponse(
      res,
      result.items,
      result.pagination,
      'System permissions retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

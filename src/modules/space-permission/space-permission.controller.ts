import type { NextFunction, Request, Response } from 'express';
import { sendPaginatedResponse } from '@/utils/response';
import type { GetSpacePermissionsQueryInput } from './space-permission.schema';
import { getSpacePermissionsService } from './space-permission.service';

/**
 * 57. List All Space Permissions
 * GET /api/v1/space-permissions
 * Required Permission: Authenticated
 * Target: All Authenticated Users
 */
export const getSpacePermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as unknown as GetSpacePermissionsQueryInput;
    const result = await getSpacePermissionsService(query);

    return sendPaginatedResponse(
      res,
      result.items,
      result.pagination,
      'Space permissions retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

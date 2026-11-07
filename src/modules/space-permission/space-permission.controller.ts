import type { NextFunction, Request, Response } from 'express';
import { pagedSuccessResponse } from '@/utils/response';
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
    const rawQuery = req.query as Record<string, string>;
    const pageNumber = Number(rawQuery.pageNumber || rawQuery.page) || 1;
    const pageSize = Number(rawQuery.pageSize || rawQuery.limit) || 10;

    const queryData: GetSpacePermissionsQueryInput = {
      pageNumber,
      pageSize,
      search: rawQuery.search,
    };

    const result = await getSpacePermissionsService(queryData);

    return pagedSuccessResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
      },
      'Space permissions retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

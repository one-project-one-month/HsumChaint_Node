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
    const rawQuery = req.query as Record<string, string>;
    const pageNumber = Number(rawQuery.pageNumber || rawQuery.page) || 1;
    const pageSize = Number(rawQuery.pageSize || rawQuery.limit) || 20;

    const queryData: GetPermissionsQueryInput = {
      pageNumber,
      pageSize,
      search: rawQuery.search,
      module: rawQuery.module,
    };

    const result = await getPermissionsService(queryData);

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
      'System permissions retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

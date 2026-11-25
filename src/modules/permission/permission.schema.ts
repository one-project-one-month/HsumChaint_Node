import { z } from 'zod';

// 49. List All System Permissions query schema
export const getPermissionsQueryInputSchema = z
  .object({
    pageNumber: z.coerce.number().int().min(1).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    search: z.string().trim().optional(),
    module: z.string().trim().optional(),
  })
  .transform((data) => {
    const pageNumber = data.pageNumber ?? data.page ?? 1;
    const pageSize = data.pageSize ?? data.limit ?? 20;
    return {
      ...data,
      pageNumber,
      pageSize,
      page: pageNumber,
      limit: pageSize,
    };
  });

export const getPermissionsQuerySchema = z.object({
  query: getPermissionsQueryInputSchema,
});

export type GetPermissionsQueryInput = {
  pageNumber?: number;
  pageSize?: number;
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
};

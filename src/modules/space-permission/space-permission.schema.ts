import { z } from 'zod';

// 57. List All Space Permissions query schema
export const getSpacePermissionsQueryInputSchema = z
  .object({
    pageNumber: z.coerce.number().int().min(1).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
  })
  .transform((data) => {
    const pageNumber = data.pageNumber ?? data.page ?? 1;
    const pageSize = data.pageSize ?? data.limit ?? 10;
    return {
      ...data,
      pageNumber,
      pageSize,
      page: pageNumber,
      limit: pageSize,
    };
  });

export const getSpacePermissionsQuerySchema = z.object({
  query: getSpacePermissionsQueryInputSchema,
});

export type GetSpacePermissionsQueryInput = {
  pageNumber?: number;
  pageSize?: number;
  page?: number;
  limit?: number;
  search?: string;
};

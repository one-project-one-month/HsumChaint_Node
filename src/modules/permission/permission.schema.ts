import { z } from 'zod';

// 49. List All System Permissions query schema
export const getPermissionsQuerySchema = z.object({
  query: z.object({
    pageNumber: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(20),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    search: z.string().trim().optional(),
    module: z.string().trim().optional(),
  }),
});

export type GetPermissionsQueryInput = z.infer<typeof getPermissionsQuerySchema>['query'];

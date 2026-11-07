import { z } from 'zod';

// 57. List All Space Permissions query schema
export const getSpacePermissionsQuerySchema = z.object({
  query: z.object({
    pageNumber: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
  }),
});

export type GetSpacePermissionsQueryInput = z.infer<typeof getSpacePermissionsQuerySchema>['query'];

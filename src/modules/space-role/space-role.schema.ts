import { z } from 'zod';

// 51. Get Space Roles query schema
export const getSpaceRolesQuerySchema = z.object({
  query: z.object({
    pageNumber: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    roleName: z.string().trim().optional(),
    search: z.string().trim().optional(),
  }),
});

// 52. Space Role by ID param schema
export const spaceRoleIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// 53. Create Custom Space Role schema
export const createSpaceRoleSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Role name cannot be empty')
      .max(50, 'Role name must not exceed 50 characters'),
    description: z.string().trim().max(255).optional().nullable(),
    permissionIds: z.array(z.number().int().positive()).optional().default([]),
  }),
});

// 54. Update Space Role schema
export const updateSpaceRoleSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Role name cannot be empty')
      .max(50, 'Role name must not exceed 50 characters')
      .optional(),
    description: z.string().trim().max(255).optional().nullable(),
    permissionIds: z.array(z.number().int().positive()).optional(),
  }),
});

// 55. Delete Space Role schema
export const deleteSpaceRoleSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// 56. Assign Permissions to Space Role schema
export const assignSpacePermissionsSchema = z.object({
  body: z.object({
    spaceRoleId: z.number().int().positive('spaceRoleId is required and must be positive'),
    permissionIds: z.array(z.number().int().positive(), {
      message: 'permissionIds must be an array of positive integers',
    }),
  }),
});

// ==========================================
// Types
// ==========================================
export type GetSpaceRolesQueryInput = z.infer<typeof getSpaceRolesQuerySchema>['query'];
export type SpaceRoleIdParamInput = z.infer<typeof spaceRoleIdParamSchema>['params'];
export type CreateSpaceRoleInput = z.infer<typeof createSpaceRoleSchema>['body'];
export type UpdateSpaceRoleInput = z.infer<typeof updateSpaceRoleSchema>['body'];
export type DeleteSpaceRoleParamInput = z.infer<typeof deleteSpaceRoleSchema>['params'];
export type AssignSpacePermissionsInput = z.infer<typeof assignSpacePermissionsSchema>['body'];

import { z } from 'zod';

// ==========================================
// 4.6. System Roles Schemas
// ==========================================

// 44. Get System Roles query schema
export const getRolesQuerySchema = z.object({
  query: z.object({
    pageNumber: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    roleName: z.string().trim().optional(),
    search: z.string().trim().optional(),
  }),
});

// 45. Role by ID param schema
export const roleIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// 46. Create System Role schema
export const createRoleSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Role name cannot be empty')
        .max(50, 'Role name must not exceed 50 characters')
        .optional(),
      roleName: z
        .string()
        .trim()
        .min(1, 'Role name cannot be empty')
        .max(50, 'Role name must not exceed 50 characters')
        .optional(),
      description: z.string().trim().max(255).optional().nullable(),
      permissionIds: z.array(z.number().int().positive()).optional().default([]),
    })
    .refine((b) => Boolean(b.name || b.roleName), {
      message: 'Role name is required',
      path: ['name'],
    }),
});

// 47. Update System Role schema
export const updateRoleSchema = z.object({
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
    roleName: z
      .string()
      .trim()
      .min(1, 'Role name cannot be empty')
      .max(50, 'Role name must not exceed 50 characters')
      .optional(),
    description: z.string().trim().max(255).optional().nullable(),
    permissionIds: z.array(z.number().int().positive()).optional(),
  }),
});

// 48. Delete System Role schema
export const deleteRoleSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// 50. Assign Permissions to Role schema
export const assignPermissionsSchema = z.object({
  body: z.object({
    roleId: z.number().int().positive('roleId is required and must be positive'),
    permissionIds: z.array(z.number().int().positive(), {
      message: 'permissionIds must be an array of positive integers',
    }),
  }),
});

// ==========================================
// Types
// ==========================================
export type GetRolesQueryInput = z.infer<typeof getRolesQuerySchema>['query'];
export type RoleIdParamInput = z.infer<typeof roleIdParamSchema>['params'];
export type CreateRoleInput = {
  name?: string;
  roleName?: string;
  description?: string | null;
  permissionIds?: number[];
};
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>['body'];
export type DeleteRoleParamInput = z.infer<typeof deleteRoleSchema>['params'];
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>['body'];

// Re-export system permission schema for backwards compatibility
export {
  type GetPermissionsQueryInput,
  getPermissionsQuerySchema,
} from '../permission/permission.schema';

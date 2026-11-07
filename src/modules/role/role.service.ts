import { prisma } from '@/lib/prisma';
import { clearRolePermissionsCache } from '@/middlewares/permissionMiddleware';
import { AppError } from '@/utils/AppError';
import {
  ensureSystemPermissionsInDb,
  type FormattedPermission,
  formatPermission,
  getPermissionsOnlyService,
  getPermissionsService,
  PREDEFINED_SYSTEM_PERMISSIONS,
  searchPermissionsService,
} from '../permission/permission.service';
import type {
  AssignPermissionsInput,
  CreateRoleInput,
  GetRolesQueryInput,
  UpdateRoleInput,
} from './role.schema';

// Re-export for compatibility with callers and tests
export {
  type FormattedPermission,
  formatPermission,
  getPermissionsOnlyService,
  getPermissionsService,
  PREDEFINED_SYSTEM_PERMISSIONS,
  searchPermissionsService,
};

export interface FormattedRole {
  id: number;
  roleId: number;
  name: string;
  roleName: string;
  description: string | null;
  isDeleted: boolean;
  permissions: FormattedPermission[];
  permissionKeys: string[];
}

export const isSystemAdmin = (role: { id: number; name: string }): boolean => {
  return role.id === 1 || role.id === 3 || role.name.toLowerCase() === 'admin';
};

const stripsAdminPermissions = async (desiredIds: number[]): Promise<boolean> => {
  if (!prisma.permission?.findMany) return false;
  const allActive = await prisma.permission.findMany({
    where: { isDeleted: false },
    select: { id: true },
  });
  if (allActive.length === 0) return false;
  const desired = new Set(desiredIds);
  return allActive.some((p) => !desired.has(p.id));
};

const mapRoleToDto = (
  role: { id: number; name: string; isDeleted: boolean; description?: string | null },
  rolePermissions?: Array<{
    permission: {
      id: number;
      name: string;
      description?: string | null;
      isDeleted?: boolean;
    } | null;
  }>,
  overrideDescription?: string | null
): FormattedRole => {
  const permissions: FormattedPermission[] = [];
  for (const rp of rolePermissions || []) {
    if (rp.permission && !rp.permission.isDeleted) {
      permissions.push(formatPermission(rp.permission));
    }
  }

  return {
    id: role.id,
    roleId: role.id,
    name: role.name,
    roleName: role.name,
    description:
      overrideDescription ?? (role as { description?: string | null }).description ?? null,
    isDeleted: role.isDeleted,
    permissions,
    permissionKeys: permissions.map((p) => p.name),
  };
};

// =========================================================================
// Architectural Rule: Strict Separation of Get and Search for System Roles
// =========================================================================

/**
 * Generic listing/pagination operation for roles (ordered ascending by default)
 */
export const getRolesOnlyService = async (pageNumber = 1, pageSize = 10) => {
  const skip = (pageNumber - 1) * pageSize;

  const [roles, totalCount] = await Promise.all([
    prisma.role.findMany({
      where: { isDeleted: false },
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    }),
    prisma.role.count({ where: { isDeleted: false } }),
  ]);

  const items = roles.map((r) => mapRoleToDto(r, r.rolePermissions));

  return {
    items,
    totalCount,
    pageNumber,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize) || 1,
    total: totalCount,
    page: pageNumber,
    limit: pageSize,
  };
};

/**
 * Keyword search operation for roles
 */
export const searchRolesService = async (pageNumber = 1, pageSize = 10, keyword: string) => {
  const skip = (pageNumber - 1) * pageSize;
  const trimmed = keyword.trim();

  const whereClause = {
    isDeleted: false,
    name: { contains: trimmed },
  };

  const [roles, totalCount] = await Promise.all([
    prisma.role.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    }),
    prisma.role.count({ where: whereClause }),
  ]);

  const items = roles.map((r) => mapRoleToDto(r, r.rolePermissions));

  return {
    items,
    totalCount,
    pageNumber,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize) || 1,
    total: totalCount,
    page: pageNumber,
    limit: pageSize,
  };
};

/**
 * 44. Get paginated list of roles with their assigned permissions
 */
export const getRolesService = async (
  query: GetRolesQueryInput = { pageNumber: 1, pageSize: 10 }
) => {
  const pageNumber = query.pageNumber ?? query.page ?? 1;
  const pageSize = query.pageSize ?? query.limit ?? 10;
  const search = query.roleName ?? query.search;

  if (search && search.trim().length > 0) {
    return searchRolesService(pageNumber, pageSize, search.trim());
  }

  return getRolesOnlyService(pageNumber, pageSize);
};

/**
 * 45. Get role by ID with permissions
 */
export const getRoleByIdService = async (id: number): Promise<FormattedRole> => {
  const role = await prisma.role.findFirst({
    where: { id, isDeleted: false },
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  return mapRoleToDto(role, role.rolePermissions);
};

export const validateSystemPermissions = async (permissionIds: number[]): Promise<void> => {
  if (permissionIds.length === 0) return;

  let validCount = await prisma.permission.count({
    where: {
      id: { in: permissionIds },
      isDeleted: false,
    },
  });

  if (validCount !== permissionIds.length && typeof prisma.permission?.findFirst === 'function') {
    try {
      await ensureSystemPermissionsInDb();
      validCount = await prisma.permission.count({
        where: {
          id: { in: permissionIds },
          isDeleted: false,
        },
      });
    } catch {
      // Mock environment fallback
    }
  }

  if (validCount !== permissionIds.length) {
    throw new AppError('One or more permissions are invalid or inactive', 400);
  }
};

/**
 * 46. Create a new custom role with optional permissions
 */
export const createRoleService = async (data: CreateRoleInput): Promise<FormattedRole> => {
  const rawName = data.name ?? data.roleName;
  if (!rawName || rawName.trim().length === 0) {
    throw new AppError('Role name is required', 400);
  }

  const trimmedName = rawName.trim();
  const normalized = trimmedName.toUpperCase();

  // Check uniqueness
  const existing = await prisma.role.findFirst({
    where: { name: trimmedName, isDeleted: false },
  });
  if (existing || normalized === 'ADMIN') {
    throw new AppError(
      normalized === 'ADMIN'
        ? "The role name 'Admin' is reserved by the system"
        : 'Role name already exists',
      400
    );
  }

  // Validate permission IDs if provided
  const permissionIds = Array.from(new Set(data.permissionIds || []));
  await validateSystemPermissions(permissionIds);

  // Transactionally create role and permissions
  const created = await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        name: trimmedName,
        isDeleted: false,
      },
    });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((pId) => ({
          roleId: role.id,
          permissionId: pId,
        })),
      });
    }

    return tx.role.findUniqueOrThrow({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  });

  return mapRoleToDto(created, created.rolePermissions, data.description ?? null);
};

/**
 * 47. Update an existing role and its permissions
 */
export const updateRoleService = async (
  id: number,
  data: UpdateRoleInput
): Promise<FormattedRole> => {
  const role = await prisma.role.findFirst({
    where: { id, isDeleted: false },
    include: {
      rolePermissions: true,
    },
  });

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const rawName = data.name ?? data.roleName;
  const trimmedName = rawName?.trim();

  // Protect Admin role
  if (isSystemAdmin(role)) {
    const isRenamed =
      trimmedName !== undefined && trimmedName.toLowerCase() !== role.name.toLowerCase();
    const isStripped =
      data.permissionIds !== undefined && (await stripsAdminPermissions(data.permissionIds));
    if (isRenamed || isStripped) {
      throw new AppError(
        'The system Admin role cannot be renamed or have permissions removed.',
        400
      );
    }
  }

  // If renaming, ensure uniqueness
  if (trimmedName && trimmedName.toLowerCase() !== role.name.toLowerCase()) {
    const duplicate = await prisma.role.findFirst({
      where: { name: trimmedName, isDeleted: false, id: { not: id } },
    });
    if (duplicate) {
      throw new AppError('Role name already exists', 400);
    }
  }

  // Validate permissions if provided
  let permissionIds: number[] | undefined;
  if (data.permissionIds !== undefined) {
    permissionIds = Array.from(new Set(data.permissionIds));
    await validateSystemPermissions(permissionIds);
  }

  // Perform update in transaction
  const updated = await prisma.$transaction(async (tx) => {
    if (trimmedName) {
      await tx.role.update({
        where: { id },
        data: { name: trimmedName },
      });
    }

    if (permissionIds !== undefined) {
      await tx.rolePermission.deleteMany({
        where: { roleId: id },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((pId) => ({
            roleId: id,
            permissionId: pId,
          })),
        });
      }
    }

    return tx.role.findUniqueOrThrow({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  });

  // Invalidate Redis cache
  await clearRolePermissionsCache(id);

  return mapRoleToDto(updated, updated.rolePermissions, data.description ?? null);
};

/**
 * 48. Soft delete a role (matching C# DeleteRole)
 */
export const deleteRoleService = async (id: number): Promise<{ message: string }> => {
  const role = await prisma.role.findFirst({
    where: { id, isDeleted: false },
  });

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  // System Admin cannot be deleted
  if (isSystemAdmin(role)) {
    throw new AppError(
      'The system Admin role cannot be deleted. The default Admin role is permanently protected against deletion.',
      400
    );
  }

  // Check if role is assigned to users
  const hasUser = await prisma.user.findFirst({ where: { roleId: id, isDeleted: false } });

  if (hasUser) {
    throw new AppError('Role is assigned to users, members or pending invitations.', 400);
  }

  await prisma.role.update({
    where: { id },
    data: { isDeleted: true },
  });

  await clearRolePermissionsCache(id);

  return { message: 'Role deleted successfully' };
};

/**
 * 50. Assign / Replace permissions for a given role (matching C# AssignPermissions)
 */
export const assignPermissionsService = async (data: AssignPermissionsInput) => {
  const { roleId, permissionIds } = data;

  const role = await prisma.role.findFirst({
    where: { id: roleId, isDeleted: false },
  });

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const distinctIds = Array.from(new Set(permissionIds));

  // Protect system admin
  if (isSystemAdmin(role) && (await stripsAdminPermissions(distinctIds))) {
    throw new AppError('Permissions assigned to the Admin role cannot be removed.', 400);
  }

  await validateSystemPermissions(distinctIds);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({
      where: { roleId },
    });

    if (distinctIds.length > 0) {
      await tx.rolePermission.createMany({
        data: distinctIds.map((pId) => ({
          roleId,
          permissionId: pId,
        })),
      });
    }
  });

  // Invalidate Redis cache
  await clearRolePermissionsCache(roleId);

  return {
    message: 'Permissions assigned successfully',
    roleId,
    permissionIds: distinctIds,
    count: distinctIds.length,
  };
};

/**
 * Get distinct active permissions for a specific user (matching C# GetUserPermissions)
 */
export const getUserPermissionsService = async (userId: number): Promise<string[]> => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    include: { role: true },
  });

  if (!user || user.role.isDeleted) {
    return [];
  }

  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      roleId: user.roleId,
      permission: { isDeleted: false },
    },
    include: {
      permission: true,
    },
    orderBy: {
      permission: { name: 'asc' },
    },
  });

  return rolePermissions
    .map((rp) => rp.permission?.name)
    .filter((name): name is string => Boolean(name));
};

export interface UserPermissionsDetailDto {
  userId: number;
  roleId: number | null;
  roleName: string | null;
  permissions: string[];
}

/**
 * Get user permission details including userId, roleId, roleName, and permissions
 */
export const getUserPermissionsDetailService = async (
  userId: number
): Promise<UserPermissionsDetailDto> => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    include: { role: true },
  });

  if (!user?.role || user.role.isDeleted) {
    return {
      userId,
      roleId: null,
      roleName: null,
      permissions: [],
    };
  }

  const permissions = await getUserPermissionsService(userId);

  return {
    userId: user.id,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions,
  };
};

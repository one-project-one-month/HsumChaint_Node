import { prisma } from '@/lib/prisma';
import { clearSpaceRolePermissionsCache } from '@/middlewares/permissionMiddleware';
import { AppError } from '@/utils/AppError';
import { type FormattedPermission, formatPermission } from '../permission/permission.service';
import type {
  AssignSpacePermissionsInput,
  CreateSpaceRoleInput,
  GetSpaceRolesQueryInput,
  UpdateSpaceRoleInput,
} from './space-role.schema';

export interface SpaceRoleDto {
  id: number;
  roleId: number;
  name: string;
  roleName: string;
  description: string | null;
  isDeleted: boolean;
  permissions: FormattedPermission[];
  permissionKeys: string[];
}

export const isCoreSpaceRole = (role: { id: number; name: string }): boolean => {
  const norm = role.name.toLowerCase();
  return role.id === 1 || norm === 'owner' || norm === 'space admin';
};

const mapSpaceRoleToDto = (
  role: {
    id: number;
    name: string;
    description: string | null;
    isDeleted: boolean;
  },
  permissions?: Array<{
    spacePermission: {
      id: number;
      name: string;
      description?: string | null;
      isDeleted?: boolean;
    } | null;
  }>
): SpaceRoleDto => {
  const formattedPermissions: FormattedPermission[] = [];
  for (const p of permissions || []) {
    if (p.spacePermission && !p.spacePermission.isDeleted) {
      formattedPermissions.push(formatPermission(p.spacePermission));
    }
  }

  return {
    id: role.id,
    roleId: role.id,
    name: role.name,
    roleName: role.name,
    description: role.description ?? null,
    isDeleted: role.isDeleted,
    permissions: formattedPermissions,
    permissionKeys: formattedPermissions.map((p) => p.name),
  };
};

const stripsOwnerPermissions = async (desiredIds: number[]): Promise<boolean> => {
  if (!prisma.spacePermission?.findMany) return false;
  const allActive = await prisma.spacePermission.findMany({
    where: { isDeleted: false },
    select: { id: true },
  });
  if (allActive.length === 0) return false;
  const desired = new Set(desiredIds);
  return allActive.some((p) => !desired.has(p.id));
};

// =========================================================================
// Architectural Rule: Strict Separation of Get and Search for Space Roles
// =========================================================================

/**
 * Generic listing/pagination operation for space roles (ordered ascending by default)
 */
export const getSpaceRolesOnlyService = async (pageNumber = 1, pageSize = 10) => {
  const skip = (pageNumber - 1) * pageSize;

  const [roles, totalCount] = await Promise.all([
    prisma.spaceRole.findMany({
      where: { isDeleted: false },
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
      include: {
        permissions: {
          where: { isDeleted: false },
          include: {
            spacePermission: true,
          },
        },
      },
    }),
    prisma.spaceRole.count({ where: { isDeleted: false } }),
  ]);

  const items = roles.map((r) => mapSpaceRoleToDto(r, r.permissions));

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
 * Keyword search operation for space roles
 */
export const searchSpaceRolesService = async (pageNumber = 1, pageSize = 10, keyword: string) => {
  const skip = (pageNumber - 1) * pageSize;
  const trimmed = keyword.trim();

  const whereClause = {
    isDeleted: false,
    name: { contains: trimmed },
  };

  const [roles, totalCount] = await Promise.all([
    prisma.spaceRole.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
      include: {
        permissions: {
          where: { isDeleted: false },
          include: {
            spacePermission: true,
          },
        },
      },
    }),
    prisma.spaceRole.count({ where: whereClause }),
  ]);

  const items = roles.map((r) => mapSpaceRoleToDto(r, r.permissions));

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
 * 51. Get paginated list of space roles with their assigned permissions
 */
export const getSpaceRolesService = async (query?: GetSpaceRolesQueryInput) => {
  const pageNumber = query?.pageNumber ?? query?.page ?? 1;
  const pageSize = query?.pageSize ?? query?.limit ?? 10;
  const search = query?.roleName ?? query?.search;

  if (search && search.trim().length > 0) {
    return searchSpaceRolesService(pageNumber, pageSize, search.trim());
  }

  return getSpaceRolesOnlyService(pageNumber, pageSize);
};

/**
 * 52. Get space role by ID with permissions
 */
export const getSpaceRoleByIdService = async (id: number): Promise<SpaceRoleDto> => {
  const role = await prisma.spaceRole.findFirst({
    where: { id, isDeleted: false },
    include: {
      permissions: {
        where: { isDeleted: false },
        include: {
          spacePermission: true,
        },
      },
    },
  });

  if (!role) {
    throw new AppError('Space role not found.', 404);
  }

  return mapSpaceRoleToDto(role, role.permissions);
};

/**
 * 53. Create a new custom space role and optionally associates permissions
 */
export const createSpaceRoleService = async (data: CreateSpaceRoleInput): Promise<SpaceRoleDto> => {
  const trimmedName = data.name.trim();
  const normalized = trimmedName.toUpperCase();

  // Check uniqueness and reserved names
  const existing = await prisma.spaceRole.findFirst({
    where: { name: trimmedName, isDeleted: false },
  });
  if (existing || normalized === 'OWNER') {
    throw new AppError(
      normalized === 'OWNER'
        ? "The space role name 'Owner' is reserved by the system"
        : 'Space role name already exists',
      400
    );
  }

  const permissionIds = Array.from(new Set(data.permissionIds || []));
  if (permissionIds.length > 0) {
    const validCount = await prisma.spacePermission.count({
      where: {
        id: { in: permissionIds },
        isDeleted: false,
      },
    });
    if (validCount !== permissionIds.length) {
      throw new AppError('One or more space permissions are invalid or inactive', 400);
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const role = await tx.spaceRole.create({
      data: {
        name: trimmedName,
        description: data.description?.trim() ?? null,
        isDeleted: false,
      },
    });

    if (permissionIds.length > 0) {
      await tx.spaceRolePermission.createMany({
        data: permissionIds.map((pId) => ({
          spaceRoleId: role.id,
          spacePermissionId: pId,
          isDeleted: false,
        })),
      });
    }

    return tx.spaceRole.findUniqueOrThrow({
      where: { id: role.id },
      include: {
        permissions: {
          where: { isDeleted: false },
          include: {
            spacePermission: true,
          },
        },
      },
    });
  });

  return mapSpaceRoleToDto(created, created.permissions);
};

/**
 * 54. Update space role
 */
export const updateSpaceRoleService = async (
  id: number,
  data: UpdateSpaceRoleInput
): Promise<SpaceRoleDto> => {
  const role = await prisma.spaceRole.findFirst({
    where: { id, isDeleted: false },
    include: {
      permissions: { where: { isDeleted: false } },
    },
  });

  if (!role) {
    throw new AppError('Space role not found.', 404);
  }

  const trimmedName = data.name?.trim();

  // Protect Owner role
  if (isCoreSpaceRole(role)) {
    const isRenamed =
      trimmedName !== undefined && trimmedName.toLowerCase() !== role.name.toLowerCase();
    const isStripped =
      data.permissionIds !== undefined && (await stripsOwnerPermissions(data.permissionIds));
    if (isRenamed || isStripped) {
      throw new AppError(
        'The default Owner space role is strictly protected against permission stripping or modification.',
        400
      );
    }
  }

  if (trimmedName && trimmedName.toLowerCase() !== role.name.toLowerCase()) {
    const duplicate = await prisma.spaceRole.findFirst({
      where: { name: trimmedName, isDeleted: false, id: { not: id } },
    });
    if (duplicate) {
      throw new AppError('Space role name already exists', 400);
    }
  }

  let permissionIds: number[] | undefined;
  if (data.permissionIds !== undefined) {
    permissionIds = Array.from(new Set(data.permissionIds));

    if (permissionIds.length > 0) {
      const validCount = await prisma.spacePermission.count({
        where: {
          id: { in: permissionIds },
          isDeleted: false,
        },
      });
      if (validCount !== permissionIds.length) {
        throw new AppError('One or more space permissions are invalid or inactive', 400);
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: { name?: string; description?: string | null } = {};
    if (trimmedName) updateData.name = trimmedName;
    if (data.description !== undefined) updateData.description = data.description?.trim() ?? null;

    if (Object.keys(updateData).length > 0) {
      await tx.spaceRole.update({
        where: { id },
        data: updateData,
      });
    }

    if (permissionIds !== undefined) {
      await tx.spaceRolePermission.deleteMany({
        where: { spaceRoleId: id },
      });

      if (permissionIds.length > 0) {
        await tx.spaceRolePermission.createMany({
          data: permissionIds.map((pId) => ({
            spaceRoleId: id,
            spacePermissionId: pId,
            isDeleted: false,
          })),
        });
      }
    }

    return tx.spaceRole.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: {
          where: { isDeleted: false },
          include: {
            spacePermission: true,
          },
        },
      },
    });
  });

  await clearSpaceRolePermissionsCache(id);

  return mapSpaceRoleToDto(updated, updated.permissions);
};

/**
 * 55. Soft delete a space role (core Owner role protected)
 */
export const deleteSpaceRoleService = async (id: number): Promise<{ message: string }> => {
  const role = await prisma.spaceRole.findFirst({
    where: { id, isDeleted: false },
  });

  if (!role) {
    throw new AppError('Space role not found.', 404);
  }

  if (isCoreSpaceRole(role)) {
    throw new AppError('The default Owner space role cannot be deleted.', 400);
  }

  // Check if assigned to members or invitations
  if (typeof prisma.monasteryMember?.findFirst === 'function') {
    const hasMembers = await prisma.monasteryMember.findFirst({
      where: { spaceRoleId: id, user: { isDeleted: false } },
    });
    if (hasMembers) {
      throw new AppError('Space role is assigned to members or pending invitations.', 400);
    }
  }

  await prisma.spaceRole.update({
    where: { id },
    data: { isDeleted: true },
  });

  await clearSpaceRolePermissionsCache(id);

  return { message: 'Space role deleted successfully' };
};

/**
 * 56. Assign permissions to a space role
 */
export const assignSpacePermissionsService = async (data: AssignSpacePermissionsInput) => {
  const { spaceRoleId, permissionIds } = data;

  const role = await prisma.spaceRole.findFirst({
    where: { id: spaceRoleId, isDeleted: false },
  });

  if (!role) {
    throw new AppError('Space role not found.', 404);
  }

  const distinctIds = Array.from(new Set(permissionIds));

  // Protect Owner role against stripping
  if (isCoreSpaceRole(role) && (await stripsOwnerPermissions(distinctIds))) {
    throw new AppError(
      'The default Owner space role is strictly protected against permission stripping.',
      400
    );
  }

  if (distinctIds.length > 0) {
    const validCount = await prisma.spacePermission.count({
      where: {
        id: { in: distinctIds },
        isDeleted: false,
      },
    });
    if (validCount !== distinctIds.length) {
      throw new AppError('One or more space permissions are invalid or inactive', 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.spaceRolePermission.deleteMany({
      where: { spaceRoleId },
    });

    if (distinctIds.length > 0) {
      await tx.spaceRolePermission.createMany({
        data: distinctIds.map((pId) => ({
          spaceRoleId,
          spacePermissionId: pId,
          isDeleted: false,
        })),
      });
    }
  });

  await clearSpaceRolePermissionsCache(spaceRoleId);

  return {
    message: 'Permissions assigned to space role successfully',
    spaceRoleId,
    permissionIds: distinctIds,
    count: distinctIds.length,
  };
};

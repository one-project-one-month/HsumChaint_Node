import { prisma } from '@/lib/prisma';
import type { GetPermissionsQueryInput } from './permission.schema';

export interface FormattedPermission {
  id: number;
  permissionId: number;
  name: string;
  permissionName: string;
  module: string;
  action: string;
  displayName: string;
  category: string;
  description?: string | null;
  isDeleted?: boolean;
}

export const PREDEFINED_SYSTEM_PERMISSIONS = [
  'Roles.View',
  'Roles.Manage',
  'Roles.Assign',
  'Users.View',
  'Users.Update',
  'Users.Manage',
  'Users.Create',
  'Monastery.Create',
  'Monastery.View',
  'Monastery.Update',
  'Monastery.Delete',
  'Monastery.ManageMembers',
  'Invitation.View',
  'Invitation.Respond',
  'Notification.View',
  'Notification.Manage',
  'Donor.View',
  'Donor.Create',
  'Donor.Update',
  'Donor.Delete',
] as const;

export const formatPermission = (perm: {
  id: number;
  name: string;
  description?: string | null;
  isDeleted?: boolean;
}): FormattedPermission => {
  const parts = perm.name.split('.');
  const module = parts.length > 1 ? parts[0] : 'General';
  const action = parts.length > 1 ? parts.slice(1).join('.') : perm.name;

  const category = (() => {
    switch (module) {
      case 'User':
      case 'Users':
        return 'User Management';
      case 'Role':
      case 'Roles':
        return 'Role & Access Control';
      case 'Donor':
        return 'Donor Management';
      case 'Monastery':
      case 'Space':
        return 'Monastery & Space';
      case 'Invitation':
        return 'Invitation Management';
      case 'Notification':
        return 'Notification Management';
      case 'Donation':
        return 'Donation Management';
      default:
        return 'General System';
    }
  })();

  return {
    id: perm.id,
    permissionId: perm.id,
    name: perm.name,
    permissionName: perm.name,
    module,
    action,
    displayName: `${action} ${module}`,
    category,
    description: perm.description ?? null,
    isDeleted: perm.isDeleted ?? false,
  };
};

/**
 * Generic listing/pagination operation for system permissions (ordered ascending by default)
 */
export const getPermissionsOnlyService = async (pageNumber = 1, pageSize = 20) => {
  const skip = (pageNumber - 1) * pageSize;

  const [permissions, totalCount] = await Promise.all([
    prisma.permission.findMany({
      where: { isDeleted: false },
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
    }),
    prisma.permission.count({ where: { isDeleted: false } }),
  ]);

  return {
    items: permissions.map(formatPermission),
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
 * Keyword search operation for system permissions
 */
export const searchPermissionsService = async (
  pageNumber = 1,
  pageSize = 20,
  search?: string,
  module?: string
) => {
  const skip = (pageNumber - 1) * pageSize;

  const whereClause: {
    isDeleted: boolean;
    name?: { contains?: string; startsWith?: string };
  } = {
    isDeleted: false,
  };

  if (search) {
    whereClause.name = { contains: search.trim() };
  } else if (module) {
    whereClause.name = { startsWith: `${module.trim()}.` };
  }

  const [permissions, totalCount] = await Promise.all([
    prisma.permission.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
    }),
    prisma.permission.count({ where: whereClause }),
  ]);

  return {
    items: permissions.map(formatPermission),
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
 * List all available system permissions with pagination & search
 */
export const getPermissionsService = async (
  query: GetPermissionsQueryInput = { pageNumber: 1, pageSize: 20 }
) => {
  const pageNumber = query.pageNumber ?? query.page ?? 1;
  const pageSize = query.pageSize ?? query.limit ?? 20;

  if (query.search || query.module) {
    return searchPermissionsService(pageNumber, pageSize, query.search, query.module);
  }

  return getPermissionsOnlyService(pageNumber, pageSize);
};

import { prisma } from '@/lib/prisma';
import { formatPermission } from '../permission/permission.service';
import type { GetSpacePermissionsQueryInput } from './space-permission.schema';

export const PREDEFINED_SPACE_PERMISSIONS = [
  { name: 'Space.View', description: 'View space details, members, and general activities' },
  { name: 'Space.Update', description: 'Update monastery space profile and details' },
  { name: 'Space.Delete', description: 'Delete monastery space' },
  { name: 'Space.InviteMember', description: 'Invite new members to the monastery space' },
  { name: 'Space.UpdateMemberRole', description: 'Assign or change member roles within space' },
  { name: 'Space.RemoveMember', description: 'Remove members from the monastery space' },
  { name: 'Donation.View', description: 'View donation entries and reports' },
  { name: 'Donation.Create', description: 'Submit donation entries in space' },
  { name: 'Donation.Review', description: 'Approve, reject, or mark donations completed' },
  { name: 'Donation.Schedule', description: 'Schedule donation dates or intervals' },
  { name: 'Donation.Cancel', description: 'Cancel donation requests' },
  { name: 'Donation.Delete', description: 'Delete donation records' },
] as const;

/**
 * Ensures all 12 predefined space permissions are persisted in the database
 */
export const ensureSpacePermissionsInDb = async (): Promise<void> => {
  // Preserve existing IDs, grants, and intentionally disabled permissions.
  for (const permission of PREDEFINED_SPACE_PERMISSIONS) {
    await prisma.spacePermission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: { ...permission, isDeleted: false },
    });
  }
};

// =========================================================================
// Architectural Rule: Strict Separation of Get and Search for Space Permissions
// =========================================================================

/**
 * Generic listing/pagination operation for space permissions (ordered ascending by default)
 */
export const getSpacePermissionsOnlyService = async (pageNumber = 1, pageSize = 10) => {
  const skip = (pageNumber - 1) * pageSize;

  let totalCount = await prisma.spacePermission.count({ where: { isDeleted: false } });

  if (
    totalCount < PREDEFINED_SPACE_PERMISSIONS.length &&
    typeof prisma.spacePermission?.findFirst === 'function'
  ) {
    try {
      await ensureSpacePermissionsInDb();
      totalCount = await prisma.spacePermission.count({ where: { isDeleted: false } });
    } catch {
      // Mock environment or DB connection issue
    }
  }

  const permissions = await prisma.spacePermission.findMany({
    where: { isDeleted: false },
    skip,
    take: pageSize,
    orderBy: { id: 'asc' },
  });

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
 * Keyword search operation for space permissions
 */
export const searchSpacePermissionsService = async (
  pageNumber = 1,
  pageSize = 10,
  keyword: string
) => {
  const skip = (pageNumber - 1) * pageSize;
  const trimmed = keyword.trim();

  const permissions = await prisma.spacePermission.findMany({
    where: { isDeleted: false, name: { contains: trimmed } },
    skip,
    take: pageSize,
    orderBy: { id: 'asc' },
  });

  const totalCount = await prisma.spacePermission.count({
    where: { isDeleted: false, name: { contains: trimmed } },
  });

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
 * 57. List all available space permissions with pagination
 */
export const getSpacePermissionsService = async (
  query: GetSpacePermissionsQueryInput = { pageNumber: 1, pageSize: 10 }
) => {
  const pageNumber = query.pageNumber ?? query.page ?? 1;
  const pageSize = query.pageSize ?? query.limit ?? 10;
  const search = query.search;

  if (search && search.trim().length > 0) {
    return searchSpacePermissionsService(pageNumber, pageSize, search.trim());
  }

  return getSpacePermissionsOnlyService(pageNumber, pageSize);
};

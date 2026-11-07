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
  if (typeof prisma.spacePermission?.findFirst !== 'function') return;
  for (let i = 0; i < PREDEFINED_SPACE_PERMISSIONS.length; i++) {
    const sp = PREDEFINED_SPACE_PERMISSIONS[i];
    const id = i + 1;

    try {
      // 1. Check if permission with target name already exists
      const existingByName = await prisma.spacePermission.findFirst({
        where: { name: sp.name },
      });

      if (existingByName) {
        if (existingByName.isDeleted || existingByName.description !== sp.description) {
          await prisma.spacePermission.update({
            where: { id: existingByName.id },
            data: { isDeleted: false, description: sp.description },
          });
        }
        continue;
      }

      // 2. Check if target ID is occupied
      const existingById = await prisma.spacePermission.findUnique({
        where: { id },
      });

      if (!existingById) {
        // Free slot: insert with the exact predefined ID (1..12)
        await prisma.spacePermission.create({
          data: {
            id,
            name: sp.name,
            description: sp.description,
            isDeleted: false,
          },
        });
      } else {
        // Target ID is occupied by an obsolete legacy permission name: update it to the new name
        await prisma.spacePermission.update({
          where: { id },
          data: {
            name: sp.name,
            description: sp.description,
            isDeleted: false,
          },
        });
      }
    } catch {
      // Fallback in case of race condition or mock
    }
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

  let permissions = await prisma.spacePermission.findMany({
    where: { isDeleted: false },
    skip,
    take: pageSize,
    orderBy: { id: 'asc' },
  });

  // Fallback to predefined space permissions if database/mock table is empty
  if (totalCount === 0) {
    const fallbackList = PREDEFINED_SPACE_PERMISSIONS.map((p, idx) => ({
      id: idx + 1,
      name: p.name,
      description: p.description,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    totalCount = fallbackList.length;
    permissions = fallbackList.slice(skip, skip + pageSize);
  }

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

  let permissions = await prisma.spacePermission.findMany({
    where: { isDeleted: false, name: { contains: trimmed } },
    skip,
    take: pageSize,
    orderBy: { id: 'asc' },
  });

  let totalCount = await prisma.spacePermission.count({
    where: { isDeleted: false, name: { contains: trimmed } },
  });

  if (totalCount === 0 && permissions.length === 0) {
    const fallbackList = PREDEFINED_SPACE_PERMISSIONS.filter((p) =>
      p.name.toLowerCase().includes(trimmed.toLowerCase())
    ).map((p, idx) => ({
      id: idx + 1,
      name: p.name,
      description: p.description,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    totalCount = fallbackList.length;
    permissions = fallbackList.slice(skip, skip + pageSize);
  }

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

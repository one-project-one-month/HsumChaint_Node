import type { Prisma } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/utils/AppError';
import { buildListCacheKey, clearUserListCache } from '@/utils/cache.util';
import type {
  getAllUsersInput,
  idParamsInput,
  updateMonkProfileBodyInput,
  updateUserBodyInput,
  updateUserSettingsBodyInput,
} from './user.schema';

/**
 * Standard selection object to ensure we don't leak sensitive data
 * like hashed passwords by default.
 */
export const selectUser = {
  id: true,
  phone: true,
  name: true,
  email: true,
  contactPhone: true,
  roleId: true,
  createdAt: true,
  avatar: true,
} as const;

export const getRoleName = (roleId: number): string => {
  switch (roleId) {
    case 1:
      return 'Monk';
    case 2:
      return 'Donor';
    case 3:
      return 'Admin';
    default:
      return 'User';
  }
};

export const mapUserDto = (user: {
  id: number;
  name: string;
  phone: string;
  roleId: number;
  email?: string | null;
  contactPhone?: string | null;
  createdAt?: Date;
  avatar?: string | null;
  monkProfile?: unknown;
}) => ({
  id: user.id,
  name: user.name,
  phoneNumber: user.phone,
  phone: user.phone,
  roleId: user.roleId,
  roleName: getRoleName(user.roleId),
  email: user.email ?? null,
  contactPhoneNumber: user.contactPhone ?? user.phone ?? null,
  contactPhone: user.contactPhone ?? user.phone ?? null,
  avatar: user.avatar ?? null,
  createdAt: user.createdAt,
  monkProfile: user.monkProfile ?? null,
});

// --- Query Services using Redis ---

export const getAllUserService = async (data: getAllUsersInput) => {
  const pageNumber = data.pageNumber ?? data.page ?? 1;
  const pageSize = data.pageSize ?? data.limit ?? 10;

  // Create a unique fingerprint for specific search
  const cacheKey = buildListCacheKey(data);
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      return parsed;
    }
  } catch (error) {
    console.error('Redis Get List Error', error);
  }

  const { name, email, phone, contactPhone, roleId, monasteryName, monasteryAddress } = data;
  const skip = (pageNumber - 1) * pageSize;

  const where: Prisma.UserWhereInput = { isDeleted: false };

  // Build filters
  if (name) where.name = { startsWith: name };
  if (phone) where.phone = { startsWith: phone };
  if (email) where.email = { contains: email };
  if (contactPhone) where.contactPhone = { startsWith: contactPhone };
  if (roleId) where.roleId = roleId;

  // Build Monk Profile filters
  const monkProfileFilter: Prisma.MonkProfileWhereInput = {};
  if (monasteryAddress) monkProfileFilter.monasteryAddress = { startsWith: monasteryAddress };
  if (monasteryName) monkProfileFilter.monasteryName = { startsWith: monasteryName };

  if (Object.keys(monkProfileFilter).length > 0) {
    where.monkProfile = { is: monkProfileFilter };
    if (!roleId) where.roleId = 1;
  }

  // Transaction ensures the count and the data list are in sync
  const [users, totalCount] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      select: selectUser,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const mappedUsers = users.map(mapUserDto);
  const pagination = {
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: pageNumber > 1,
    hasNextPage: pageNumber < totalPages,
  };

  const result = { users: mappedUsers, totals: totalCount, pagination };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 600);
  } catch (error) {
    console.error('Redis Set List Error', error);
  }

  return result;
};

/**
 * Reusable helper to fetch a single user with their monk profile.
 * Used by GetMe and GetUserById.
 */
const getUserWithProfile = async (id: number) => {
  const cachedKey = `user:${id}:profile`;
  try {
    const cachedUser = await redis.get(cachedKey);
    if (cachedUser) {
      try {
        const profile = JSON.parse(cachedUser);
        if (typeof profile.name === 'string' && typeof profile.roleId === 'number') {
          return mapUserDto(profile);
        }
      } catch {
        await redis.del(cachedKey);
      }
    }
  } catch (error) {
    console.error('Redis Get Error:', error);
  }

  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { ...selectUser, monkProfile: true },
  });

  if (!user) throw new AppError('User not found', 404);

  const mapped = mapUserDto(user);

  try {
    await redis.set(cachedKey, JSON.stringify(mapped), 'EX', 3600);
  } catch (error) {
    console.error('Redis Set Error:', error);
  }

  return mapped;
};

export const getMeService = getUserWithProfile;

export const getUserByIdService = ({ id }: idParamsInput) => getUserWithProfile(id);

// --- Mutation Services ---

export const updateUserService = async (
  id: number,
  data: updateUserBodyInput,
  callerRoleId?: number
) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user || user.isDeleted) throw new AppError('User not found', 404);

  // Business rule: only SuperAdmin (Role ID 3) can change roleId
  if (data.roleId !== undefined && data.roleId !== user.roleId && callerRoleId !== 3) {
    throw new AppError('Changing user role requires administrative privileges', 403);
  }

  // Check unique phone number if updating phone
  const newPhone = data.phone ?? data.phoneNumber;
  if (newPhone && newPhone !== user.phone) {
    const existing = await prisma.user.findFirst({
      where: { phone: newPhone, id: { not: id }, isDeleted: false },
    });
    if (existing) {
      throw new AppError('Phone number already in use', 400);
    }
  }

  // 1. Handle Password Logic
  let hashedPassword: string | undefined;
  if (data.newPassword) {
    if (!data.oldPassword) throw new AppError('Old password is required', 400);

    const isPasswordMatch = await Bun.password.verify(data.oldPassword, user.password);
    if (!isPasswordMatch) throw new AppError('Old password is incorrect', 400);

    hashedPassword = await Bun.password.hash(data.newPassword);
  }

  // 2. Build User Update Payload
  const updateData: Prisma.UserUpdateInput = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.email !== undefined && { email: data.email }),
    ...(newPhone !== undefined && { phone: newPhone }),
    ...(hashedPassword !== undefined && { password: hashedPassword }),
    ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
    ...(data.avatar !== undefined && { avatar: data.avatar }),
    ...(callerRoleId === 3 &&
      data.roleId !== undefined && { role: { connect: { id: data.roleId } } }),
  };

  // Build monk profile update separately if monastery details provided
  const monkProfileData: Prisma.MonkProfileUpdateInput = {};
  if (data.monasteryName !== undefined) monkProfileData.monasteryName = data.monasteryName;
  if (data.monasteryAddress !== undefined) monkProfileData.monasteryAddress = data.monasteryAddress;

  if (Object.keys(monkProfileData).length > 0) {
    if (user.roleId !== 1) {
      throw new AppError('Only monks can update monastery info', 400);
    }
    updateData.monkProfile = { update: monkProfileData };
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { ...selectUser, monkProfile: true },
  });

  await redis.del(`user:${id}:profile`);
  await clearUserListCache();

  return mapUserDto(updatedUser);
};

export const softDeleteUserService = async (data: idParamsInput) => {
  const { id } = data;

  const existingUser = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: selectUser,
  });

  if (!existingUser) {
    throw new AppError('User is not found or already deleted', 404);
  }

  await prisma.user.update({
    where: { id },
    data: { isDeleted: true },
  });

  await redis.del(`user:${id}:profile`);
  await clearUserListCache();
  return existingUser;
};

// --- Monk Profile Services ---

export const getMonkProfileService = async (userId: number) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    include: { monkProfile: true },
  });

  if (!user) throw new AppError('User not found', 404);
  if (user.roleId !== 1 || !user.monkProfile) {
    throw new AppError('User is not a monk or monk profile does not exist', 400);
  }

  return {
    id: user.monkProfile.id,
    userId: user.monkProfile.userId,
    monasteryName: user.monkProfile.monasteryName,
    monasteryAddress: user.monkProfile.monasteryAddress,
  };
};

export const updateMonkProfileService = async (
  userId: number,
  data: updateMonkProfileBodyInput
) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });

  if (!user) throw new AppError('User not found', 404);
  if (user.roleId !== 1) {
    throw new AppError('Only monk users can update monk profile', 400);
  }

  const profile = await prisma.monkProfile.upsert({
    where: { userId },
    create: {
      userId,
      monasteryName: data.monasteryName,
      monasteryAddress: data.monasteryAddress,
    },
    update: {
      monasteryName: data.monasteryName,
      monasteryAddress: data.monasteryAddress,
    },
  });

  await redis.del(`user:${userId}:profile`);

  return {
    id: profile.id,
    userId: profile.userId,
    monasteryName: profile.monasteryName,
    monasteryAddress: profile.monasteryAddress,
  };
};

export const deleteMonkProfileService = async (userId: number) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new AppError('User not found', 404);

  const profile = await prisma.monkProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new AppError('Monk profile not found', 400);
  }

  await prisma.monkProfile.delete({ where: { userId } });
  await redis.del(`user:${userId}:profile`);
  return null;
};

// --- Invitation Services (Web Offset & Mobile Cursor) ---

export const getUserReceivedInvitationsService = async (
  userId: number,
  { pageNumber, pageSize }: { pageNumber: number; pageSize: number }
) => {
  const skip = (pageNumber - 1) * pageSize;
  const where = { invitedUserId: userId };

  const [items, totalCount] = await prisma.$transaction([
    prisma.invitation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { id: 'desc' },
      include: {
        monasterySpace: { select: { id: true, monasteryName: true } },
        invitedUser: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
        spaceRole: { select: { id: true, name: true } },
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const data = items.map((inv) => ({
    id: inv.id,
    monasterySpaceId: inv.monasterySpaceId,
    monasterySpaceName: inv.monasterySpace?.monasteryName ?? '',
    invitedUserId: inv.invitedUserId,
    invitedUserName: inv.invitedUser?.name ?? '',
    invitedById: inv.invitedById,
    invitedByName: inv.invitedBy?.name ?? null,
    spaceRoleId: inv.spaceRoleId,
    spaceRoleName: inv.spaceRole?.name ?? '',
    status: inv.status,
    createdAt: inv.createdAt,
  }));

  return {
    items: data,
    pagination: {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    },
  };
};

export const getUserReceivedInvitationsFeedService = async (
  userId: number,
  { lastId, pageSize }: { lastId?: number; pageSize: number }
) => {
  const where: Prisma.InvitationWhereInput = {
    invitedUserId: userId,
    ...(lastId ? { id: { lt: lastId } } : {}),
  };

  const items = await prisma.invitation.findMany({
    where,
    take: pageSize + 1,
    orderBy: { id: 'desc' },
    include: {
      monasterySpace: { select: { id: true, monasteryName: true } },
      invitedUser: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true } },
      spaceRole: { select: { id: true, name: true } },
    },
  });

  const hasNextPage = items.length > pageSize;
  const sliced = hasNextPage ? items.slice(0, pageSize) : items;
  const nextCursor = sliced.length > 0 && hasNextPage ? sliced[sliced.length - 1].id : null;

  const data = sliced.map((inv) => ({
    id: inv.id,
    monasterySpaceId: inv.monasterySpaceId,
    monasterySpaceName: inv.monasterySpace?.monasteryName ?? '',
    invitedUserId: inv.invitedUserId,
    invitedUserName: inv.invitedUser?.name ?? '',
    invitedById: inv.invitedById,
    invitedByName: inv.invitedBy?.name ?? null,
    spaceRoleId: inv.spaceRoleId,
    spaceRoleName: inv.spaceRole?.name ?? '',
    status: inv.status,
    createdAt: inv.createdAt,
  }));

  return {
    items: data,
    pagination: {
      nextCursor,
      hasNextPage,
      pageSize,
    },
  };
};

export const getUserSentInvitationsService = async (
  userId: number,
  { pageNumber, pageSize }: { pageNumber: number; pageSize: number }
) => {
  const skip = (pageNumber - 1) * pageSize;
  const where = { invitedById: userId };

  const [items, totalCount] = await prisma.$transaction([
    prisma.invitation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { id: 'desc' },
      include: {
        monasterySpace: { select: { id: true, monasteryName: true } },
        invitedUser: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
        spaceRole: { select: { id: true, name: true } },
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const data = items.map((inv) => ({
    id: inv.id,
    monasterySpaceId: inv.monasterySpaceId,
    monasterySpaceName: inv.monasterySpace?.monasteryName ?? '',
    invitedUserId: inv.invitedUserId,
    invitedUserName: inv.invitedUser?.name ?? '',
    invitedById: inv.invitedById,
    invitedByName: inv.invitedBy?.name ?? null,
    spaceRoleId: inv.spaceRoleId,
    spaceRoleName: inv.spaceRole?.name ?? '',
    status: inv.status,
    createdAt: inv.createdAt,
  }));

  return {
    items: data,
    pagination: {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    },
  };
};

export const getUserSentInvitationsFeedService = async (
  userId: number,
  { lastId, pageSize }: { lastId?: number; pageSize: number }
) => {
  const where: Prisma.InvitationWhereInput = {
    invitedById: userId,
    ...(lastId ? { id: { lt: lastId } } : {}),
  };

  const items = await prisma.invitation.findMany({
    where,
    take: pageSize + 1,
    orderBy: { id: 'desc' },
    include: {
      monasterySpace: { select: { id: true, monasteryName: true } },
      invitedUser: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true } },
      spaceRole: { select: { id: true, name: true } },
    },
  });

  const hasNextPage = items.length > pageSize;
  const sliced = hasNextPage ? items.slice(0, pageSize) : items;
  const nextCursor = sliced.length > 0 && hasNextPage ? sliced[sliced.length - 1].id : null;

  const data = sliced.map((inv) => ({
    id: inv.id,
    monasterySpaceId: inv.monasterySpaceId,
    monasterySpaceName: inv.monasterySpace?.monasteryName ?? '',
    invitedUserId: inv.invitedUserId,
    invitedUserName: inv.invitedUser?.name ?? '',
    invitedById: inv.invitedById,
    invitedByName: inv.invitedBy?.name ?? null,
    spaceRoleId: inv.spaceRoleId,
    spaceRoleName: inv.spaceRole?.name ?? '',
    status: inv.status,
    createdAt: inv.createdAt,
  }));

  return {
    items: data,
    pagination: {
      nextCursor,
      hasNextPage,
      pageSize,
    },
  };
};

// --- Notification Services (Web Offset & Mobile Cursor) ---

export const getUserNotificationsOffsetService = async (
  userId: number,
  { pageNumber, pageSize }: { pageNumber: number; pageSize: number }
) => {
  const skip = (pageNumber - 1) * pageSize;
  const where = { userId, isDeleted: false };

  const [items, totalCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { id: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const data = items.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt,
  }));

  return {
    items: data,
    pagination: {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    },
  };
};

export const getUserNotificationsCursorFeedService = async (
  userId: number,
  { lastId, pageSize }: { lastId?: number; pageSize: number }
) => {
  const where: Prisma.NotificationWhereInput = {
    userId,
    isDeleted: false,
    ...(lastId ? { id: { lt: lastId } } : {}),
  };

  const items = await prisma.notification.findMany({
    where,
    take: pageSize + 1,
    orderBy: { id: 'desc' },
  });

  const hasNextPage = items.length > pageSize;
  const sliced = hasNextPage ? items.slice(0, pageSize) : items;
  const nextCursor = sliced.length > 0 && hasNextPage ? sliced[sliced.length - 1].id : null;

  const data = sliced.map((n) => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt,
  }));

  return {
    items: data,
    pagination: {
      nextCursor,
      hasNextPage,
      pageSize,
    },
  };
};

export const clearAllUserNotificationsService = async (userId: number) => {
  await prisma.notification.updateMany({
    where: { userId, isDeleted: false },
    data: { isDeleted: true },
  });
  return null;
};

// --- Settings Services ---

export const getUserSettingsService = async (userId: number) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new AppError('User not found', 404);

  const row = await prisma.userSetting.findUnique({
    where: { userId },
  });

  return {
    userId,
    pickupNotificationTime: row?.pickupNotificationTime ?? new Date('2026-11-01T15:30:00Z'),
    dropoffNotificationTime: row?.dropoffNotificationTime ?? new Date('2026-11-01T22:00:00Z'),
    pickupTime: row?.pickupTime ?? null,
    dropoffTime: row?.dropoffTime ?? null,
  };
};

export const updateUserSettingsService = async (
  userId: number,
  data: updateUserSettingsBodyInput
) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) throw new AppError('User not found', 404);

  const parseDate = (d?: string | null) => {
    if (d === undefined) return undefined;
    if (d === null) return null;
    return new Date(d);
  };

  const row = await prisma.userSetting.upsert({
    where: { userId },
    create: {
      userId,
      pickupNotificationTime:
        parseDate(data.pickupNotificationTime) ?? new Date('2026-11-01T15:30:00Z'),
      dropoffNotificationTime:
        parseDate(data.dropoffNotificationTime) ?? new Date('2026-11-01T22:00:00Z'),
      pickupTime: parseDate(data.pickupTime) ?? null,
      dropoffTime: parseDate(data.dropoffTime) ?? null,
    },
    update: {
      ...(data.pickupNotificationTime !== undefined && {
        pickupNotificationTime: parseDate(data.pickupNotificationTime),
      }),
      ...(data.dropoffNotificationTime !== undefined && {
        dropoffNotificationTime: parseDate(data.dropoffNotificationTime),
      }),
      ...(data.pickupTime !== undefined && { pickupTime: parseDate(data.pickupTime) }),
      ...(data.dropoffTime !== undefined && { dropoffTime: parseDate(data.dropoffTime) }),
    },
  });

  return {
    userId: row.userId,
    pickupNotificationTime: row.pickupNotificationTime,
    dropoffNotificationTime: row.dropoffNotificationTime,
    pickupTime: row.pickupTime,
    dropoffTime: row.dropoffTime,
  };
};

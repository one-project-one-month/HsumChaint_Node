import type { Prisma } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/utils/AppError';
import { buildListCacheKey, clearUserListCache } from '@/utils/cache.util';
import type { getAllUsersInput, idParamsInput, updateUserBodyInput } from './user.schema';

/**
 * Standard selection object to ensure we don't leak sensitive data
 * like hashed passwords by default.
 */
export const selectUser = {
  id: true,
  phone: true,
  username: true,
  email: true,
  contactPhone: true,
  userType: true,
  createdAt: true,
  avatar: true,
} as const;

// --- Query Services using Redis ---

export const getAllUserService = async (data: getAllUsersInput) => {
  //create a unique fingerprint for specific search
  const cacheKey = buildListCacheKey(data);
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (error) {
    console.error('Redis Get List Error', error);
  }
  const {
    page,
    limit,
    username,
    email,
    phone,
    contactPhone,
    userType,
    monasteryName,
    monasteryAddress,
  } = data;
  const skip = (page - 1) * limit;
  //check the existing data
  const where: Prisma.UserWhereInput = { isDeleted: false };

  // Build filters
  if (username) where.username = { startsWith: username };
  if (phone) where.phone = { startsWith: phone };
  if (email) where.email = { contains: email };
  if (contactPhone) where.contactPhone = { startsWith: contactPhone };
  if (userType) where.userType = userType;
  //create empty object to add both monastery address and monastery name
  // Build Monk Profile filters
  const monkProfileFilter: Prisma.MonkProfileWhereInput = {};
  if (monasteryAddress) monkProfileFilter.monasteryAddress = { startsWith: monasteryAddress };
  if (monasteryName) monkProfileFilter.monasteryName = { startsWith: monasteryName };
  //after collect all data add into where object
  if (Object.keys(monkProfileFilter).length > 0) {
    where.monkProfile = { is: monkProfileFilter };
    // If filtering by monastery but no userType provided, default to Monk
    if (!userType) where.userType = 'Monk';
  }

  // Transaction ensures the count and the data list are in sync
  const [users, totals] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: selectUser,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  const result = { users, totals };
  //save the result to Redis
  try {
    //use shorter time (10mins / 600s) because lists change often
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
    //First, try to get data from Redis
    const cachedUser = await redis.get(cachedKey);
    //when found, convert string back to object
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch {
        await redis.del(cachedKey); // cleanup bad cache
      }
    }
  } catch (error) {
    console.error('Redis Get Error:', error);
  }
  //if not found in cached, get from the database
  const user = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { ...selectUser, monkProfile: true },
  });
  if (!user) throw new AppError('User is not found', 404);
  //update cache background

  try {
    await redis.set(cachedKey, JSON.stringify(user), 'EX', 3600);
  } catch (error) {
    console.error('Redis Set Error:', error);
  }

  return user;
};

export const getMeService = getUserWithProfile;

export const getUserByIdService = ({ id }: idParamsInput) => getUserWithProfile(id);

// --- Mutation Services ---

export const updateUserService = async (id: number, data: updateUserBodyInput) => {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user || user.isDeleted) throw new AppError('User is not found', 404);

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
    ...(data.username !== undefined && { username: data.username }),
    ...(data.email !== undefined && { email: data.email }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(hashedPassword !== undefined && { password: hashedPassword }),
    ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
    ...(data.avatar !== undefined && { avatar: data.avatar }),
  };
  //build monk profile update separately because it belongs to a separate database
  const monkProfileData: Prisma.MonkProfileUpdateInput = {};
  //collet only provide fields (partial update support)
  if (data.monasteryName !== undefined) monkProfileData.monasteryName = data.monasteryName;
  if (data.monasteryAddress !== undefined) monkProfileData.monasteryAddress = data.monasteryAddress;
  // If at least one monastery field is provided, attach nested update

  if (Object.keys(monkProfileData).length > 0) {
    // Business rule: only Monk users are allowed to update monastery info
    if (user.userType !== 'Monk') {
      throw new AppError('Only monks can update monastery info', 400);
    }
    // Prisma nested update for related monkProfile table
    updateData.monkProfile = { update: monkProfileData };
  }
  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { ...selectUser, monkProfile: true },
  });
  //delete the old cache so the next "Get" fetches fresh data
  await redis.del(`user:${id}:profile`); //clear specific profile
  await clearUserListCache(); //clear all search lists
  return updatedUser;
};
//delete user account with soft delete
export const softDeleteUserService = async (data: idParamsInput) => {
  const { id } = data;

  // Verify existence before deleting
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

  //clear cache so a "deleted" user doesn't stay visible in the cache
  await redis.del(`user:${id}:profile`); //clear specific profile
  await clearUserListCache(); //clear all search lists
  return existingUser;
};

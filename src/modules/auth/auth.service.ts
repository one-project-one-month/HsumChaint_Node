import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Prisma } from 'prisma-client';
import { env } from '@/config/env';
import { createAuthSession } from '@/helper/createAuthSession';
import { redis } from '@/lib/redis';
import { getRolePermissions } from '@/middlewares/permissionMiddleware';
import { clearUserListCache } from '@/utils/cache.util';
import type { TokenPayload } from '@/utils/jwt';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import type { LoginInput, RegisterInput, resetPasswordInput } from './auth.schema';

// register
export const registerUser = async (data: RegisterInput) => {
  const phone = data.phone;
  const conditions: Prisma.UserWhereInput[] = [{ phone }];
  if (data.email) {
    conditions.push({ email: data.email });
  }
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: conditions,
      isDeleted: false,
    },
  });
  if (existingUser) {
    throw new AppError('User already exists', 400);
  }
  if (data.contactPhone) {
    const existingContactPhone = await prisma.user.findFirst({
      where: { contactPhone: data.contactPhone },
    });
    if (existingContactPhone) {
      throw new AppError('Contact phone already used', 400);
    }
  }

  // Role ID 1 is Monk in current system state
  if (data.roleId === 1 && (!data.monasteryName || !data.monasteryAddress)) {
    throw new AppError('Monastery name and address are required for Monk users', 400);
  }

  const hashedPassword = await Bun.password.hash(data.password);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        phone,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        roleId: data.roleId,
        contactPhone: data.contactPhone,
        avatar: data.avatar,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        roleId: true,
        createdAt: true,
        contactPhone: true,
        avatar: true,
      },
    });

    let monkProfile = null;
    if (data.roleId === 1 && data.monasteryName && data.monasteryAddress) {
      monkProfile = await tx.monkProfile.create({
        data: {
          userId: user.id,
          monasteryName: data.monasteryName,
          monasteryAddress: data.monasteryAddress,
        },
      });
    }

    const { accessToken, refreshToken } = await createAuthSession(tx, user.id, user.roleId);
    return { accessToken, refreshToken, user, monkProfile };
  });

  const permissions = await getRolePermissions(result.user.roleId);
  const role = await prisma.role.findUnique({
    where: { id: result.user.roleId },
    select: { id: true, name: true },
  });
  const roleName = role?.name || (result.user.roleId === 1 ? 'Monk' : 'Donor');

  // Warm the /me cache immediately after register
  const profileData = {
    ...result.user,
    monkProfile: result.user.roleId === 1 ? result.monkProfile : null,
  };
  try {
    await redis.set(`user:${result.user.id}:profile`, JSON.stringify(profileData), 'EX', 3600);
  } catch (error) {
    console.error('Redis Set Register Cache Error:', error);
  }
  await clearUserListCache();

  return {
    userId: result.user.id,
    name: result.user.name,
    phoneNumber: result.user.phone,
    roleId: result.user.roleId,
    roleName,
    token: result.accessToken,
    refreshToken: result.refreshToken,
    permissions,
    // Backward compatibility aliases
    accessToken: result.accessToken,
    phone: result.user.phone,
    user: profileData,
    monkProfile: result.monkProfile,
  };
};

// login
export const loginUser = async (data: LoginInput) => {
  const phone = data.phone;
  const user = await prisma.user.findUnique({
    where: { phone, isDeleted: false },
    include: { monkProfile: true, role: true },
  });
  if (!user) {
    throw new AppError('Invalid phone or password', 401);
  }
  const isPasswordMatch = await Bun.password.verify(data.password, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid phone or password', 401);
  }

  const { accessToken, refreshToken } = await createAuthSession(prisma, user.id, user.roleId);
  const permissions = await getRolePermissions(user.roleId);
  const roleName =
    user.role?.name || (user.roleId === 1 ? 'Monk' : user.roleId === 2 ? 'Donor' : 'Admin');

  // Warm the /me cache so the first authenticated request is free
  const profileCacheKey = `user:${user.id}:profile`;
  const profileData = {
    id: user.id,
    phone: user.phone,
    phoneNumber: user.phone,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    contactPhone: user.contactPhone,
    avatar: user.avatar,
    createdAt: user.createdAt,
    monkProfile: user.monkProfile,
  };
  try {
    await redis.set(profileCacheKey, JSON.stringify(profileData), 'EX', 3600);
  } catch (error) {
    console.error('Redis Set Login Cache Error:', error);
  }

  return {
    userId: user.id,
    name: user.name,
    phoneNumber: user.phone,
    roleId: user.roleId,
    roleName,
    token: accessToken,
    refreshToken,
    permissions,
    // Backward compatibility aliases
    accessToken,
    phone: user.phone,
    user: profileData,
  };
};

// refresh token
export const refreshTokenService = async (refreshToken: string, expectedUserId?: number) => {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (
    expectedUserId !== undefined &&
    !Number.isNaN(expectedUserId) &&
    payload.userId !== expectedUserId
  ) {
    throw new AppError('Invalid refresh token for provided user', 401);
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      refreshToken,
      userId: payload.userId,
      revokedAt: null,
    },
  });
  if (!storedToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: payload.userId, isDeleted: false },
      select: { roleId: true },
    });
    if (!user) throw new AppError('Invalid refresh token', 401);
    await tx.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });
    const { accessToken, refreshToken: newRefreshToken } = await createAuthSession(
      tx,
      payload.userId,
      user.roleId
    );
    return {
      token: accessToken,
      refreshToken: newRefreshToken,
      accessToken,
    };
  });
};

// logout
export const logoutUser = async (refreshToken: string) => {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const token = await prisma.refreshToken.findFirst({
    where: {
      refreshToken,
      userId: payload.userId,
      revokedAt: null,
    },
  });
  if (!token) {
    throw new AppError('Invalid refresh token', 400);
  }
  await prisma.refreshToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() },
  });

  try {
    await redis.del(`user:${payload.userId}:profile`);
  } catch (error) {
    console.error('Redis Del Logout Cache Error:', error);
  }
  return { message: 'Logged out successfully.' };
};

// forgot password handle
export const forgotPasswordService = async (phone: string) => {
  const user = await prisma.user.findUnique({
    where: { phone },
  });
  if (!user) {
    throw new AppError('User is not found', 404);
  }
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const hashResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      resetToken: hashResetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return { resetToken: rawResetToken, rawResetToken };
};

// reset password handle
export const resetPasswordService = async (result: resetPasswordInput) => {
  const hashedToken = crypto.createHash('sha256').update(result.resetToken).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { resetToken: hashedToken },
  });
  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw new AppError('Invalid or expired token', 400);
  }
  const hashedPassword = await Bun.password.hash(result.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
  ]);

  try {
    await redis.del(`user:${resetToken.userId}:profile`);
  } catch (error) {
    console.error('Redis Del Reset Cache Error:', error);
  }
};

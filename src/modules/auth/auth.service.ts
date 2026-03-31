import crypto from 'node:crypto';
import { env } from '@/config/env';
import { type TokenPayload, generateAccessToken, generateRefreshToken } from '@/utils/jwt';
import jwt from 'jsonwebtoken';
import type { Prisma } from 'prisma-client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import type { LoginInput, RegisterInput, resetPasswordInput } from './auth.schema';
//register
export const registerUser = async (data: RegisterInput) => {
  const conditions: Prisma.UserWhereInput[] = [{ phone: data.phone }];
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
  const hashedPassword = await Bun.password.hash(data.password);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        phone: data.phone,
        username: data.username,
        email: data.email,
        password: hashedPassword,
        userType: data.userType,
        contactPhone: data.contactPhone,
      },
      select: {
        id: true,
        phone: true,
        username: true,
        email: true,
        userType: true,
        createdAt: true,
        contactPhone: true,
      },
    });
    let monkProfile = null;
    //if the use is Monk create monk profile
    if (user.userType === 'Monk') {
      if (!data.monasteryName || !data.monasteryAddress) {
        throw new AppError('Monastery name and address are required for Monk users', 400);
      }
      monkProfile = await tx.monkProfile.create({
        data: {
          userId: user.id,
          monasteryName: data.monasteryName,
          monasteryAddress: data.monasteryAddress,
        },
      });
    }
    //create tokens for auto login after register
    const accessToken = generateAccessToken({
      userId: user.id,
      userType: user.userType,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      userType: user.userType,
    });
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken, user, monkProfile };
  });
  return result;
};
//login
export const loginUser = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { phone: data.phone, isDeleted: false },
    include: { monkProfile: true }, //will be null for donor
  });
  if (!user) {
    throw new AppError('Invalid phone or password', 401);
  }
  const isPasswordMatch = await Bun.password.verify(data.password, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid phone or password', 401);
  }
  const accessToken = generateAccessToken({
    userId: user.id,
    userType: user.userType,
  });
  const refreshToken = generateRefreshToken({
    userId: user.id,
    userType: user.userType,
  });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username,
      email: user.email,
      userType: user.userType,
      //if the user is Monk, return the monkProfile
      monkProfile: user.userType === 'Monk' ? user.monkProfile : null,
    },
  };
};
//refresh token
export const refreshTokenService = async (refreshToken: string) => {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
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
  //create new access token
  const newAccessToken = generateAccessToken({
    userId: payload.userId,
    userType: payload.userType,
  });
  //generate new refresh token
  const newRefreshToken = generateRefreshToken({
    userId: payload.userId,
    userType: payload.userType,
  });
  //not to lose user session, create DB transactions to revoke new token and to create new token
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};
//logout
export const logoutUser = async (refreshToken: string) => {
  let payload: TokenPayload;
  //decodes jwt and stores it in payload
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  //include userId check to prevent edge-case abuse
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
  return { message: 'Logout successfully' };
};
//forgot password handle
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
  return { rawResetToken };
};
//reset password handle
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
};

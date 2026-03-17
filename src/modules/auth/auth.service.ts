import { env } from '@/config/env';
import { type TokenPayload, generateAccessToken, generateRefreshToken } from '@/utils/jwt';
import jwt from 'jsonwebtoken';
import type { Prisma } from 'prisma-client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import type { LoginInput, RegisterInput } from './auth.schema';
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
  const hashedPassword = await Bun.password.hash(data.password);
  const user = await prisma.user.create({
    data: {
      ...data,
      password: hashedPassword,
    },
    select: {
      id: true,
      phone: true,
      username: true,
      email: true,
      userType: true,
      createdAt: true,
    },
  });
  return user;
};
//login
export const loginUser = async (data: LoginInput) => {
  const user = await prisma.user.findFirst({
    where: { phone: data.phone, isDeleted: false },
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

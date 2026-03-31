import { type TokenPayload, generateAccessToken, generateRefreshToken } from '@/utils/jwt';
import type { Prisma } from 'prisma-client';
import type { prisma } from '../lib/prisma';
/**
 * helper: generate a session(accessToken + refreshToken ) and stores refreshToken in database
 */
export const createAuthSession = async (
  tx: Prisma.TransactionClient | typeof prisma,
  userId: TokenPayload['userId'],
  userType: TokenPayload['userType']
) => {
  const accessToken = generateAccessToken({ userId, userType });
  const refreshToken = generateRefreshToken({ userId, userType });
  await tx.refreshToken.create({
    data: {
      userId,
      refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken };
};

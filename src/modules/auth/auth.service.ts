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
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  RequestRegistrationOtpInput,
  ResetPasswordInput,
} from './auth.schema';
import { OtpChannel, OtpPurpose, requestOtpService, verifyOtpService } from './otp.service';

// 1.1 Request Registration OTP
export const requestRegistrationOtpService = async (data: RequestRegistrationOtpInput) => {
  const destination = data.destination;
  const existing = await prisma.user.findFirst({
    where: {
      email: destination,
      isDeleted: false,
      emailVerifiedAt: { not: null },
    },
  });
  if (existing) {
    throw new AppError('A user with this identifier already exists.', 400);
  }
  return await requestOtpService({
    destination,
    channel: OtpChannel.EMAIL,
    purpose: OtpPurpose.VERIFY_EMAIL,
  });
};

// 1. Register User (with Atomic Verification & Auto-Login)
export const registerUser = async (data: RegisterInput) => {
  // Reject registering as protected role (Admin, roleId: 1)
  if (data.roleId === 1) {
    throw new AppError('Forbidden', 403);
  }

  // Reject donor attempting to add monastery details (roleId: 3)
  if (
    data.roleId === 3 &&
    ((data.monasteryName && data.monasteryName.trim() !== '') ||
      (data.monasteryAddress && data.monasteryAddress.trim() !== ''))
  ) {
    throw new AppError('Donors cannot have monastery name or monastery address', 400);
  }

  // Role ID 2 is Monk
  if (data.roleId === 2 && (!data.monasteryName || !data.monasteryAddress)) {
    throw new AppError('Monastery name and address are required for Monk users', 400);
  }

  const phone = data.phoneNumber;
  const contactPhone = data.contactPhoneNumber;
  const email = data.email;

  // Active Login Mode checks
  const activeMode = await prisma.loginMode?.findFirst({
    where: { isActive: true },
  });

  if (activeMode?.code === 'PHONE_ONLY' && !phone) {
    throw new AppError('Phone number is required for phone-only registration.', 400);
  }
  if (activeMode?.code === 'EMAIL_ONLY' && !email) {
    throw new AppError('Email is required for email-only registration.', 400);
  }
  if (activeMode?.code === 'PHONE_OR_EMAIL' && !phone && !email) {
    throw new AppError('Either phone number or email is required.', 400);
  }

  // Atomic OTP verification if requireEmailVerification is active or OTP was supplied
  let isEmailVerified = false;
  if (email && (data.otp || activeMode?.requireEmailVerification)) {
    if (!data.otp) {
      throw new AppError('Invalid or expired OTP.', 400);
    }
    await verifyOtpService({
      destination: email,
      channel: OtpChannel.EMAIL,
      purpose: OtpPurpose.VERIFY_EMAIL,
      code: data.otp,
    });
    isEmailVerified = true;
  }

  // Check existing users
  let abandonedUser: { id: number; emailVerifiedAt: Date | null } | null = null;
  if (email) {
    const existingWithEmail = await prisma.user.findFirst({
      where: { email, isDeleted: false },
    });
    if (existingWithEmail) {
      if (existingWithEmail.emailVerifiedAt !== null) {
        throw new AppError('A user with this identifier already exists.', 400);
      }
      // Abandoned registration recovery case
      abandonedUser = existingWithEmail;
    }
  }

  if (phone) {
    const existingWithPhone = await prisma.user.findFirst({
      where: { phone, isDeleted: false },
    });
    if (existingWithPhone && existingWithPhone.id !== abandonedUser?.id) {
      throw new AppError('Phone number already exists.', 400);
    }
  }

  if (contactPhone) {
    const existingContactPhone = await prisma.user.findFirst({
      where: { contactPhone },
    });
    if (existingContactPhone && existingContactPhone.id !== abandonedUser?.id) {
      throw new AppError('Contact phone already used', 400);
    }
  }

  const hashedPassword = await Bun.password.hash(data.password);
  const emailVerifiedAt = isEmailVerified ? new Date() : (abandonedUser?.emailVerifiedAt ?? null);

  type SelectedUser = {
    id: number;
    phone: string | null;
    name: string;
    email: string | null;
    roleId: number;
    createdAt: Date;
    contactPhone: string | null;
    avatar: string | null;
  };

  const result = await prisma.$transaction(async (tx) => {
    let user: SelectedUser;
    if (abandonedUser) {
      user = await tx.user.update({
        where: { id: abandonedUser.id },
        data: {
          phone,
          name: data.name,
          email,
          password: hashedPassword,
          roleId: data.roleId,
          contactPhone: contactPhone ?? null,
          avatar: data.avatar,
          emailVerifiedAt,
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
    } else {
      user = await tx.user.create({
        data: {
          phone,
          name: data.name,
          email,
          password: hashedPassword,
          roleId: data.roleId,
          contactPhone: contactPhone ?? null,
          avatar: data.avatar,
          emailVerifiedAt,
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
    }

    let monkProfile = null;
    if (data.roleId === 2 && data.monasteryName && data.monasteryAddress) {
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
  const roleName = role?.name || (result.user.roleId === 2 ? 'Monk' : 'Donor');

  // Warm the /me cache immediately after register
  const profileData = {
    ...result.user,
    monkProfile: result.user.roleId === 2 ? result.monkProfile : null,
  };
  try {
    await redis.set(`user:${result.user.id}:profile`, JSON.stringify(profileData), 'EX', 3600);
  } catch (error) {
    console.error('Redis Set Register Cache Error:', error);
  }
  await clearUserListCache();

  return {
    id: result.user.id,
    roleId: result.user.roleId,
    roleName,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    permissions,
  };
};

// 2. Login User
export const loginUser = async (data: LoginInput) => {
  const identifier = data.identifier || data.phoneNumber || '';
  if (!identifier) {
    throw new AppError('Phone number or password incorrect!', 400);
  }

  const isEmail = identifier.includes('@');

  // Check Active Login Mode
  const activeMode = await prisma.loginMode?.findFirst({
    where: { isActive: true },
  });

  if (activeMode?.code === 'PHONE_ONLY' && isEmail) {
    throw new AppError('Active login mode does not permit email login.', 400);
  }
  if (activeMode?.code === 'EMAIL_ONLY' && !isEmail) {
    throw new AppError('Active login mode does not permit phone login.', 400);
  }

  const user = isEmail
    ? await prisma.user.findUnique({
        where: { email_isDeleted: { email: identifier.toLowerCase(), isDeleted: false } },
        include: { monkProfile: true, role: true },
      })
    : await prisma.user.findUnique({
        where: { phone_isDeleted: { phone: identifier, isDeleted: false } },
        include: { monkProfile: true, role: true },
      });

  if (!user) {
    throw new AppError('Phone number or password incorrect!', 400);
  }

  const isPasswordMatch = await Bun.password.verify(data.password, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Phone number or password incorrect!', 400);
  }

  // Verification requirement check
  if (activeMode?.requireEmailVerification && isEmail && !user.emailVerifiedAt) {
    throw new AppError('Identifier verification is required.', 400);
  }

  const { accessToken, refreshToken } = await createAuthSession(prisma, user.id, user.roleId);
  const permissions = await getRolePermissions(user.roleId);
  const roleName =
    user.role?.name || (user.roleId === 1 ? 'Admin' : user.roleId === 2 ? 'Monk' : 'Donor');

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

  // Exact .NET response contract
  return {
    id: user.id,
    roleId: user.roleId,
    roleName,
    permissions,
    accessToken,
    refreshToken,
  };
};

// 3. Refresh Token
export const refreshTokenService = async (refreshToken: string, expectedUserId?: number) => {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    throw new AppError('Invalid or expired Refresh Token', 400);
  }

  if (
    expectedUserId !== undefined &&
    !Number.isNaN(expectedUserId) &&
    payload.userId !== expectedUserId
  ) {
    throw new AppError('Invalid or expired Refresh Token', 400);
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      refreshToken,
      userId: payload.userId,
      revokedAt: null,
    },
  });
  if (!storedToken) {
    throw new AppError('Invalid or expired Refresh Token', 400);
  }

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: payload.userId, isDeleted: false },
      include: { role: true },
    });
    if (!user) throw new AppError('Invalid or expired Refresh Token', 400);

    await tx.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefreshToken } = await createAuthSession(
      tx,
      payload.userId,
      user.roleId
    );

    const permissions = await getRolePermissions(user.roleId);
    const roleName =
      user.role?.name || (user.roleId === 1 ? 'Admin' : user.roleId === 2 ? 'Monk' : 'Donor');

    // Exact .NET response contract
    return {
      id: user.id,
      roleId: user.roleId,
      roleName,
      permissions,
      accessToken,
      refreshToken: newRefreshToken,
    };
  });
};

// Logout
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

// 2.1 Get Active Login Mode Configuration
export const getLoginModeService = async () => {
  const mode = await prisma.loginMode?.findFirst({
    where: { isActive: true },
  });
  return {
    code: mode?.code ?? 'phone_or_email',
    requirePhoneVerification: mode?.requirePhoneVerification ?? false,
    requireEmailVerification: mode?.requireEmailVerification ?? true,
  };
};

// 3.1 Forgot Password (Request Reset OTP)
export const forgotPasswordService = async (data: ForgotPasswordInput) => {
  const trimmed = (data.destination || data.phoneNumber || '').trim();
  if (!trimmed) {
    throw new AppError('Destination or phone number is required', 400);
  }
  const isEmail = trimmed.includes('@');

  const conditions: Prisma.UserWhereInput[] = [];
  if (isEmail) {
    conditions.push({ email: trimmed.toLowerCase() });
  } else {
    conditions.push({ phone: trimmed });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: conditions,
      isDeleted: false,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.email) {
    const otpResult = await requestOtpService({
      destination: user.email,
      channel: OtpChannel.EMAIL,
      purpose: OtpPurpose.RESET_PASSWORD,
      userId: user.id,
    });
    return {
      expiresAt: otpResult.expiresAt,
      resendCooldownSeconds: otpResult.resendCooldownSeconds,
      otp: otpResult.otp,
    };
  }

  // Legacy fallback if user has no email
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

// 3.2 Reset Password
export const resetPasswordService = async (data: ResetPasswordInput) => {
  if (data.email && data.otp && data.newPassword) {
    await verifyOtpService({
      destination: data.email,
      channel: OtpChannel.EMAIL,
      purpose: OtpPurpose.RESET_PASSWORD,
      code: data.otp,
    });

    const user = await prisma.user.findFirst({
      where: { email: data.email.toLowerCase(), isDeleted: false },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const hashedPassword = await Bun.password.hash(data.newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    try {
      await redis.del(`user:${user.id}:profile`);
    } catch (error) {
      console.error('Redis Del Reset Cache Error:', error);
    }
    return;
  }

  if (data.resetToken && data.password) {
    const hashedToken = crypto.createHash('sha256').update(data.resetToken).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { resetToken: hashedToken },
    });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new AppError('Invalid or expired token', 400);
    }
    const hashedPassword = await Bun.password.hash(data.password);
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
  }
};

// 3.3 Request Change Password OTP
export const requestChangePasswordOtpService = async (userId: number) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (!user.email) {
    throw new AppError('User has no registered email', 400);
  }

  return await requestOtpService({
    destination: user.email,
    channel: OtpChannel.EMAIL,
    purpose: OtpPurpose.CHANGE_PASSWORD,
    userId: user.id,
  });
};

// 3.4 Change Password
export const changePasswordService = async (userId: number, data: ChangePasswordInput) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await Bun.password.verify(data.currentPassword, user.password);
  if (!isMatch) {
    throw new AppError('Current password incorrect', 400);
  }

  if (data.currentPassword === data.newPassword) {
    throw new AppError('New password cannot be the same as current password', 400);
  }

  if (!user.email) {
    throw new AppError('User has no registered email', 400);
  }

  await verifyOtpService({
    destination: user.email,
    channel: OtpChannel.EMAIL,
    purpose: OtpPurpose.CHANGE_PASSWORD,
    code: data.otp,
  });

  const hashedPassword = await Bun.password.hash(data.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  try {
    await redis.del(`user:${user.id}:profile`);
  } catch (error) {
    console.error('Redis Del Change Password Cache Error:', error);
  }
};

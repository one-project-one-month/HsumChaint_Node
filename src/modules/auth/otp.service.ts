import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import { generateSnowflakeId } from '@/utils/snowflake';
import { sendOtpEmail } from './email.service';

export const OtpChannel = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
} as const;
export type OtpChannel = (typeof OtpChannel)[keyof typeof OtpChannel];

export const OtpPurpose = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  VERIFY_PHONE: 'VERIFY_PHONE',
  LOGIN: 'LOGIN',
  RESET_PASSWORD: 'RESET_PASSWORD',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const OTP_EXPIRY_MINUTES = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_ATTEMPT_COUNT = 5;

export const normalizeDestination = (destination: string, channel: OtpChannel): string => {
  const trimmed = destination.trim();
  if (channel === OtpChannel.EMAIL) {
    return trimmed.toLowerCase();
  }
  return trimmed;
};

export const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export interface RequestOtpParams {
  destination: string;
  channel?: OtpChannel;
  purpose: OtpPurpose;
  userId?: number;
}

export interface RequestOtpResult {
  expiresAt: Date;
  resendCooldownSeconds: number;
  otp?: string;
}

export const requestOtpService = async (params: RequestOtpParams): Promise<RequestOtpResult> => {
  const channel = params.channel ?? OtpChannel.EMAIL;

  if (channel === OtpChannel.PHONE) {
    throw new AppError('Phone verification is currently not available', 400);
  }

  const destination = normalizeDestination(params.destination, channel);
  const now = new Date();

  // 1. Check resend cooldown (60 seconds)
  const latestOtp = await prisma.otpCode.findFirst({
    where: {
      destination,
      channel,
      purpose: params.purpose,
      isUsed: false,
      revokedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (latestOtp) {
    const elapsedSeconds = Math.floor((now.getTime() - latestOtp.createdAt.getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw new AppError(
        `Please wait ${RESEND_COOLDOWN_SECONDS - elapsedSeconds} seconds before requesting a new OTP`,
        400
      );
    }
  }

  // 2. Revoke any previous unused OTPs for the same destination + channel + purpose
  await prisma.otpCode.updateMany({
    where: {
      destination,
      channel,
      purpose: params.purpose,
      isUsed: false,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  // 3. Generate 6-digit numeric OTP and hash it
  const plainOtp = generateOtpCode();
  const codeHash = await Bun.password.hash(plainOtp);
  const id = generateSnowflakeId();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // 4. Save to Otp_Code table
  await prisma.otpCode.create({
    data: {
      id,
      userId: params.userId ?? null,
      channel,
      purpose: params.purpose,
      destination,
      codeHash,
      expiresAt,
      isUsed: false,
      failedAttemptCount: 0,
      maxAttemptCount: MAX_ATTEMPT_COUNT,
    },
  });

  // 5. Send Email
  if (channel === OtpChannel.EMAIL) {
    await sendOtpEmail({
      to: destination,
      otp: plainOtp,
      purpose: params.purpose,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
  }

  return {
    expiresAt,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    otp: process.env.NODE_ENV !== 'production' ? plainOtp : undefined,
  };
};

export interface VerifyOtpParams {
  destination: string;
  channel?: OtpChannel;
  purpose: OtpPurpose;
  code: string;
}

export interface VerifyOtpResult {
  valid: boolean;
  userId?: number | null;
  destination: string;
}

export const verifyOtpService = async (params: VerifyOtpParams): Promise<VerifyOtpResult> => {
  const channel = params.channel ?? OtpChannel.EMAIL;
  const destination = normalizeDestination(params.destination, channel);
  const now = new Date();

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      destination,
      channel,
      purpose: params.purpose,
      isUsed: false,
      revokedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    throw new AppError('Invalid or expired OTP.', 400);
  }

  // Check if expired
  if (otpRecord.expiresAt.getTime() <= now.getTime()) {
    throw new AppError('Invalid or expired OTP.', 400);
  }

  // Check max attempts reached
  if (otpRecord.failedAttemptCount >= otpRecord.maxAttemptCount) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { revokedAt: now },
    });
    throw new AppError('Invalid or expired OTP.', 400);
  }

  // Verify hash
  const isMatch = await Bun.password.verify(params.code.trim(), otpRecord.codeHash);

  if (!isMatch) {
    const nextFailedCount = otpRecord.failedAttemptCount + 1;
    const isLocked = nextFailedCount >= otpRecord.maxAttemptCount;

    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: {
        failedAttemptCount: nextFailedCount,
        ...(isLocked ? { revokedAt: now } : {}),
      },
    });

    throw new AppError('Invalid or expired OTP.', 400);
  }

  // Successful verification
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: {
      isUsed: true,
      usedAt: now,
    },
  });

  return {
    valid: true,
    userId: otpRecord.userId,
    destination: otpRecord.destination,
  };
};

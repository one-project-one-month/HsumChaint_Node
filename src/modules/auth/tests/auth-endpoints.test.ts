import { describe, expect, it, mock } from 'bun:test';
import type { Request, Response } from 'express';

const mockUsers: Array<{
  id: number;
  email: string | null;
  phone: string | null;
  isDeleted: boolean;
  emailVerifiedAt: Date | null;
}> = [];

type OtpRecord = {
  id: bigint;
  userId: number | null;
  channel: string;
  purpose: string;
  destination: string;
  codeHash: string;
  expiresAt: Date;
  isUsed: boolean;
  usedAt: Date | null;
  revokedAt: Date | null;
  failedAttemptCount: number;
  maxAttemptCount: number;
  createdAt: Date;
};
const mockOtps: OtpRecord[] = [];

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(
        async ({ where }: { where: { email?: string; phone?: string; isDeleted?: boolean } }) => {
          return (
            mockUsers.find(
              (u) =>
                (where.email === undefined || u.email === where.email) &&
                (where.phone === undefined || u.phone === where.phone) &&
                (where.isDeleted === undefined || u.isDeleted === where.isDeleted)
            ) ?? null
          );
        }
      ),
    },
    otpCode: {
      create: mock(
        async ({ data }: { data: Omit<OtpRecord, 'createdAt' | 'usedAt' | 'revokedAt'> }) => {
          const record: OtpRecord = {
            ...data,
            usedAt: null,
            revokedAt: null,
            createdAt: new Date(),
          };
          mockOtps.push(record);
          return record;
        }
      ),
      findFirst: mock(
        async ({
          where,
        }: {
          where: {
            destination: string;
            channel: string;
            purpose: string;
            isUsed?: boolean;
            revokedAt?: null;
          };
        }) => {
          return (
            mockOtps
              .slice()
              .reverse()
              .find(
                (r) =>
                  r.destination === where.destination &&
                  r.channel === where.channel &&
                  r.purpose === where.purpose &&
                  (where.isUsed === undefined || r.isUsed === where.isUsed) &&
                  (where.revokedAt === undefined || r.revokedAt === null)
              ) ?? null
          );
        }
      ),
      update: mock(async ({ where, data }: { where: { id: bigint }; data: Partial<OtpRecord> }) => {
        const rec = mockOtps.find((r) => r.id === where.id);
        if (!rec) throw new Error('Not found');
        Object.assign(rec, data);
        return rec;
      }),
      updateMany: mock(async () => ({ count: 0 })),
    },
  },
}));

mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(async () => null),
    set: mock(async () => 'OK'),
    del: mock(async () => 1),
  },
}));

const { requestRegistrationOtp, requestOtp, verifyOtp } = await import('../auth.controller');
const { OtpChannel, OtpPurpose } = await import('../otp.service');

interface MockResponse {
  statusCode: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  cookies: Record<string, unknown>;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  setHeader: (name: string, val: string) => MockResponse;
  cookie: (name: string, val: unknown) => MockResponse;
  clearCookie: (name: string) => MockResponse;
}

const createMockRes = (): Response & MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    body: {},
    headers: {},
    cookies: {},
    status: mock((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: mock((payload: unknown) => {
      res.body = payload as Record<string, unknown>;
      return res;
    }),
    setHeader: mock((name: string, val: string) => {
      res.headers[name] = val;
      return res;
    }),
    cookie: mock((name: string, val: unknown) => {
      res.cookies[name] = val;
      return res;
    }),
    clearCookie: mock((name: string) => {
      delete res.cookies[name];
      return res;
    }),
  };
  return res as unknown as Response & MockResponse;
};

describe('Authentication & Token Management Endpoints', () => {
  it('1.1 POST /api/v1/auth/register/request-otp sends registration OTP', async () => {
    const req = {
      body: { destination: 'newmonk@hsumchaint.org' },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock(() => {});

    await requestRegistrationOtp(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.message).toBe('OTP has been sent.');
    expect((res.body.data as Record<string, unknown>).resendCooldownSeconds).toBe(60);
  });

  it('3.5 POST /api/v1/auth/otp/request and /api/v1/auth/otp/verify works end-to-end', async () => {
    const reqReq = {
      body: {
        destination: 'generic@hsumchaint.org',
        channel: OtpChannel.EMAIL,
        purpose: OtpPurpose.VERIFY_EMAIL,
      },
    } as unknown as Request;
    const resReq = createMockRes();
    const next = mock(() => {});

    await requestOtp(reqReq, resReq, next);
    expect(resReq.statusCode).toBe(200);
    const otpData = resReq.body.data as { otp: string };
    expect(otpData.otp).toBeDefined();

    // Verify OTP
    const reqVer = {
      body: {
        destination: 'generic@hsumchaint.org',
        channel: OtpChannel.EMAIL,
        purpose: OtpPurpose.VERIFY_EMAIL,
        code: otpData.otp,
      },
    } as unknown as Request;
    const resVer = createMockRes();

    await verifyOtp(reqVer, resVer, next);
    expect(resVer.statusCode).toBe(200);
    expect(resVer.body.isSuccess).toBe(true);
    expect(resVer.body.message).toBe('OTP verified successfully.');
  });
});

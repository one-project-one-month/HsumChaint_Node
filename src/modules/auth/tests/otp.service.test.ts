import { expect, mock, test } from 'bun:test';

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

const otpStore: OtpRecord[] = [];

mock.module('@/lib/prisma', () => ({
  prisma: {
    otpCode: {
      create: mock(
        async ({ data }: { data: Omit<OtpRecord, 'createdAt' | 'usedAt' | 'revokedAt'> }) => {
          const record: OtpRecord = {
            ...data,
            usedAt: null,
            revokedAt: null,
            createdAt: new Date(),
          };
          otpStore.push(record);
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
            otpStore
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
        const rec = otpStore.find((r) => r.id === where.id);
        if (!rec) throw new Error('OTP record not found');
        Object.assign(rec, data);
        return rec;
      }),
      updateMany: mock(
        async ({
          where,
          data,
        }: {
          where: {
            destination: string;
            channel: string;
            purpose: string;
            isUsed?: boolean;
            revokedAt?: null;
          };
          data: Partial<OtpRecord>;
        }) => {
          let count = 0;
          for (const rec of otpStore) {
            if (
              rec.destination === where.destination &&
              rec.channel === where.channel &&
              rec.purpose === where.purpose &&
              (where.isUsed === undefined || rec.isUsed === where.isUsed) &&
              (where.revokedAt === undefined || rec.revokedAt === null)
            ) {
              Object.assign(rec, data);
              count++;
            }
          }
          return { count };
        }
      ),
    },
  },
}));

const {
  OtpChannel,
  OtpPurpose,
  generateOtpCode,
  normalizeDestination,
  requestOtpService,
  verifyOtpService,
} = await import('../otp.service');
const { getOtpEmailSubject, renderOtpEmailHtml } = await import('../email.service');

test('generateOtpCode generates a 6-digit numeric string', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  }
});

test('normalizeDestination converts emails to lowercase', () => {
  expect(normalizeDestination('  User@Example.COM  ', OtpChannel.EMAIL)).toBe('user@example.com');
  expect(normalizeDestination(' 09123456789 ', OtpChannel.PHONE)).toBe('09123456789');
});

test('requestOtpService rejects PHONE channel with 400 Bad Request', async () => {
  expect(
    requestOtpService({
      destination: '09123456789',
      channel: OtpChannel.PHONE,
      purpose: OtpPurpose.VERIFY_PHONE,
    })
  ).rejects.toThrow('Phone verification is currently not available');
});

test('requestOtpService successfully creates and returns OTP details', async () => {
  const result = await requestOtpService({
    destination: 'donor@hsumchaint.org',
    purpose: OtpPurpose.VERIFY_EMAIL,
  });

  expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  expect(result.resendCooldownSeconds).toBe(60);
  expect(result.otp).toBeDefined();

  const stored = otpStore.find((r) => r.destination === 'donor@hsumchaint.org');
  expect(stored).toBeDefined();
  expect(stored?.codeHash).not.toBe(result.otp); // plain OTP is never stored
});

test('requestOtpService enforces 60-second resend cooldown', async () => {
  expect(
    requestOtpService({
      destination: 'donor@hsumchaint.org',
      purpose: OtpPurpose.VERIFY_EMAIL,
    })
  ).rejects.toThrow('Please wait');
});

test('verifyOtpService successfully verifies valid OTP and marks it used', async () => {
  // Clear cooldown by setting past date
  const stored = otpStore.find((r) => r.destination === 'donor@hsumchaint.org');
  if (stored) {
    stored.createdAt = new Date(Date.now() - 65 * 1000);
  }

  const newOtp = await requestOtpService({
    destination: 'donor@hsumchaint.org',
    purpose: OtpPurpose.VERIFY_EMAIL,
  });

  const verified = await verifyOtpService({
    destination: 'donor@hsumchaint.org',
    purpose: OtpPurpose.VERIFY_EMAIL,
    code: newOtp.otp ?? '',
  });

  expect(verified.valid).toBe(true);
  expect(verified.destination).toBe('donor@hsumchaint.org');

  const record = otpStore.find((r) => r.destination === 'donor@hsumchaint.org' && r.isUsed);
  expect(record?.isUsed).toBe(true);
  expect(record?.usedAt).toBeDefined();
});

test('verifyOtpService increments failedAttemptCount and locks after 5 attempts', async () => {
  await requestOtpService({
    destination: 'locked@hsumchaint.org',
    purpose: OtpPurpose.VERIFY_EMAIL,
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    expect(
      verifyOtpService({
        destination: 'locked@hsumchaint.org',
        purpose: OtpPurpose.VERIFY_EMAIL,
        code: '000000', // wrong code
      })
    ).rejects.toThrow('Invalid or expired OTP.');
  }

  const record = otpStore.find((r) => r.destination === 'locked@hsumchaint.org');
  expect(record?.failedAttemptCount).toBe(4);
  expect(record?.revokedAt).toBeNull();

  // 5th attempt locks and revokes
  expect(
    verifyOtpService({
      destination: 'locked@hsumchaint.org',
      purpose: OtpPurpose.VERIFY_EMAIL,
      code: '000000',
    })
  ).rejects.toThrow('Invalid or expired OTP.');

  expect(record?.failedAttemptCount).toBe(5);
  expect(record?.revokedAt).toBeDefined();
});

test('verifyOtpService rejects expired OTP', async () => {
  const expiredOtp = await requestOtpService({
    destination: 'expired@hsumchaint.org',
    purpose: OtpPurpose.VERIFY_EMAIL,
  });

  const record = otpStore.find((r) => r.destination === 'expired@hsumchaint.org');
  if (record) {
    record.expiresAt = new Date(Date.now() - 1000);
  }

  expect(
    verifyOtpService({
      destination: 'expired@hsumchaint.org',
      purpose: OtpPurpose.VERIFY_EMAIL,
      code: expiredOtp.otp ?? '',
    })
  ).rejects.toThrow('Invalid or expired OTP.');
});

test('email service renders correct subject and HTML template', () => {
  expect(getOtpEmailSubject(OtpPurpose.VERIFY_EMAIL)).toBe('Verify your HsumChaint email');
  expect(getOtpEmailSubject(OtpPurpose.RESET_PASSWORD)).toBe('Reset your HsumChaint password');

  const html = renderOtpEmailHtml({ otp: '123456', expiryMinutes: 5 });
  expect(html).toContain('123456');
  expect(html).toContain('5 minutes');
});

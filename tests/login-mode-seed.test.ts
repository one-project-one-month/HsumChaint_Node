import { expect, mock, test } from 'bun:test';

type LoginModeRow = {
  id?: number;
  code: string;
  displayName: string;
  isActive: boolean;
  requirePhoneVerification: boolean;
  requireEmailVerification: boolean;
};

const loginModes: LoginModeRow[] = [];

mock.module('@/lib/prisma', () => ({
  prisma: {
    loginMode: {
      upsert: mock(
        async ({
          where,
          update,
          create,
        }: {
          where: { code: string };
          update: Partial<LoginModeRow>;
          create: LoginModeRow;
        }) => {
          const existing = loginModes.find((m) => m.code === where.code);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const created = { id: loginModes.length + 1, ...create };
          loginModes.push(created);
          return created;
        }
      ),
      findFirst: mock(async ({ where }: { where?: { isActive?: boolean; code?: string } }) => {
        if (where?.isActive !== undefined) {
          return loginModes.find((m) => m.isActive === where.isActive) ?? null;
        }
        if (where?.code !== undefined) {
          return loginModes.find((m) => m.code === where.code) ?? null;
        }
        return loginModes[0] ?? null;
      }),
    },
  },
}));

const { LOGIN_MODES, seedLoginModes } = await import('../prisma/seed');

test('seedLoginModes seeds exactly 3 core login modes', async () => {
  expect(LOGIN_MODES.length).toBe(3);
  await seedLoginModes();

  expect(loginModes.length).toBe(3);
  expect(loginModes.map((m) => m.code)).toEqual(['PHONE_ONLY', 'EMAIL_ONLY', 'PHONE_OR_EMAIL']);
});

test('exactly one login mode is active by default (PHONE_OR_EMAIL)', async () => {
  const activeModes = loginModes.filter((m) => m.isActive);
  expect(activeModes.length).toBe(1);
  expect(activeModes[0].code).toBe('PHONE_OR_EMAIL');
});

test('phone verification is strictly false across all modes', async () => {
  for (const mode of loginModes) {
    expect(mode.requirePhoneVerification).toBe(false);
  }
});

test('email verification is required for EMAIL_ONLY and PHONE_OR_EMAIL', async () => {
  const emailOnly = loginModes.find((m) => m.code === 'EMAIL_ONLY');
  const phoneOrEmail = loginModes.find((m) => m.code === 'PHONE_OR_EMAIL');
  const phoneOnly = loginModes.find((m) => m.code === 'PHONE_ONLY');

  expect(emailOnly?.requireEmailVerification).toBe(true);
  expect(phoneOrEmail?.requireEmailVerification).toBe(true);
  expect(phoneOnly?.requireEmailVerification).toBe(false);
});

test('seedLoginModes is idempotent (upsert updates without duplicating)', async () => {
  await seedLoginModes();
  expect(loginModes.length).toBe(3);
});

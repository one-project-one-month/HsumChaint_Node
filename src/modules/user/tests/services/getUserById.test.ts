import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { type User, UserType } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import { getUserByIdService } from '../../user.service';

/**
 * UNIT TEST STRATEGY: Module Mocking
 *
 * Converted from integration test (real DB) to unit test (mocked Prisma).
 * Why? We want to test ONLY the logic inside getUserByIdService in isolation —
 * no real DB connection needed, tests run faster and never leave dirty data.
 *
 * How it works:
 *  1. mock.module() replaces the entire "@/lib/prisma" import with a fake
 *     before any test runs. findUnique must be a real function, not a value.
 *  2. spyOn() wraps the fake so we can control its return value per-test
 *     with mockResolvedValue() and assert how it was called.
 *  3. Each test sets its own fake return value to simulate a specific DB state
 *     (found user, null, soft-deleted, etc.) — no seed/cleanup needed at all.
 */

// Mock Redis BEFORE any service imports resolve
// Without this, the service hits the real Redis in Docker and returns
// cached data, making it impossible to test the DB fallback path.
mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(() => Promise.resolve(null)), // simulate cache miss every time
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
  },
}));
mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      // Placeholder — spyOn below will override the return value per test
      findFirst: mock(() => Promise.resolve(null)),
    },
  },
}));

// Attach spy AFTER mock.module() so it wraps the already-mocked function.
// This gives us mockResolvedValue() and call-assertion abilities per test.
const findFirstMock = spyOn(prisma.user, 'findFirst');

/**
 * Shared mock data — mirrors what the real DB would return.
 * Donor has no monkProfile (null), Monk has a nested monkProfile object.
 * We reuse these across tests instead of seeding/cleaning a real DB.
 */

const mockDonor = {
  id: 1,
  phone: '09111111111',
  username: 'test_donor',
  email: 'donor@test.com',
  userType: UserType.Monk,
  isDeleted: false,
  monkProfile: null, // Donors never have a monkProfile
};

const mockMonk = {
  id: 2,
  phone: '09222222222',
  username: 'test_monk',
  email: 'monk@test.com',
  userType: UserType.Monk,
  isDeleted: false,
  monkProfile: {
    monasteryName: 'Golden Monastery',
    monasteryAddress: 'Yangon',
  },
};

describe('getUserByIdService Unit Test (Mocking)', () => {
  // Reset call history and return values between tests to prevent bleed-over.
  // Without this, a mockResolvedValue() from one test could affect the next.
  beforeEach(() => {
    findFirstMock.mockClear();
  });

  // Happy path for Monks: verifies the service returns the user AND
  // correctly exposes the nested monkProfile relation.
  it('should return user with monkProfile when user is a Monk', async () => {
    findFirstMock.mockResolvedValue(mockMonk as unknown as User); // fake: DB found the monk

    const result = await getUserByIdService({ id: mockMonk.id });

    expect(result).not.toBeNull();
    expect(result?.username).toBe('test_monk');
    expect(result?.monkProfile?.monasteryName).toBe('Golden Monastery');
  });

  // Happy path for Donors: verifies the service returns the user,
  // and that monkProfile is null since Donors have no profile row.
  it('should return user with null monkProfile when user is a Donor', async () => {
    findFirstMock.mockResolvedValue(mockDonor as unknown as User); // fake: DB found the donor

    const result = await getUserByIdService({ id: mockDonor.id });

    expect(result).not.toBeNull();
    expect(result?.username).toBe('test_donor');
    expect(result?.monkProfile).toBeNull();
  });

  // Edge case: ID doesn't exist in the DB.
  // Prisma returns null for findUnique when no record matches —
  // the service should pass that null through rather than throw.
  it('should throw error for non-existent ID', async () => {
    findFirstMock.mockResolvedValue(null); // fake: DB found nothing

    await expect(getUserByIdService({ id: 99999 })).rejects.toThrow('User is not found');
  });
  // Soft-delete behavior: instead of actually updating a DB row like the
  // integration test did, we simply mock findUnique to return null —
  // simulating what the service's `where: { isDeleted: false }` clause
  // would produce when the user is soft-deleted.
  it('should return null if the user is soft-deleted (isDeleted: true)', async () => {
    findFirstMock.mockResolvedValue(null); // fake: service filters out deleted users

    await expect(getUserByIdService({ id: mockDonor.id })).rejects.toThrow('User is not found');
  });
});

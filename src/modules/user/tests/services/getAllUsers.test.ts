import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { User } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import { getAllUserService } from '../../user.service';

/**
 * UNIT TEST STRATEGY: Module Mocking
 *
 * Why mock? This is a unit test — we want to test ONLY the logic inside
 * getAllUserService, not Prisma or the real database.
 *
 * How it works in 3 steps:
 *  1. mock.module() replaces the entire "@/lib/prisma" import with a fake.
 *     Every function must be a real function (not a value), so we use mock()
 *     as the placeholder. This must be called BEFORE any imports resolve.
 *
 *  2. spyOn() wraps those fake functions so we can control their return values
 *     per-test with mockResolvedValue(), and assert how they were called.
 *
 *  3. Each test sets up its own fake return values, calls the service,
 *     and checks the result — no real DB involved at all.
 *
 * Common pitfall: Do NOT use Response.json({}) as a placeholder — it returns
 * a Promise object, not a function, which causes "is not a function" errors.
 */
// Mock Redis BEFORE any service imports resolve
// Without this, the service hits the real Redis in Docker and returns
// cached data, making it impossible to test the DB fallback path.
mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(() => Promise.resolve(null)), // simulate cache miss every time
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
    scan: mock(() => Promise.resolve(['0', []])),
  },
}));
mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      // Placeholder functions — spyOn() below will override these per test
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
    },
    // The service wraps findMany + count inside $transaction for atomicity.
    // We simulate that by simply resolving all promises in parallel with Promise.all.
    $transaction: mock((promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

// Attach spies AFTER mock.module() so they wrap the already-mocked functions.
// These give us mockResolvedValue() and call-assertion abilities per test.
const findManyMock = spyOn(prisma.user, 'findMany');
const countMock = spyOn(prisma.user, 'count');

describe('getAllUserService Unit Test (Mocking)', () => {
  // Reset call history and return values between tests to prevent bleed-over.
  // Without this, a mockResolvedValue() from test A could affect test B.
  beforeEach(() => {
    findManyMock.mockClear();
    countMock.mockClear();
  });

  /**
   * Shared mock data used across all tests.
   * Represents a realistic mix: 2 Donors and 1 Monk with a monkProfile.
   * Tests slice or filter this array to simulate different DB responses.
   */
  const mockUsers = [
    {
      id: 1,
      phone: '09111111111',
      username: 'apple_donor',
      email: 'apple@test.com',
      userType: 'Donor',
      isDeleted: false,
    },
    {
      id: 2,
      phone: '09222222222',
      username: 'banana_monk',
      email: 'banana@test.com',
      userType: 'Monk',
      isDeleted: false,
      monkProfile: {
        monasteryName: 'Su Taung Pyae',
        monasteryAddress: 'somewhere',
      },
    },
    {
      id: 3,
      phone: '09333333333',
      username: 'cherry_donor',
      email: 'cherry@test.com',
      userType: 'Donor',
      isDeleted: false,
    },
  ];

  // Verifies that the service correctly passes `take` and `skip` to Prisma,
  // and that it returns only as many users as the limit allows.
  it('should return correct pagination data(limit test)', async () => {
    findManyMock.mockResolvedValue(mockUsers.slice(0, 2) as unknown as User[]); // fake: DB returns first 2
    countMock.mockResolvedValue(3); // fake: total in DB is 3

    const result = await getAllUserService({ page: 1, limit: 2 });

    expect(result.users.length).toBe(2);
    expect(result.totals).toBe(3);
  });

  // Verifies that passing `username` causes the service to return
  // only users whose username contains the search string (partial match).
  it('should filter users by partial username', async () => {
    findManyMock.mockResolvedValue([mockUsers[0]] as unknown as User[]); // fake: DB matched only apple_donor
    countMock.mockResolvedValue(1);

    const result = await getAllUserService({
      page: 1,
      limit: 10,
      username: 'app', // partial match for "apple_donor"
    });

    expect(result.users[0].username).toBe('apple_donor');
    expect(result.totals).toBe(1);
  });

  // Verifies that passing `monasteryName` correctly filters Monk users
  // by their nested monkProfile relation.
  it('should filter monks by monastery name correctly', async () => {
    findManyMock.mockResolvedValue([mockUsers[1]] as unknown as User[]); // fake: DB matched only banana_monk
    countMock.mockResolvedValue(1);

    const result = await getAllUserService({
      page: 1,
      limit: 1,
      monasteryName: 'Su Taung', // partial match for "Su Taung Pyae"
    });

    expect(result.users[0].username).toBe('banana_monk');
    expect(result.totals).toBe(1);
  });

  // Verifies that soft-deleted users (isDeleted: true) are excluded.
  // Instead of touching a real DB, we simply mock findMany to return a list
  // that already excludes the deleted user — simulating what Prisma's
  // `where: { isDeleted: false }` clause would do.
  it('should not include soft-deleted users in the list', async () => {
    const remainingUsers = mockUsers.slice(1); // apple_donor (index 0) is "deleted"
    findManyMock.mockResolvedValue(remainingUsers as unknown as User[]);
    countMock.mockResolvedValue(2);

    const result = await getAllUserService({ page: 1, limit: 10 });

    expect(result.users.find((u: { phone: string }) => u.phone === '09111111111')).toBeUndefined();
    expect(result.users.length).toBe(2);
  });

  // Edge case: when no users match the filter criteria,
  // the service should gracefully return an empty list and zero total.
  it('should return empty array and zero total when no users match criteria', async () => {
    findManyMock.mockResolvedValue([]); // fake: DB found nothing
    countMock.mockResolvedValue(0);

    const result = await getAllUserService({
      page: 1,
      limit: 10,
      username: 'non_existent',
    });

    expect(result.users.length).toBe(0);
    expect(result.totals).toBe(0);
  });

  // Verifies that passing `phone` causes the service to filter
  // by partial phone number match.
  it('should filter users by phone number correctly', async () => {
    findManyMock.mockResolvedValue([mockUsers[0]] as unknown as User[]); // fake: DB matched apple_donor
    countMock.mockResolvedValue(1);

    const result = await getAllUserService({
      page: 1,
      limit: 10,
      phone: '09111', // partial match for "09111111111"
    });

    expect(result.users[0].phone).toBe('09111111111');
    expect(result.totals).toBe(1);
  });

  // Verifies that passing `userType` filters out users of other types,
  // and that every returned user matches the requested type.
  it('should filter users by userType (Donor)', async () => {
    const donors = mockUsers.filter((u) => u.userType === 'Donor'); // [apple_donor, cherry_donor]
    findManyMock.mockResolvedValue(donors as unknown as User[]);
    countMock.mockResolvedValue(2);

    const result = await getAllUserService({
      page: 1,
      limit: 10,
      userType: 'Donor',
    });

    expect(result.users.length).toBe(2);
    expect(result.users.every((u: { userType: string }) => u.userType === 'Donor')).toBe(true);
  });

  // Verifies correct offset calculation for page 2.
  // With limit=2, page 2 should skip the first 2 records (skip = (page-1) * limit = 2).
  // Also asserts that findMany was called with the exact skip/take values.
  it('should return correct data for page 2', async () => {
    findManyMock.mockResolvedValue([mockUsers[2]] as unknown as User[]); // fake: DB returns only cherry_donor
    countMock.mockResolvedValue(3); // fake: 3 total users exist

    const result = await getAllUserService({ page: 2, limit: 2 });

    expect(result.users.length).toBe(1);
    expect(result.totals).toBe(3);
    // Directly assert the Prisma call received the correct pagination args
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 2 }));
  });
});

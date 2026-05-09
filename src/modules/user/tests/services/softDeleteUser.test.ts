import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { type User, UserType } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import { softDeleteUserService } from '../../user.service';

/**
 * UNIT TEST STRATEGY: Module Mocking
 *
 * softDeleteUserService has two sequential Prisma calls:
 *  1. findUnique — checks the user exists and is not already deleted
 *  2. update     — sets isDeleted: true if the check passes
 *
 * We mock both so we can:
 *  - Simulate different DB states (active user, already deleted, not found)
 *    without touching a real DB.
 *  - Assert that update is called with exactly the right arguments.
 *  - Assert that update is NOT called at all when the guard check fails.
 *
 * Note: unlike getAllUsers, this service does NOT use $transaction,
 * so we only need to mock findUnique and update — no $transaction needed.
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
      findFirst: mock(() => Promise.resolve(null)),
      update: mock(() => Promise.resolve(null)),
    },
  },
}));

// Attach spies AFTER mock.module() so they wrap the already-mocked functions.
// findUniqueMock — controls what "DB state" the service sees before acting.
// updateMock     — lets us verify the correct update payload was sent.
const findFirstMock = spyOn(prisma.user, 'findFirst');
const updateMock = spyOn(prisma.user, 'update');

describe('softDeleteUserService Unit Test (Mocking)', () => {
  // Clear call history and return values between tests to prevent bleed-over.
  // Critical here because test order matters — a stale mockResolvedValue
  // from the happy path could mask a failure in the error path tests.
  beforeEach(() => {
    findFirstMock.mockClear();
    updateMock.mockClear();
  });

  /**
   * Shared mock user — represents an active (non-deleted) user in the DB.
   * Tests that simulate deleted/missing states override this inline.
   */
  const mockUser = {
    id: 444,
    username: 'ghost_user',
    email: 'ghost@test.com',
    isDeleted: false,
    phone: '09123456789',
    userType: UserType.Monk,
    contactPhone: '09111111111',
    password: 'hashed_password',
    createdAt: new Date(),
    updatedAt: new Date(),
    avatar: null,
  } as User;

  // Happy path: user exists and is active, so the service should:
  //  1. Find the user via findUnique
  //  2. Call update with { isDeleted: true }
  //  3. Return the updated user object
  it('should soft delete user by setting isDeleted to true', async () => {
    // Arrange: findUnique returns an active user, update returns the mutated version
    findFirstMock.mockResolvedValue(mockUser);
    updateMock.mockResolvedValue({ ...mockUser, isDeleted: true });

    const result = await softDeleteUserService({ id: 444 });

    // Assert the returned data is correct
    expect(result.username).toBe('ghost_user');

    // Assert update was called with exactly the right payload —
    // this confirms the service isn't sending extra/wrong fields.
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 444 },
        data: { isDeleted: true },
      })
    );
  });

  // Guard check — already deleted: if findUnique returns a user where
  // isDeleted is already true, the service should reject early and
  // never reach the update call.
  it('should throw an error if the user is already soft-deleted', async () => {
    // Arrange: simulate a user that was previously soft-deleted
    findFirstMock.mockResolvedValue(null);

    // Act & Assert: service should throw before calling update
    await expect(softDeleteUserService({ id: 444 })).rejects.toThrow(
      'User is not found or already deleted'
    );

    // Extra safety: confirm update was never reached
    expect(updateMock).not.toHaveBeenCalled();
  });

  // Guard check — not found: if findUnique returns null (no matching row),
  // the service should throw the same error as the already-deleted case,
  // so callers can't distinguish "never existed" from "was deleted".
  it('should throw an error if the user ID does not exist', async () => {
    // Arrange: simulate a DB miss — no user with this ID
    findFirstMock.mockResolvedValue(null);

    // Act & Assert: service should throw before calling update
    await expect(softDeleteUserService({ id: 999 })).rejects.toThrow(
      'User is not found or already deleted'
    );

    // Extra safety: confirm update was never reached
    expect(updateMock).not.toHaveBeenCalled();
  });
});

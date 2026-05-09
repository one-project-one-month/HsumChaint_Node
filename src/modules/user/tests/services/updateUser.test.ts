import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
// 1. Import types from Prisma Client
import { type MonkProfile, type User, UserType } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import { updateUserService } from '../../user.service';

/**
 * UNIT TEST STRATEGY: Module Mocking
 *
 * updateUserService is the most complex service we test because it touches
 * THREE different systems that all need to be mocked:
 *
 *  1. prisma.user.findUnique — guard check: does the user exist?
 *  2. prisma.user.update     — persists the changed fields to DB
 *  3. Bun.password           — verify() checks old password, hash() hashes new one
 *
 * The service handles several distinct update scenarios in one function:
 *  - Basic field updates (username, avatar, etc.)
 *  - Nested relation updates (monkProfile.monasteryName)
 *  - Password changes (requires old password verification before hashing new one)
 *
 * By mocking all three systems, each test can simulate a precise DB/auth state
 * and assert only the behavior relevant to that scenario — no real DB or
 * bcrypt hashing involved.
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
      findUnique: mock(() => Promise.resolve(null)),
      update: mock(() => Promise.resolve(null)),
    },
  },
}));

// Prisma spies — control what "DB state" the service sees (findUnique)
// and verify the exact payload sent back to the DB (update).
const findUniqueMock = spyOn(prisma.user, 'findUnique');
const updateMock = spyOn(prisma.user, 'update');
// Bun.password spies — mock crypto so tests don't do real hashing.
// verify() simulates checking the old password, hash() simulates hashing the new one.
const passwordVerifyMock = spyOn(Bun.password, 'verify');
const passwordHashMock = spyOn(Bun.password, 'hash');

// 2. Define a type for the Mock User that includes the relation
type UserWithProfile = User & { monkProfile: MonkProfile | null };

describe('updateUserService Unit Test (Mocking)', () => {
  // Clear all four mocks between tests — especially important here because
  // passwordVerifyMock returning true/false in one test must not leak into another.
  beforeEach(() => {
    findUniqueMock.mockClear();
    updateMock.mockClear();
    passwordVerifyMock.mockClear();
    passwordHashMock.mockClear();
  });

  /**
   * 3. Strictly typed mock data.
   * This ensures all required Prisma fields (id, createdAt, etc.) are present.
   */
  const mockUser: UserWithProfile = {
    id: 222,
    username: 'banana_monk',
    email: 'banana@test.com',
    phone: '09123456789',
    contactPhone: '09111111111',
    password: 'hashed_password_in_db',
    userType: UserType.Monk,
    avatar: null,
    fcmToken: null, // FIX: Added fcmToken because it's required in schema
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    monkProfile: {
      id: 1,
      userId: 222,
      monasteryName: 'Su Taung Pyae',
      monasteryAddress: 'somewhere',
    },
  };
  it('should update basic user info correctly', async () => {
    // No more 'as any' — the mock matches the expected return type
    findUniqueMock.mockResolvedValue(mockUser);
    updateMock.mockResolvedValue({ ...mockUser, username: 'updated_banana' });

    const result = await updateUserService(222, { username: 'updated_banana' });

    expect(result.username).toBe('updated_banana');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 222 },
        data: expect.objectContaining({ username: 'updated_banana' }),
      })
    );
  });

  it('should update monk profile monastery name correctly', async () => {
    findUniqueMock.mockResolvedValue(mockUser);

    // Safety: ensure monkProfile exists before spreading in the mock update
    const updatedProfile = mockUser.monkProfile
      ? { ...mockUser.monkProfile, monasteryName: 'New Monastery' }
      : null;

    // Explicitly cast the resolved value to satisfy the spy
    updateMock.mockResolvedValue({
      ...mockUser,
      monkProfile: updatedProfile,
    } as UserWithProfile);

    const result = await updateUserService(222, {
      monasteryName: 'New Monastery',
    });

    expect(result.monkProfile?.monasteryName).toBe('New Monastery');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monkProfile: { update: { monasteryName: 'New Monastery' } },
        }),
      })
    );
  });

  it('should change password successfully when old password is correct', async () => {
    findUniqueMock.mockResolvedValue(mockUser);
    // Bun.password.verify returns boolean (or Promise<boolean>), which is type-safe
    passwordVerifyMock.mockResolvedValue(true);
    passwordHashMock.mockResolvedValue('new_hashed_password');

    updateMock.mockResolvedValue({
      ...mockUser,
      password: 'new_hashed_password',
    });

    await updateUserService(222, {
      oldPassword: 'old_password_input',
      newPassword: 'new_password_input',
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: 'new_hashed_password' }),
      })
    );
  });

  it('should reject password change when old password is incorrect', async () => {
    findUniqueMock.mockResolvedValue(mockUser);
    passwordVerifyMock.mockResolvedValue(false);

    await expect(
      updateUserService(222, {
        oldPassword: 'wrong_password',
        newPassword: 'new_password',
      })
    ).rejects.toThrow('Old password is incorrect');

    expect(passwordHashMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('should update avatar URL correctly', async () => {
    findUniqueMock.mockResolvedValue(mockUser);
    const avatarUrl = 'https://example.com/photo.png';
    updateMock.mockResolvedValue({ ...mockUser, avatar: avatarUrl });

    const result = await updateUserService(222, { avatar: avatarUrl });

    expect(result.avatar).toBe(avatarUrl);
  });

  it('should throw an error when trying to update with invalid user ID', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(updateUserService(999, { username: 'ghost' })).rejects.toThrow(
      'User is not found'
    );

    expect(updateMock).not.toHaveBeenCalled();
  });
});

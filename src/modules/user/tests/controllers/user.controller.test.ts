import { beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { User } from 'prisma-client';
import request from 'supertest';
import { app } from '@/app';
import { generateAccessToken, type TokenPayload } from '@/utils/jwt';

/**
 * UNIT TEST STRATEGY: Prisma Mocking (same level as service tests)
 *
 * WHY we stopped mocking the service module:
 *   mock.module("../../user.service") pollutes Bun's shared module registry,
 *   causing ALL other test files to receive the fake service instead of the
 *   real one. This made every service test fail with "api_test_user" data
 *   leaking in from the controller's FAKE_USER constant.
 *
 * WHY we mock Prisma instead:
 *   Prisma is the bottom of the stack. Mocking it here lets the real service
 *   functions run (testing routing + controller logic properly) while still
 *   keeping tests fast and DB-free. Each test file mocks the same "@/lib/prisma"
 *   module but Bun isolates mock.module() per-file, so there's no leakage.
 *
 * What this test still covers:
 *  1. HTTP routing — correct endpoint is reached
 *  2. Auth middleware — 401 returned when token is missing
 *  3. Zod validation — 400 returned for bad input before service is called
 *  4. Controller response shape — correct status codes and body structure
 */

const FAKE_USER_ID = 999;
const FAKE_USER = {
  id: FAKE_USER_ID,
  username: 'api_test_user',
  email: 'controller@test.com',
  phone: '09111111111',
  userType: 'Monk',
  isDeleted: false,
  monkProfile: {
    monasteryName: 'Test Monastery',
    monasteryAddress: 'Test Address',
  },
};
mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
    scan: mock(() => Promise.resolve(['0', []])),
  },
}));
// Mock Prisma at the bottom of the stack — real services run, fake DB responses.
mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(() => Promise.resolve(FAKE_USER)),
      findMany: mock(() => Promise.resolve([FAKE_USER])),
      findUnique: mock(() => Promise.resolve(FAKE_USER)),
      update: mock(() => Promise.resolve({ ...FAKE_USER, isDeleted: true })),
      count: mock(() => Promise.resolve(1)),
    },
    $transaction: mock((promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

import { prisma } from '@/lib/prisma';

// Spies for asserting call behaviour per-test
const findFirstMock = spyOn(prisma.user, 'findFirst');
const findManyMock = spyOn(prisma.user, 'findMany');
const findUniqueMock = spyOn(prisma.user, 'findUnique');
const updateMock = spyOn(prisma.user, 'update');
const countMock = spyOn(prisma.user, 'count');

describe('UserController Unit Test (Mocking)', () => {
  let accessToken: string;

  beforeAll(() => {
    // Real JWT with fake userId — authMiddleware validates signature only,
    // not whether the userId exists in the DB.
    const payload: TokenPayload = { userId: FAKE_USER_ID, userType: 'Monk' };
    accessToken = `Bearer ${generateAccessToken(payload)}`;
  });

  // Reset all spies between tests to prevent return value bleed-over
  beforeEach(() => {
    findFirstMock.mockClear();
    findManyMock.mockClear();
    findUniqueMock.mockClear();
    updateMock.mockClear();
    countMock.mockClear();
  });

  // Happy path: valid token → middleware passes → service fetches user →
  // controller returns 200 with the correct profile shape.
  it('GET /api/v1/users/me - should return current user profile', async () => {
    findFirstMock.mockResolvedValue(FAKE_USER as unknown as User);

    const response = await request(app).get('/api/v1/users/me').set('Authorization', accessToken);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: FAKE_USER_ID,
      email: 'controller@test.com',
      username: 'api_test_user',
      userType: 'Monk',
      monkProfile: {
        monasteryName: 'Test Monastery',
        monasteryAddress: 'Test Address',
      },
    });
    expect(response.body.message).toContain('successfully');
  });

  // Security: missing token → authMiddleware rejects at middleware level,
  // Prisma should never be reached at all.
  it('GET /api/v1/users/me - should return 401 if no token provided', async () => {
    const response = await request(app).get('/api/v1/users/me');

    expect(response.status).toBe(401);
    // Middleware blocked before service/DB layer — nothing should be called
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  // Verifies controller passes query params through to the service correctly
  // and wraps the result in the expected paginated response shape.
  it('GET /api/v1/users - should return paginated users with filter', async () => {
    findManyMock.mockResolvedValue([FAKE_USER] as unknown as User[]);
    countMock.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/v1/users?page=1&limit=10')
      .set('Authorization', accessToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.users)).toBe(true);
    expect(response.body.data.paginationData).toBeDefined();
  });

  // Zod validation: bad input is rejected by validation middleware BEFORE
  // the service runs — Prisma must not be touched at all.
  it('PUT /api/v1/users/:id - should return 400 for invalid data (Zod check)', async () => {
    const response = await request(app)
      .put(`/api/v1/users/${FAKE_USER_ID}`)
      .set('Authorization', accessToken)
      .send({
        username: 'hi', // too short — Zod rejects
        email: 'wrong-email', // invalid format — Zod rejects
      });

    expect(response.status).toBe(400);
    // Validation failed before service layer — DB must not have been touched
    expect(updateMock).not.toHaveBeenCalled();
  });

  // Happy path update: valid input flows through to Prisma update,
  // controller returns the updated user.
  it('PUT /api/v1/users/:id - should update user successfully', async () => {
    findUniqueMock.mockResolvedValue(FAKE_USER as unknown as User);
    updateMock.mockResolvedValue({
      ...FAKE_USER,
      username: 'updated_api_user',
    } as unknown as User);

    const response = await request(app)
      .put(`/api/v1/users/${FAKE_USER_ID}`)
      .set('Authorization', accessToken)
      .send({ username: 'updated_api_user', contactPhone: '09888888888' });

    expect(response.status).toBe(200);
    expect(response.body.data.username).toBe('updated_api_user');
  });

  // Soft delete: service sets isDeleted:true, controller returns success message.
  // DB state verification is covered by softDeleteUserService unit test.
  it('DELETE /api/v1/users/:id - should soft delete user', async () => {
    findFirstMock.mockResolvedValue(FAKE_USER as unknown as User);
    updateMock.mockResolvedValue({
      ...FAKE_USER,
      isDeleted: true,
    } as unknown as User);

    const response = await request(app)
      .delete(`/api/v1/users/${FAKE_USER_ID}`)
      .set('Authorization', accessToken);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('deleted successfully');
  });
});

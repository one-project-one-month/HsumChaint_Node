import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Request, Response } from 'express';
import type { User } from 'prisma-client';
import { prisma } from '@/lib/prisma';
import {
  clearAllUserNotifications,
  deleteMonkProfile,
  deleteUser,
  getAllUsers,
  getMe,
  getMonkProfile,
  getUserById,
  getUserNotifications,
  getUserNotificationsFeed,
  getUserReceivedInvitations,
  getUserReceivedInvitationsFeed,
  getUserSettings,
  updateMonkProfile,
  updateUser,
  updateUserSettings,
} from '../../user.controller';

const FAKE_USER_ID = 999;
const FAKE_USER = {
  id: FAKE_USER_ID,
  name: 'api_test_user',
  email: 'controller@test.com',
  phone: '09111111111',
  contactPhone: '09111111111',
  roleId: 2,
  isDeleted: false,
  createdAt: new Date('2026-11-01T08:00:00Z'),
  monkProfile: {
    id: 1,
    userId: FAKE_USER_ID,
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

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(() => Promise.resolve(FAKE_USER)),
      findMany: mock(() => Promise.resolve([FAKE_USER])),
      findUnique: mock(() => Promise.resolve(FAKE_USER)),
      update: mock(() => Promise.resolve({ ...FAKE_USER, isDeleted: true })),
      count: mock(() => Promise.resolve(1)),
    },
    monkProfile: {
      findUnique: mock(() => Promise.resolve(FAKE_USER.monkProfile)),
      upsert: mock(() => Promise.resolve(FAKE_USER.monkProfile)),
      delete: mock(() => Promise.resolve(FAKE_USER.monkProfile)),
    },
    invitation: {
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
    },
    notification: {
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
      updateMany: mock(() => Promise.resolve({ count: 1 })),
    },
    userSetting: {
      findUnique: mock(() => Promise.resolve(null)),
      upsert: mock(() =>
        Promise.resolve({
          userId: FAKE_USER_ID,
          pickupNotificationTime: new Date(),
          dropoffNotificationTime: new Date(),
          pickupTime: null,
          dropoffTime: null,
        })
      ),
    },
    $transaction: mock((promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

interface MockResponse {
  statusCode: number;
  body: {
    isSuccess?: boolean;
    isFailure?: boolean;
    message?: string;
    data?: Record<string, unknown>;
    pagination?: Record<string, unknown>;
  };
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
}

const createMockRes = () => {
  const res: MockResponse = {
    statusCode: 200,
    body: {},
    status: mock((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: mock((payload: unknown) => {
      res.body = payload as Record<string, unknown>;
      return res;
    }),
  };
  return res as unknown as Response & MockResponse;
};

describe('UserController Unit Test (Mocking & Direct Execution)', () => {
  beforeEach(() => {
    mock.restore();
  });

  it('GET /api/user/me - should return current user profile with exact .NET envelope', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;

    const req = {
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getMe(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.message).toBe('Success');
    expect(res.body.data?.id).toBe(FAKE_USER_ID);
    expect(res.body.data?.roleName).toBe('Monk');
    expect(res.body.data?.phoneNumber).toBe('09111111111');
  });

  it('GET /api/user/:id - should return profile by ID', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getUserById(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.data?.id).toBe(FAKE_USER_ID);
  });

  it('GET /api/user - should return paginated users in PagedResult envelope', async () => {
    prisma.user.findMany = mock(() =>
      Promise.resolve([FAKE_USER] as unknown as User[])
    ) as unknown as typeof prisma.user.findMany;
    prisma.user.count = mock(() => Promise.resolve(1)) as unknown as typeof prisma.user.count;

    const req = {
      query: { pageNumber: 1, pageSize: 10 },
      user: { userId: 1, roleId: 1 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getAllUsers(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.message).toBe('Success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination?.pageNumber).toBe(1);
    expect(res.body.pagination?.totalCount).toBe(1);
  });

  it('PUT /api/user - should update user profile successfully', async () => {
    prisma.user.findUnique = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findUnique;
    prisma.user.update = mock(() =>
      Promise.resolve({ ...FAKE_USER, name: 'Updated Name' } as unknown as User)
    ) as unknown as typeof prisma.user.update;

    const req = {
      params: {},
      body: { id: FAKE_USER_ID, name: 'Updated Name' },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await updateUser(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.message).toBe('User updated successfully.');
    expect(res.body.data?.name).toBe('Updated Name');
  });

  it('DELETE /api/user/:id - should soft delete user and return void Result envelope', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;
    prisma.user.update = mock(() =>
      Promise.resolve({ ...FAKE_USER, isDeleted: true } as unknown as User)
    ) as unknown as typeof prisma.user.update;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      user: { userId: 1, roleId: 1 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await deleteUser(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.message).toBe('User deleted successfully.');
    expect(res.body.data).toBeUndefined();
  });

  it('GET /api/user/:id/monk-profile - should return monk profile', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getMonkProfile(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.data?.monasteryName).toBe('Test Monastery');
  });

  it('PATCH /api/user/:id/monk-profile - should update monk profile', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;
    prisma.monkProfile.upsert = mock(() =>
      Promise.resolve({
        id: 1,
        userId: FAKE_USER_ID,
        monasteryName: 'Updated Campus',
        monasteryAddress: 'Updated Campus Address',
      })
    ) as unknown as typeof prisma.monkProfile.upsert;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      body: {
        monasteryName: 'Updated Campus',
        monasteryAddress: 'Updated Campus Address',
      },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await updateMonkProfile(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Monk profile updated successfully.');
  });

  it('DELETE /api/user/:id/monk-profile - should delete monk profile and return void Result', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;
    prisma.monkProfile.findUnique = mock(() =>
      Promise.resolve(FAKE_USER.monkProfile)
    ) as unknown as typeof prisma.monkProfile.findUnique;
    prisma.monkProfile.delete = mock(() =>
      Promise.resolve(FAKE_USER.monkProfile)
    ) as unknown as typeof prisma.monkProfile.delete;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await deleteMonkProfile(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Monk profile deleted successfully.');
    expect(res.body.data).toBeUndefined();
  });

  it('GET /api/user/:id/invitations - should return received invitations with PagedResult', async () => {
    prisma.invitation.findMany = mock(() =>
      Promise.resolve([])
    ) as unknown as typeof prisma.invitation.findMany;
    prisma.invitation.count = mock(() =>
      Promise.resolve(0)
    ) as unknown as typeof prisma.invitation.count;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      query: { pageNumber: 1, pageSize: 10 },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getUserReceivedInvitations(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/user/:id/invitations/feed - should return received invitations with CursorPagedResult', async () => {
    prisma.invitation.findMany = mock(() =>
      Promise.resolve([])
    ) as unknown as typeof prisma.invitation.findMany;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      query: { pageSize: 15 },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getUserReceivedInvitationsFeed(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.pagination?.pageSize).toBe(15);
  });

  it('GET /api/user/:id/notification - should return notifications with PagedResult', async () => {
    prisma.notification.findMany = mock(() =>
      Promise.resolve([])
    ) as unknown as typeof prisma.notification.findMany;
    prisma.notification.count = mock(() =>
      Promise.resolve(0)
    ) as unknown as typeof prisma.notification.count;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      query: { pageNumber: 1, pageSize: 10 },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getUserNotifications(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.pagination?.totalPages).toBe(1);
  });

  it('GET /api/user/:id/notification/feed - should return notifications with CursorPagedResult', async () => {
    prisma.notification.findMany = mock(() =>
      Promise.resolve([])
    ) as unknown as typeof prisma.notification.findMany;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      query: { pageSize: 15 },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getUserNotificationsFeed(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.pagination?.hasNextPage).toBe(false);
  });

  it('DELETE /api/user/:id/notification - should clear notifications and return void Result', async () => {
    prisma.notification.updateMany = mock(() =>
      Promise.resolve({ count: 3 })
    ) as unknown as typeof prisma.notification.updateMany;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await clearAllUserNotifications(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Notifications cleared successfully.');
    expect(res.body.data).toBeUndefined();
  });

  it('GET /api/user/:id/settings - should return user settings', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;
    prisma.userSetting.findUnique = mock(() =>
      Promise.resolve(null)
    ) as unknown as typeof prisma.userSetting.findUnique;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await getUserSettings(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.data?.userId).toBe(FAKE_USER_ID);
  });

  it('PUT /api/user/:id/settings - should update user settings', async () => {
    prisma.user.findFirst = mock(() =>
      Promise.resolve(FAKE_USER as unknown as User)
    ) as unknown as typeof prisma.user.findFirst;
    prisma.userSetting.upsert = mock(() =>
      Promise.resolve({
        userId: FAKE_USER_ID,
        pickupNotificationTime: new Date('2026-11-01T14:00:00Z'),
        dropoffNotificationTime: new Date('2026-11-01T21:00:00Z'),
        pickupTime: null,
        dropoffTime: null,
      })
    ) as unknown as typeof prisma.userSetting.upsert;

    const req = {
      params: { id: String(FAKE_USER_ID) },
      body: {
        pickupNotificationTime: '2026-11-01T14:00:00Z',
        dropoffNotificationTime: '2026-11-01T21:00:00Z',
      },
      user: { userId: FAKE_USER_ID, roleId: 2 },
    } as unknown as Request;
    const res = createMockRes();
    const next = mock();

    await updateUserSettings(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Settings updated successfully.');
  });
});

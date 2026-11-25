import { describe, expect, it, mock } from 'bun:test';
import request from 'supertest';
import { generateAccessToken } from '@/utils/jwt';

// Mock dependencies before importing app
mock.module('firebase-admin/app', () => ({
  initializeApp: mock(() => ({})),
  cert: mock(() => ({})),
  getApps: mock(() => []),
}));

mock.module('firebase-admin/messaging', () => ({
  getMessaging: mock(() => ({
    send: mock(async () => 'message-id'),
  })),
}));

mock.module('@/lib/firebase', () => ({
  sendPush: mock(async () => {}),
  firebaseApp: {},
}));

mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(async () => null),
    set: mock(async () => 'OK'),
    del: mock(async () => 1),
    scan: mock(async () => ['0', []]),
  },
}));

const mockMonkUser = {
  id: 2,
  name: 'U Thuzana',
  phone: '09100000002',
  contactPhone: '09100000002',
  email: 'thuzana@monastery.org',
  roleId: 2, // Monk
  isDeleted: false,
  createdAt: new Date('2026-11-01T08:00:00Z'),
  monkProfile: {
    id: 10,
    userId: 2,
    monasteryName: 'Mahagandhayon Monastery',
    monasteryAddress: 'Amarapura, Mandalay',
  },
};

const mockAdminUser = {
  id: 1,
  name: 'System Administrator',
  phone: '09100000001',
  contactPhone: '09100000001',
  email: 'admin@monastery.org',
  roleId: 1, // Admin
  isDeleted: false,
  createdAt: new Date('2026-11-01T08:00:00Z'),
  monkProfile: null,
};

const mockDonorUser = {
  id: 3,
  name: 'Daw Hla',
  phone: '09200000001',
  contactPhone: '09200000001',
  email: 'donor@hsumchaint.org',
  roleId: 3, // Donor
  isDeleted: false,
  createdAt: new Date('2026-11-01T08:00:00Z'),
  monkProfile: null,
};

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(async ({ where }: { where?: { id?: number; isDeleted?: boolean } }) => {
        if (where?.id === 1) return mockAdminUser;
        if (where?.id === 2) return mockMonkUser;
        if (where?.id === 3) return mockDonorUser;
        return null;
      }),
      findUnique: mock(async ({ where }: { where?: { id?: number } }) => {
        if (where?.id === 1) return mockAdminUser;
        if (where?.id === 2) return mockMonkUser;
        if (where?.id === 3) return mockDonorUser;
        return null;
      }),
      findMany: mock(async () => [mockAdminUser, mockMonkUser]),
      count: mock(async () => 2),
      update: mock(
        async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
          const base = where.id === 2 ? mockMonkUser : mockAdminUser;
          return { ...base, ...data };
        }
      ),
    },
    monkProfile: {
      findUnique: mock(async ({ where }: { where?: { userId?: number } }) => {
        if (where?.userId === 2) return mockMonkUser.monkProfile;
        return null;
      }),
      upsert: mock(async ({ create }: { create: Record<string, unknown> }) => ({
        id: 10,
        ...create,
      })),
      delete: mock(async () => mockMonkUser.monkProfile),
    },
    invitation: {
      findMany: mock(async () => [
        {
          id: 100,
          monasterySpaceId: 5,
          monasterySpace: { id: 5, monasteryName: 'Shwe Dagon Space' },
          invitedUserId: 2,
          invitedUser: { id: 2, name: 'U Thuzana' },
          invitedById: 1,
          invitedBy: { id: 1, name: 'System Administrator' },
          spaceRoleId: 2,
          spaceRole: { id: 2, name: 'Admin' },
          status: 'PENDING',
          createdAt: new Date('2026-11-01T10:00:00Z'),
        },
      ]),
      count: mock(async () => 1),
    },
    notification: {
      findMany: mock(async () => [
        {
          id: 50,
          userId: 2,
          type: 'REMINDER',
          message: 'Pick up food tomorrow at 7:00 AM',
          isRead: false,
          createdAt: new Date('2026-11-01T10:00:00Z'),
        },
      ]),
      count: mock(async () => 1),
      updateMany: mock(async () => ({ count: 1 })),
    },
    userSetting: {
      findUnique: mock(async ({ where }: { where?: { userId?: number } }) => {
        if (where?.userId === 2) {
          return {
            userId: 2,
            pickupNotificationTime: new Date('2026-11-01T15:30:00Z'),
            dropoffNotificationTime: new Date('2026-11-01T22:00:00Z'),
            pickupTime: null,
            dropoffTime: null,
          };
        }
        return null;
      }),
      upsert: mock(async ({ create }: { create: Record<string, unknown> }) => ({
        ...create,
      })),
    },
    rolePermission: {
      findMany: mock(async ({ where }: { where?: { roleId?: number } }) => {
        if (where?.roleId === 1) {
          return [
            { permission: { name: 'Users.View' } },
            { permission: { name: 'Users.Update' } },
            { permission: { name: 'Users.Manage' } },
            { permission: { name: 'Invitation.View' } },
            { permission: { name: 'Notification.View' } },
            { permission: { name: 'Notification.Manage' } },
          ];
        }
        if (where?.roleId === 2) {
          return [
            { permission: { name: 'Invitation.View' } },
            { permission: { name: 'Notification.View' } },
          ];
        }
        return [{ permission: { name: 'Donor.View' } }];
      }),
    },
    $transaction: mock(async (promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

const { app } = await import('@/app');

describe('4.2. User & Profile Management (/api/v1/user) HTTP Tests', () => {
  const adminToken = generateAccessToken({ userId: 1, roleId: 1 });
  const monkToken = generateAccessToken({ userId: 2, roleId: 2 });
  const donorToken = generateAccessToken({ userId: 3, roleId: 3 });

  // 4. Get All Users
  describe('4. GET /api/v1/user', () => {
    it('should retrieve paginated list of users when caller is System Admin', async () => {
      const res = await request(app)
        .get('/api/v1/user?pageNumber=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.pageNumber).toBe(1);
      expect(res.body.pagination.pageSize).toBe(10);
      expect(res.body.pagination.totalCount).toBe(2);
    });

    it('should reject non-admin users without Users.View', async () => {
      // Donor without Admin role
      const res = await request(app)
        .get('/api/v1/user')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.isSuccess).toBe(false);
    });
  });

  // 5. Get User Profile by ID
  describe('5. GET /api/v1/user/{id}', () => {
    it('should allow user to retrieve their own profile', async () => {
      const res = await request(app)
        .get('/api/v1/user/2')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.id).toBe(2);
      expect(res.body.data.name).toBe('U Thuzana');
      expect(res.body.data.phoneNumber).toBe('09100000002');
      expect(res.body.data.roleName).toBe('Monk');
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
    });

    it('should allow System Admin to retrieve another user profile', async () => {
      const res = await request(app)
        .get('/api/v1/user/2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.id).toBe(2);
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
    });

    it('should reject a regular user attempting to retrieve another user profile', async () => {
      const res = await request(app)
        .get('/api/v1/user/1')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // 6. Update User Profile
  describe('6. PUT /api/v1/user', () => {
    it('should update user profile for authenticated self', async () => {
      const res = await request(app)
        .put('/api/v1/user')
        .set('Authorization', `Bearer ${monkToken}`)
        .send({
          id: 2,
          name: 'U Thuzana Updated',
          phoneNumber: '09100000002',
          roleId: 2,
          email: 'updated@monastery.org',
          contactPhoneNumber: '09100000002',
        });

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('User updated successfully.');
      expect(res.body.data.name).toBe('U Thuzana Updated');
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
    });

    it('should prevent non-admin user from altering roleId', async () => {
      const res = await request(app)
        .put('/api/v1/user')
        .set('Authorization', `Bearer ${monkToken}`)
        .send({
          id: 2,
          roleId: 1, // Attempt to escalate to Admin
        });

      expect(res.status).toBe(403);
      expect(res.body.isSuccess).toBe(false);
    });
  });

  // 7. Soft Delete User Account
  describe('7. DELETE /api/v1/user/{id}', () => {
    it('should soft delete user when caller is System Admin', async () => {
      const res = await request(app)
        .delete('/api/v1/user/2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('User deleted successfully.');
    });

    it('should reject non-admin from soft deleting an account', async () => {
      const res = await request(app)
        .delete('/api/v1/user/2')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // 8. Get User's Received Invitations
  describe('8. GET /api/v1/user/{id}/invitations', () => {
    it('should return paginated invitations received by user', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/invitations?pageNumber=1&pageSize=10')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].monasterySpaceName).toBe('Shwe Dagon Space');
      expect(res.body.pagination.pageNumber).toBe(1);
    });
  });

  // 8.1. Get User's Received Invitations Feed
  describe('8.1. GET /api/v1/user/{id}/invitations/feed', () => {
    it('should return cursor paginated invitations feed', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/invitations/feed?pageSize=15')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.pageSize).toBe(15);
      expect(res.body.pagination.hasNextPage).toBe(false);
    });
  });

  // 9. Get User's Sent Invitations
  describe('9. GET /api/v1/user/{id}/invited-by-list', () => {
    it('should return sent invitations for user', async () => {
      const res = await request(app)
        .get('/api/v1/user/1/invited-by-list?pageNumber=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // 9.1. Get User's Sent Invitations Feed
  describe('9.1. GET /api/v1/user/{id}/invited-by-list/feed', () => {
    it('should return cursor paginated sent invitations feed', async () => {
      const res = await request(app)
        .get('/api/v1/user/1/invited-by-list/feed?pageSize=15')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.pagination.pageSize).toBe(15);
    });
  });

  // 10. Get User's Notifications
  describe('10. GET /api/v1/user/{id}/notification', () => {
    it('should return paginated notifications for user', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/notification?pageNumber=1&pageSize=10')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].message).toBe('Pick up food tomorrow at 7:00 AM');
    });
  });

  // 10.1. Get User's Notifications Feed
  describe('10.1. GET /api/v1/user/{id}/notification/feed', () => {
    it('should return cursor paginated notifications feed', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/notification/feed?pageSize=15')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.pagination.pageSize).toBe(15);
    });
  });

  // 11. Clear User's Notifications
  describe('11. DELETE /api/v1/user/{id}/notification', () => {
    it('should clear notifications for user', async () => {
      const res = await request(app)
        .delete('/api/v1/user/2/notification')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Notifications cleared successfully.');
    });
  });

  // 12. Get Monk Profile
  describe('12. GET /api/v1/user/{id}/monk-profile', () => {
    it('should return monk profile for monk user', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/monk-profile')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.monasteryName).toBe('Mahagandhayon Monastery');
      expect(res.body.data.monasteryAddress).toBe('Amarapura, Mandalay');
    });
  });

  // 13. Update Monk Profile
  describe('13. PUT /api/v1/user/{id}/monk-profile', () => {
    it('should update monk profile fields (monasteryName, monasteryAddress)', async () => {
      const res = await request(app)
        .put('/api/v1/user/2/monk-profile')
        .set('Authorization', `Bearer ${monkToken}`)
        .send({
          monasteryName: 'Thabarwa Meditation Center',
          monasteryAddress: 'Thanlyin, Yangon',
        });

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Monk profile updated successfully.');
      expect(res.body.data.monasteryName).toBe('Thabarwa Meditation Center');
      expect(res.body.data.monasteryAddress).toBe('Thanlyin, Yangon');
    });
  });

  // 14. Delete Monk Profile
  describe('14. DELETE /api/v1/user/{id}/monk-profile', () => {
    it('should delete monk profile', async () => {
      const res = await request(app)
        .delete('/api/v1/user/2/monk-profile')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Monk profile deleted successfully.');
    });
  });

  // 15. Get User's Reminder Settings
  describe('15. GET /api/v1/user/{id}/settings', () => {
    it('should return user reminder settings', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/settings')
        .set('Authorization', `Bearer ${monkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.userId).toBe(2);
      expect(res.body.data.pickupNotificationTime).toBeDefined();
      expect(res.body.data.dropoffNotificationTime).toBeDefined();
    });
  });

  // 16. Update User's Reminder Settings
  describe('16. PUT /api/v1/user/{id}/settings', () => {
    it('should update reminder settings', async () => {
      const res = await request(app)
        .put('/api/v1/user/2/settings')
        .set('Authorization', `Bearer ${monkToken}`)
        .send({
          pickupNotificationTime: '2026-11-01T15:30:00Z',
          dropoffNotificationTime: '2026-11-01T22:00:00Z',
          pickupTime: null,
          dropoffTime: null,
        });

      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Settings updated successfully.');
    });
  });
});

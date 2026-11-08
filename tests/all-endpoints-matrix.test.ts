import { beforeAll, describe, expect, it, mock } from 'bun:test';
import request from 'supertest';
process.env.NODE_ENV = 'development';
import { generateAccessToken, generateRefreshToken } from '@/utils/jwt';

// In-memory Redis mock
const redisStore = new Map<string, string>();
mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(async (key: string) => redisStore.get(key) ?? null),
    set: mock(async (key: string, val: string) => {
      redisStore.set(key, val);
      return 'OK';
    }),
    del: mock(async (...keys: string[]) => {
      for (const k of keys) redisStore.delete(k);
      return keys.length;
    }),
    scan: mock(async () => ['0', []]),
  },
}));

// Firebase push mock
mock.module('@/lib/firebase', () => ({
  sendPush: mock(async () => {}),
}));

const HASHED_PASSWORD = await Bun.password.hash('Password123!');

// In-memory mock database entities
const mockAdmin = {
  id: 1,
  name: 'Admin User',
  phone: '09123456789',
  contactPhone: '09123456789',
  email: 'admin@monastery.org',
  password: HASHED_PASSWORD,
  roleId: 3, // Admin
  fcmToken: 'mock-fcm',
  isDeleted: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  role: { id: 3, name: 'Admin', isDeleted: false },
};

const mockMonk = {
  id: 2,
  name: 'Ashin Pannita',
  phone: '09222333444',
  contactPhone: '09222333444',
  email: 'monk@monastery.org',
  password: HASHED_PASSWORD,
  roleId: 1, // Monk
  fcmToken: 'mock-fcm-monk',
  isDeleted: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  role: { id: 1, name: 'Monk', isDeleted: false },
  monkProfile: {
    id: 1,
    userId: 2,
    monasteryName: 'Golden Valley Monastery',
    monasteryAddress: 'Yangon, Myanmar',
  },
};

const mockDonorUser = {
  id: 3,
  name: 'Daw Mya',
  phone: '09333444555',
  contactPhone: '09333444555',
  email: 'donor@monastery.org',
  password: HASHED_PASSWORD,
  roleId: 2, // Donor
  fcmToken: 'mock-fcm-donor',
  isDeleted: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  role: { id: 2, name: 'Donor', isDeleted: false },
};

const mockSpace = {
  id: 10,
  monasteryName: 'Golden Valley Monastery',
  description: 'Ancient peaceful retreat',
  address: 'Yangon',
  createdById: 2,
  isDeleted: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: { name: 'Ashin Pannita' },
  _count: { members: 3 },
};

const mockDonationRow = {
  id: 100,
  monasterySpaceId: 10,
  donorId: 1,
  donorName: 'Daw Mya',
  donationType: 'Food',
  status: 'PendingReview',
  statusValue: 0,
  amount: 25000,
  quantity: 5,
  note: 'Morning Alms',
  targetDate: new Date('2026-11-15T00:00:00Z'),
  isDeleted: false,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  donor: { name: 'Daw Mya', email: 'donor@monastery.org', phone: '09333444555' },
  monasterySpace: { id: 10, monasteryName: 'Golden Valley Monastery', isDeleted: false },
};

const mockRole = {
  id: 1,
  name: 'Admin',
  description: 'Administrator role',
  isDeleted: false,
};

const mockPermission = {
  id: 1,
  name: 'User.View',
  description: 'View users permission',
  isDeleted: false,
};

const mockSpacePermission = {
  id: 1,
  name: 'Space.View',
  description: 'View space',
  isDeleted: false,
};

const mockSpaceRole = {
  id: 1,
  name: 'Owner',
  description: 'Space Owner',
  isDeleted: false,
  permissions: [{ isDeleted: false, spacePermission: mockSpacePermission }],
};

const mockNotification = {
  id: 1,
  userId: 1,
  type: 2,
  message: 'Test notification payload',
  isRead: false,
  isDeleted: false,
  createdAt: new Date('2026-11-01T00:00:00Z'),
};

const mockSetting = {
  id: 1,
  userId: 1,
  mealOfferingsReminder: true,
  ceremoniesReminder: true,
  dailyDhammaVerse: true,
  eventReminders: true,
  announcements: true,
  reminderDaysBefore: 1,
  reminderTime: '06:00:00',
  isDeleted: false,
};

const mockDonor = {
  id: 1,
  name: 'U Ba',
  email: 'uba@monastery.org',
  phoneNo: '+95912345678',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
};

const validRefreshTokenStr = generateRefreshToken({ userId: 1, roleId: 3 });

const mockPrisma = {
  user: {
    findFirst: mock(async (args: any) => {
      const str = JSON.stringify(args || {});
      if (str.includes('09777888999')) return null; // Registration uniqueness check
      if (args?.where?.id === 2 || args?.where?.roleId === 1) return mockMonk;
      if (args?.where?.id === 3) return mockDonorUser;
      return mockAdmin;
    }),
    findUnique: mock(async (args: any) => {
      const str = JSON.stringify(args || {});
      if (str.includes('09777888999')) return null;
      if (args?.where?.id === 2) return mockMonk;
      if (args?.where?.id === 3) return mockDonorUser;
      return mockAdmin;
    }),
    findMany: mock(async () => [mockAdmin, mockMonk, mockDonorUser]),
    create: mock(async () => mockAdmin),
    update: mock(async () => mockAdmin),
    count: mock(async () => 3),
  },
  monkProfile: {
    findFirst: mock(async () => mockMonk.monkProfile),
    findUnique: mock(async () => mockMonk.monkProfile),
    create: mock(async () => mockMonk.monkProfile),
    update: mock(async () => mockMonk.monkProfile),
    upsert: mock(async () => mockMonk.monkProfile),
    delete: mock(async () => mockMonk.monkProfile),
  },
  monasterySpace: {
    findFirst: mock(async () => mockSpace),
    findUnique: mock(async () => mockSpace),
    findMany: mock(async () => [mockSpace]),
    create: mock(async () => mockSpace),
    update: mock(async () => mockSpace),
    count: mock(async () => 1),
  },
  monasteryMember: {
    findFirst: mock(async () => ({
      id: 1,
      userId: 1,
      monasterySpaceId: 10,
      role: 1,
      spaceRoleId: 1,
      isOwner: true,
    })),
    findMany: mock(async () => [
      {
        id: 1,
        userId: 1,
        monasterySpaceId: 10,
        role: 1,
        spaceRoleId: 1,
        isOwner: true,
        user: mockAdmin,
        spaceRole: mockSpaceRole,
      },
    ]),
    create: mock(async () => ({ id: 1 })),
    update: mock(async () => ({ id: 1 })),
    delete: mock(async () => ({ id: 1 })),
    count: mock(async () => 1),
  },
  donorList: {
    findFirst: mock(async () => mockDonationRow),
    findUnique: mock(async () => mockDonationRow),
    findMany: mock(async () => [mockDonationRow]),
    create: mock(async () => mockDonationRow),
    update: mock(async () => mockDonationRow),
    updateMany: mock(async () => ({ count: 1 })),
    count: mock(async () => 1),
  },
  role: {
    findFirst: mock(async () => mockRole),
    findUnique: mock(async () => mockRole),
    findMany: mock(async () => [mockRole]),
    create: mock(async () => mockRole),
    update: mock(async () => mockRole),
    count: mock(async () => 1),
  },
  permission: {
    findFirst: mock(async () => mockPermission),
    findUnique: mock(async () => mockPermission),
    findMany: mock(async () => [mockPermission]),
    count: mock(async () => 1),
  },
  rolePermission: {
    findMany: mock(async () => [{ permission: { name: 'User.View' }, role: mockRole }]),
    create: mock(async () => ({ id: 1 })),
    deleteMany: mock(async () => ({ count: 1 })),
    createMany: mock(async () => ({ count: 1 })),
  },
  spaceRole: {
    findFirst: mock(async () => mockSpaceRole),
    findUnique: mock(async () => mockSpaceRole),
    findMany: mock(async () => [mockSpaceRole]),
    create: mock(async () => mockSpaceRole),
    update: mock(async () => mockSpaceRole),
    count: mock(async () => 1),
  },
  spacePermission: {
    findFirst: mock(async () => mockSpacePermission),
    findUnique: mock(async () => mockSpacePermission),
    findMany: mock(async () => [mockSpacePermission]),
    count: mock(async () => 1),
  },
  spaceRolePermission: {
    findMany: mock(async () => [
      { spacePermission: { name: 'Space.View' }, spaceRole: mockSpaceRole },
    ]),
    create: mock(async () => ({ id: 1 })),
    deleteMany: mock(async () => ({ count: 1 })),
    createMany: mock(async () => ({ count: 1 })),
  },
  notification: {
    findFirst: mock(async () => mockNotification),
    findUnique: mock(async () => mockNotification),
    findMany: mock(async () => [mockNotification]),
    create: mock(async () => mockNotification),
    update: mock(async () => mockNotification),
    count: mock(async () => 1),
  },
  userSetting: {
    findFirst: mock(async () => mockSetting),
    findUnique: mock(async () => mockSetting),
    create: mock(async () => mockSetting),
    update: mock(async () => mockSetting),
    upsert: mock(async () => mockSetting),
  },
  donor: {
    findFirst: mock(async (args: any) => {
      if (args?.where?.OR) return null; // Uniqueness check returns null
      return mockDonor;
    }),
    findUnique: mock(async () => mockDonor),
    findMany: mock(async () => [mockDonor]),
    create: mock(async () => mockDonor),
    update: mock(async () => mockDonor),
    delete: mock(async () => mockDonor),
    count: mock(async () => 1),
  },
  refreshToken: {
    findFirst: mock(async () => ({
      id: 1,
      userId: 1,
      refreshToken: validRefreshTokenStr,
      expiresAt: new Date(Date.now() + 86400000),
    })),
    create: mock(async () => ({ id: 1, refreshToken: validRefreshTokenStr })),
    update: mock(async () => ({ id: 1 })),
  },
  invitation: {
    findFirst: mock(async () => ({
      id: 1,
      inviterId: 1,
      inviteeId: 2,
      spaceId: 10,
      status: 0,
    })),
    findMany: mock(async () => []),
    count: mock(async () => 0),
  },
  passwordResetToken: {
    create: mock(async () => ({ id: 1, token: 'mock-reset-token' })),
    findUnique: mock(async () => ({ id: 1, token: 'mock-reset-token', userId: 1 })),
    delete: mock(async () => ({ id: 1 })),
  },
  $transaction: mock(async (cb: any) =>
    typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb)
  ),
};

mock.module('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import app
import { app } from '@/app';

const adminToken = generateAccessToken({ userId: 1, roleId: 3 });
const monkToken = generateAccessToken({ userId: 2, roleId: 1 });
const donorToken = generateAccessToken({ userId: 3, roleId: 2 });

describe('Node API Endpoints Live Data Verification Matrix', () => {
  // ----------------------------------------------------
  // Module 1: Auth Module (/api/v1/auth)
  // ----------------------------------------------------
  describe('Module 1: Auth Endpoints (/api/v1/auth)', () => {
    it('GET /api/v1/auth/login-mode -> 200 with envelope', async () => {
      const res = await request(app).get('/api/v1/auth/login-mode');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('POST /api/v1/auth/register -> 200 with envelope', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Ko Min',
        phone: '09777888999',
        password: 'Password123!',
        roleId: 2,
      });
      if (res.status !== 200) console.error('Register failed:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('POST /api/v1/auth/login -> 200 login success', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: '09123456789',
        password: 'Password123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('POST /api/v1/auth/refresh-token -> 200 refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh-token').send({
        userId: 1,
        refreshToken: validRefreshTokenStr,
      });
      if (res.status !== 200) console.error('Refresh token failed:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('POST /api/v1/auth/forgot-password -> 200 forgot password', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        phone: '09123456789',
      });
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 2: User Module (/api/v1/user & /api/v1/users)
  // ----------------------------------------------------
  describe('Module 2: User Endpoints (/api/v1/user)', () => {
    it('GET /api/v1/user/me -> 200 with user profile data', async () => {
      const res = await request(app)
        .get('/api/v1/user/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/user/1 -> 200 with user details', async () => {
      const res = await request(app)
        .get('/api/v1/user/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/user/2/monk-profile -> 200 with monk profile', async () => {
      const res = await request(app)
        .get('/api/v1/user/2/monk-profile')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data.monasteryName).toBe('Golden Valley Monastery');
    });

    it('GET /api/v1/user/1/settings -> 200 with settings', async () => {
      const res = await request(app)
        .get('/api/v1/user/1/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 3: Monastery Space Module (/api/v1/monasteries)
  // ----------------------------------------------------
  describe('Module 3: Monastery Spaces (/api/v1/monasteries)', () => {
    it('GET /api/v1/monasteries -> 200 public catalog', async () => {
      const res = await request(app).get('/api/v1/monasteries');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/monasteries/feed -> 200 cursor feed', async () => {
      const res = await request(app).get('/api/v1/monasteries/feed');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/monasteries/search -> 200 public search', async () => {
      const res = await request(app).get('/api/v1/monasteries/search?q=Golden');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/monasteries/search/feed -> 200 search feed', async () => {
      const res = await request(app).get('/api/v1/monasteries/search/feed?q=Golden');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/monasteries/10 -> 200 with space details', async () => {
      const res = await request(app)
        .get('/api/v1/monasteries/10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/monasteries/10/members -> 200 with members list', async () => {
      const res = await request(app)
        .get('/api/v1/monasteries/10/members')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/monasteries/roles -> 200 with space roles', async () => {
      const res = await request(app)
        .get('/api/v1/monasteries/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 4: Donations (/api/v1/donations)
  // ----------------------------------------------------
  describe('Module 4: Donations Endpoints (/api/v1/donations)', () => {
    it('GET /api/v1/donations/statuses -> 200 [AllowAnonymous] status metadata', async () => {
      const res = await request(app).get('/api/v1/donations/statuses');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.find((s: any) => s.id === 0).name).toBe('PendingReview');
      expect(res.body.data.find((s: any) => s.id === 3).name).toBe('Completed');
    });

    it('GET /api/v1/donations/feed -> 200 cursor pagination feed', async () => {
      const res = await request(app)
        .get('/api/v1/donations/feed')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('GET /api/v1/donations/100 -> 200 single donation detail', async () => {
      const res = await request(app)
        .get('/api/v1/donations/100')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('PUT /api/v1/donations/100/status -> 200 updates status via numeric status code', async () => {
      const res = await request(app)
        .put('/api/v1/donations/100/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 1, note: 'Reviewed and accepted' });
      if (res.status !== 200) console.error('Donation status update failed:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 5: Donors (/api/v1/donors)
  // ----------------------------------------------------
  describe('Module 5: Donor Endpoints (/api/v1/donors)', () => {
    it('GET /api/v1/donors -> 200 with paged envelope', async () => {
      const res = await request(app).get('/api/v1/donors');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/donors/1 -> 200 single donor with Result<T> envelope', async () => {
      const res = await request(app).get('/api/v1/donors/1');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('POST /api/v1/donors -> 200 creates donor', async () => {
      const res = await request(app).post('/api/v1/donors').send({
        name: 'Daw Khin',
        email: 'dawkhin@test.com',
        phoneNo: '+95999988877',
      });
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 6: System Roles & Permissions (/api/v1/roles, /api/v1/permissions)
  // ----------------------------------------------------
  describe('Module 6: System Roles & Permissions', () => {
    it('GET /api/v1/roles -> 200 list of roles', async () => {
      const res = await request(app)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/permissions -> 200 list of permissions', async () => {
      const res = await request(app)
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/roles/me/permissions -> 200 my permissions', async () => {
      const res = await request(app)
        .get('/api/v1/roles/me/permissions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 7: Space Roles & Space Permissions
  // ----------------------------------------------------
  describe('Module 7: Space Roles & Space Permissions', () => {
    it('GET /api/v1/space-roles -> 200 list of space roles', async () => {
      const res = await request(app)
        .get('/api/v1/space-roles')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('GET /api/v1/space-permissions -> 200 list of space permissions', async () => {
      const res = await request(app)
        .get('/api/v1/space-permissions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 8: Notifications (/api/v1/notifications)
  // ----------------------------------------------------
  describe('Module 8: Notifications (/api/v1/notifications)', () => {
    it('GET /api/v1/notifications -> 200 user notifications', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });

    it('PATCH /api/v1/notifications/read-noti -> 200 marks read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-noti')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notificationId: 1, userId: 1 });
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 9: User Settings (/api/v1/user-settings)
  // ----------------------------------------------------
  describe('Module 9: User Settings (/api/v1/user-settings)', () => {
    it('GET /api/v1/user-settings/me -> 200 gets current user settings', async () => {
      const res = await request(app)
        .get('/api/v1/user-settings/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });

  // ----------------------------------------------------
  // Module 10: Health (/health)
  // ----------------------------------------------------
  describe('Module 10: Health Endpoint', () => {
    it('GET /health -> 200 ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.isSuccess).toBe(true);
    });
  });
});

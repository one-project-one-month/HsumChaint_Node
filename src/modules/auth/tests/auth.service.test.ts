import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { loginUser, refreshTokenService, registerUser } from '../auth.service';

const mockRedisStore = new Map<string, string>();

const prisma = {
  user: {
    findFirst: async (): Promise<unknown> => null,
    findUnique: async (): Promise<unknown> => null,
    create: async (): Promise<unknown> => null,
    update: async (): Promise<unknown> => null,
  },
  role: { findUnique: async (): Promise<unknown> => null },
  refreshToken: {
    findFirst: async (): Promise<unknown> => null,
    findUnique: async (): Promise<unknown> => null,
    create: async (): Promise<unknown> => null,
    update: async (): Promise<unknown> => null,
  },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
    callback(prisma),
};
mock.module('@/lib/prisma', () => ({ prisma }));

mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(async (key: string) => mockRedisStore.get(key) ?? null),
    set: mock(async (key: string, val: string) => {
      mockRedisStore.set(key, val);
      return 'OK';
    }),
    del: mock(async (...keys: string[]) => {
      for (const k of keys) mockRedisStore.delete(k);
      return keys.length;
    }),
    scan: mock(async () => ['0', []]),
  },
}));

mock.module('@/middlewares/permissionMiddleware', () => ({
  getRolePermissions: mock(async (roleId: number) => {
    if (roleId === 2) return ['Monastery.Create', 'Donation.Create', 'Donation.View'];
    if (roleId === 3) return ['Donation.View', 'Donation.Create'];
    return ['User.View', 'Role.View'];
  }),
}));

mock.module('@/helper/createAuthSession', () => ({
  createAuthSession: mock(async (_prismaClient: unknown, userId: number, roleId: number) => ({
    accessToken: `access_token_for_${userId}_${roleId}`,
    refreshToken: `refresh_token_for_${userId}_${roleId}`,
  })),
}));

mock.module('@/utils/cache.util', () => ({
  clearUserListCache: mock(async () => {}),
}));

describe('Auth Service (.NET C# Alignment: 1=Admin, 2=Monk, 3=Donor)', () => {
  beforeEach(() => {
    mockRedisStore.clear();
  });

  describe('registerUser', () => {
    it('returns flattened response for Monk registration (roleId: 2)', async () => {
      const mockCreatedUser = {
        id: 201,
        phone: '09100000001',
        name: 'U Thuzana',
        email: 'thuzana@monastery.org',
        roleId: 2, // Monk
        contactPhone: '09100000001',
        avatar: undefined,
        createdAt: new Date(),
      };

      prisma.user.findFirst = mock(async () => null);
      prisma.role.findUnique = mock(async () => ({ id: 2, name: 'Monk' }));
      prisma.$transaction = mock(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            create: mock(async () => mockCreatedUser),
          },
          monkProfile: {
            create: mock(async () => ({
              id: 1,
              userId: 201,
              monasteryName: 'Mahasi Yeiktha',
              monasteryAddress: 'Yangon',
            })),
          },
        };
        return cb(tx);
      });

      const response = await registerUser({
        name: 'U Thuzana',
        phoneNumber: '09100000001',
        password: 'Password123!',
        roleId: 2, // Monk
        monasteryName: 'Mahasi Yeiktha',
        monasteryAddress: 'Yangon',
        email: 'thuzana@monastery.org',
        contactPhoneNumber: '09100000001',
      });

      expect(response.id).toBe(201);
      expect(response.roleId).toBe(2);
      expect(response.roleName).toBe('Monk');
      expect(response.accessToken).toBe('access_token_for_201_2');
      expect(response.refreshToken).toBe('refresh_token_for_201_2');
      expect(Array.isArray(response.permissions)).toBe(true);
    });

    it('returns flattened response for Donor registration (roleId: 3)', async () => {
      const mockCreatedUser = {
        id: 202,
        phone: '09100000002',
        name: 'Daw Hla',
        email: 'dawhla@gmail.com',
        roleId: 3, // Donor
        contactPhone: undefined,
        avatar: undefined,
        createdAt: new Date(),
      };

      prisma.user.findFirst = mock(async () => null);
      prisma.role.findUnique = mock(async () => ({ id: 3, name: 'Donor' }));
      prisma.$transaction = mock(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            create: mock(async () => mockCreatedUser),
          },
          monkProfile: {
            create: mock(async () => null),
          },
        };
        return cb(tx);
      });

      const response = await registerUser({
        name: 'Daw Hla',
        phoneNumber: '09100000002',
        password: 'Password123!',
        roleId: 3, // Donor
      });

      expect(response.id).toBe(202);
      expect(response.roleId).toBe(3);
      expect(response.roleName).toBe('Donor');
      expect(response.accessToken).toBe('access_token_for_202_3');
      expect(response.refreshToken).toBe('refresh_token_for_202_3');
      expect(Array.isArray(response.permissions)).toBe(true);
    });
  });

  describe('loginUser', () => {
    it('returns authenticated user DTO matching roleId: 2 for Monk', async () => {
      const hashedPassword = await Bun.password.hash('Password123!');
      const mockUser = {
        id: 201,
        phone: '09100000001',
        name: 'U Thuzana',
        password: hashedPassword,
        email: 'thuzana@monastery.org',
        roleId: 2,
        contactPhone: null,
        avatar: null,
        createdAt: new Date(),
        monkProfile: {
          id: 1,
          userId: 201,
          monasteryName: 'Mahasi Yeiktha',
          monasteryAddress: 'Yangon',
        },
        role: { id: 2, name: 'Monk' },
      };

      prisma.user.findUnique = mock(async () => mockUser);

      const response = await loginUser({
        phoneNumber: '09100000001',
        password: 'Password123!',
      });

      expect(response.id).toBe(201);
      expect(response.roleId).toBe(2);
      expect(response.roleName).toBe('Monk');
      expect(response.accessToken).toBe('access_token_for_201_2');
      expect(response.refreshToken).toBe('refresh_token_for_201_2');
      expect(Array.isArray(response.permissions)).toBe(true);
    });

    it('returns authenticated user DTO matching roleId: 3 for Donor', async () => {
      const hashedPassword = await Bun.password.hash('Password123!');
      const mockUser = {
        id: 202,
        phone: '09100000002',
        name: 'Daw Hla',
        password: hashedPassword,
        email: 'dawhla@gmail.com',
        roleId: 3,
        contactPhone: null,
        avatar: null,
        createdAt: new Date(),
        monkProfile: null,
        role: { id: 3, name: 'Donor' },
      };

      prisma.user.findUnique = mock(async () => mockUser);

      const response = await loginUser({
        phoneNumber: '09100000002',
        password: 'Password123!',
      });

      expect(response.id).toBe(202);
      expect(response.roleId).toBe(3);
      expect(response.roleName).toBe('Donor');
      expect(response.accessToken).toBe('access_token_for_202_3');
      expect(response.refreshToken).toBe('refresh_token_for_202_3');
      expect(Array.isArray(response.permissions)).toBe(true);
    });
  });

  describe('refreshTokenService', () => {
    it('returns token and refreshToken', async () => {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('@/config/env');
      const validRefreshToken = jwt.default.sign(
        { userId: 201, roleId: 1 },
        env.JWT_REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      prisma.refreshToken.findFirst = mock(async () => ({
        id: 1,
        refreshToken: validRefreshToken,
        userId: 201,
        revokedAt: null,
      }));

      prisma.$transaction = mock(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            findFirst: mock(async () => ({ id: 201, roleId: 1, role: { name: 'Monk' } })),
          },
          refreshToken: {
            update: mock(async () => ({})),
          },
        };
        return cb(tx);
      });

      const result = await refreshTokenService(validRefreshToken, 201);
      expect(result.id).toBe(201);
      expect(result.roleId).toBe(1);
      expect(result.roleName).toBe('Monk');
      expect(result.accessToken).toBe('access_token_for_201_1');
      expect(result.refreshToken).toBe('refresh_token_for_201_1');
      expect(Array.isArray(result.permissions)).toBe(true);
    });

    it('rejects if expected userId does not match token payload userId', async () => {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('@/config/env');
      const validRefreshToken = jwt.default.sign(
        { userId: 201, roleId: 1 },
        env.JWT_REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      expect(refreshTokenService(validRefreshToken, 999)).rejects.toThrow(
        'Invalid or expired Refresh Token'
      );
    });
  });
});

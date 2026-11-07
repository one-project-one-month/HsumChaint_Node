import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Request, Response } from 'express';
import { getLoginMode, login, refreshAccessToken, register } from './auth.controller';
import type { LoginInput, RefreshTokenInput, RegisterInput } from './auth.schema';

const mockRedisStore = new Map<string, string>();

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
    if (roleId === 1) return ['Monastery.Create', 'Donation.Create', 'Donation.View'];
    if (roleId === 2) return ['Donation.View', 'Donation.Create'];
    return [
      'Donation.View',
      'Donation.Create',
      'User.View',
      'User.Create',
      'Role.View',
      'Role.Create',
    ];
  }),
}));

const prisma = {
  user: {
    findFirst: async (): Promise<unknown> => null,
    findUnique: async (): Promise<unknown> => null,
    create: async (): Promise<unknown> => null,
    update: async (): Promise<unknown> => null,
    count: async () => 0,
  },
  role: { findUnique: async (): Promise<unknown> => null },
  monkProfile: { create: async (): Promise<unknown> => null },
  refreshToken: {
    findFirst: async (): Promise<unknown> => null,
    update: async (): Promise<unknown> => null,
  },
  passwordResetToken: {
    create: async (): Promise<unknown> => null,
    findUnique: async (): Promise<unknown> => null,
    delete: async (): Promise<unknown> => null,
  },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
    callback(prisma),
};
mock.module('@/lib/prisma', () => ({ prisma }));

mock.module('@/helper/createAuthSession', () => ({
  createAuthSession: mock(async (_prismaClient: unknown, userId: number, roleId: number) => ({
    accessToken: `mock_jwt_access_token_${userId}_${roleId}`,
    refreshToken: `mock_jwt_refresh_token_${userId}_${roleId}`,
  })),
}));

interface MockResponse {
  statusCode: number;
  body: {
    isSuccess?: boolean;
    isFailure?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  headers: Record<string, string>;
  cookies: Record<string, unknown>;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  setHeader: (name: string, val: string) => MockResponse;
  cookie: (name: string, val: unknown, opt?: unknown) => MockResponse;
}

const createMockRes = () => {
  const res: MockResponse = {
    statusCode: 200,
    body: {},
    headers: {},
    cookies: {},
    status: mock((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: mock((payload: unknown) => {
      res.body = payload as Record<string, unknown>;
      return res;
    }),
    setHeader: mock((name: string, val: string) => {
      res.headers[name] = val;
      return res;
    }),
    cookie: mock((name: string, val: unknown) => {
      res.cookies[name] = val;
      return res;
    }),
  };
  return res as unknown as Response & MockResponse;
};

describe('Auth Controller Tests (.NET Alignment)', () => {
  beforeEach(() => {
    mockRedisStore.clear();
  });

  describe('register', () => {
    it('returns 200 OK with exact .NET void envelope on successful registration', async () => {
      prisma.user.findFirst = mock(async () => null);
      prisma.role.findUnique = mock(async () => ({ id: 2, name: 'Donor' }));
      prisma.$transaction = mock(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            create: mock(async () => ({
              id: 11,
              phone: '09750385592',
              name: 'Than Thar',
              roleId: 2,
              createdAt: new Date(),
            })),
          },
          monkProfile: { create: mock(async () => null) },
        };
        return cb(tx);
      });

      const req = {
        body: {
          name: 'Than Thar',
          phone: '09750385592',
          phoneNumber: '09750385592',
          password: 'Password123!',
          roleId: 2,
        },
      } as unknown as Request<unknown, unknown, RegisterInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await register(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        isSuccess: true,
        message: 'Register Successful',
        isFailure: false,
      });
      expect(res.body.data).toBeUndefined();
    });

    it('rejects attempt to register as protected Admin role (roleId: 3) with 403 Forbidden', async () => {
      const req = {
        body: {
          name: 'Hacker Admin',
          phone: '09999999998',
          password: 'Password123!',
          roleId: 3,
        },
      } as unknown as Request<unknown, unknown, RegisterInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await register(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = (next.mock.calls[0] as unknown[])[0] as { statusCode: number; message: string };
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Forbidden');
    });

    it('rejects donor registration with monastery information with 400 Bad Request', async () => {
      const req = {
        body: {
          name: 'Than Thar',
          phone: '09750385592',
          password: 'Than1234@',
          roleId: 2,
          monasteryName: 'Ti-Nilar Monastery',
          monasteryAddress: 'Pyin Oo Lwin',
        },
      } as unknown as Request<unknown, unknown, RegisterInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await register(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = (next.mock.calls[0] as unknown[])[0] as { statusCode: number; message: string };
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Donors cannot have monastery name or monastery address');
    });
  });

  describe('login', () => {
    it('returns 200 OK with exact .NET login envelope for Admin', async () => {
      const password = await Bun.password.hash('Password123!');
      prisma.user.findUnique = mock(async () => ({
        id: 1,
        phone: '09999999999',
        name: 'SuperAdmin',
        password,
        roleId: 3,
        role: { id: 3, name: 'Admin' },
        monkProfile: null,
      }));

      const req = {
        body: {
          phone: '09999999999',
          password: 'Password123!',
        },
      } as unknown as Request<unknown, unknown, LoginInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await login(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Login Successful');
      expect(res.body.isFailure).toBe(false);
      expect(res.body.data).toEqual({
        id: 1,
        roleId: 3,
        roleName: 'Admin',
        permissions: [
          'Donation.View',
          'Donation.Create',
          'User.View',
          'User.Create',
          'Role.View',
          'Role.Create',
        ],
        accessToken: 'mock_jwt_access_token_1_3',
        refreshToken: 'mock_jwt_refresh_token_1_3',
      });
      // Ensure extra legacy fields are removed
      expect(res.body.data?.token).toBeUndefined();
      expect(res.body.data?.userId).toBeUndefined();
      expect(res.body.data?.phone).toBeUndefined();
      expect(res.body.data?.user).toBeUndefined();
    });

    it('forwards 400 Bad Request with "Phone number or password incorrect!" on failed login', async () => {
      prisma.user.findUnique = mock(async () => null);

      const req = {
        body: {
          phone: '09999999999',
          password: 'wrongPassword',
        },
      } as unknown as Request<unknown, unknown, LoginInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await login(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = (next.mock.calls[0] as unknown[])[0] as { statusCode: number; message: string };
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Phone number or password incorrect!');
    });
  });

  describe('refreshAccessToken', () => {
    it('returns 200 OK with exact .NET refresh envelope when valid userId and refreshToken are provided', async () => {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('@/config/env');
      const validRefreshToken = jwt.default.sign(
        { userId: 2, roleId: 1 },
        env.JWT_REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      prisma.refreshToken.findFirst = mock(async () => ({
        id: 5,
        refreshToken: validRefreshToken,
        userId: 2,
        revokedAt: null,
      }));

      prisma.$transaction = mock(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            findFirst: mock(async () => ({ id: 2, roleId: 1, role: { name: 'Monk' } })),
          },
          refreshToken: {
            update: mock(async () => ({})),
          },
        };
        return cb(tx);
      });

      const req = {
        body: {
          userId: 2,
          refreshToken: validRefreshToken,
        },
        cookies: {},
      } as unknown as Request<unknown, unknown, RefreshTokenInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await refreshAccessToken(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.isSuccess).toBe(true);
      expect(res.body.message).toBe('Successful');
      expect(res.body.isFailure).toBe(false);
      expect(res.body.data).toEqual({
        id: 2,
        roleId: 1,
        roleName: 'Monk',
        permissions: ['Monastery.Create', 'Donation.Create', 'Donation.View'],
        accessToken: 'mock_jwt_access_token_2_1',
        refreshToken: 'mock_jwt_refresh_token_2_1',
      });
      expect(res.body.data?.token).toBeUndefined();
    });

    it('rejects incorrect refreshToken with 400 Bad Request', async () => {
      const req = {
        body: {
          userId: 12,
          refreshToken: 'invalid.bogus.jwt.token',
        },
        cookies: {},
      } as unknown as Request<unknown, unknown, RefreshTokenInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await refreshAccessToken(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = (next.mock.calls[0] as unknown[])[0] as { statusCode: number; message: string };
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Invalid or expired Refresh Token');
    });

    it('rejects mismatched userId with 400 Bad Request', async () => {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('@/config/env');
      const tokenForUser2 = jwt.default.sign(
        { userId: 2, roleId: 1 },
        env.JWT_REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      const req = {
        body: {
          userId: 99,
          refreshToken: tokenForUser2,
        },
        cookies: {},
      } as unknown as Request<unknown, unknown, RefreshTokenInput>;
      const res = createMockRes();
      const next = mock(() => {});

      await refreshAccessToken(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = (next.mock.calls[0] as unknown[])[0] as { statusCode: number; message: string };
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Invalid or expired Refresh Token');
    });
  });

  describe('getLoginMode', () => {
    it('returns active login mode configuration', async () => {
      const req = {} as Request;
      const res = createMockRes();
      const next = mock(() => {});

      await getLoginMode(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        isSuccess: true,
        message: 'Success',
        isFailure: false,
        data: {
          code: 'phone_or_email',
          requirePhoneVerification: false,
          requireEmailVerification: true,
        },
      });
    });
  });
});

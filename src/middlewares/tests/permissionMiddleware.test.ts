import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextFunction, Request, Response } from 'express';
import {
  clearSpaceRolePermissionsCache,
  getSpaceRolePermissions,
  requireSpacePermission,
} from '@/middlewares/permissionMiddleware';
import { AppError } from '@/utils/AppError';
import type { TokenPayload } from '@/utils/jwt';

interface MockSpaceRolePermission {
  id: number;
  spaceRoleId: number;
  spacePermissionId: number;
  isDeleted: boolean;
  spacePermission: { id: number; name: string; isDeleted: boolean };
  spaceRole: { id: number; name: string; isDeleted: boolean };
}

interface MockMember {
  id: number;
  userId: number;
  monasterySpaceId: number;
  spaceRoleId: number;
  isOwner: boolean;
  user: { id: number; isDeleted: boolean };
  monasterySpace: { id: number; isDeleted: boolean };
}

let mockSpaceRolePermissions: MockSpaceRolePermission[] = [];
let mockMembers: MockMember[] = [];
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

mock.module('@/lib/prisma', () => ({
  prisma: {
    spaceRolePermission: {
      findMany: mock(
        async ({ where }: { where: { spaceRoleId?: number; isDeleted?: boolean } }) => {
          return mockSpaceRolePermissions.filter(
            (srp) =>
              (!where.spaceRoleId || srp.spaceRoleId === where.spaceRoleId) &&
              (where.isDeleted === undefined || srp.isDeleted === where.isDeleted)
          );
        }
      ),
    },
    monasteryMember: {
      findFirst: mock(
        async ({ where }: { where: { userId?: number; monasterySpaceId?: number } }) => {
          return (
            mockMembers.find(
              (m) =>
                (!where.userId || m.userId === where.userId) &&
                (!where.monasterySpaceId || m.monasterySpaceId === where.monasterySpaceId)
            ) ?? null
          );
        }
      ),
    },
  },
}));

describe('Space RBAC & requireSpacePermission Middleware', () => {
  beforeEach(() => {
    mockSpaceRolePermissions = [];
    mockMembers = [];
    mockRedisStore.clear();
  });

  describe('getSpaceRolePermissions & Cache', () => {
    it('fetches permissions from DB when Redis cache is empty and populates Redis', async () => {
      mockSpaceRolePermissions = [
        {
          id: 1,
          spaceRoleId: 2, // Space Moderator
          spacePermissionId: 10,
          isDeleted: false,
          spacePermission: {
            id: 10,
            name: 'Space.Donation.Review',
            isDeleted: false,
          },
          spaceRole: { id: 2, name: 'Space Moderator', isDeleted: false },
        },
        {
          id: 2,
          spaceRoleId: 2,
          spacePermissionId: 11,
          isDeleted: false,
          spacePermission: {
            id: 11,
            name: 'Space.Donation.Schedule',
            isDeleted: false,
          },
          spaceRole: { id: 2, name: 'Space Moderator', isDeleted: false },
        },
      ];

      const perms = await getSpaceRolePermissions(2);
      expect(perms).toEqual(['Space.Donation.Review', 'Space.Donation.Schedule']);
      expect(mockRedisStore.get('space_role:2:permissions')).toBe(
        JSON.stringify(['Space.Donation.Review', 'Space.Donation.Schedule'])
      );
    });

    it('returns cached permissions from Redis without calling DB if present', async () => {
      mockRedisStore.set(
        'space_role:3:permissions',
        JSON.stringify(['Space.View', 'Space.Donation.Create'])
      );

      const perms = await getSpaceRolePermissions(3);
      expect(perms).toEqual(['Space.View', 'Space.Donation.Create']);
    });

    it('clears specific space role cache via clearSpaceRolePermissionsCache', async () => {
      mockRedisStore.set('space_role:3:permissions', JSON.stringify(['test']));
      await clearSpaceRolePermissionsCache(3);
      expect(mockRedisStore.has('space_role:3:permissions')).toBe(false);
    });
  });

  describe('requireSpacePermission Middleware', () => {
    const executeMiddleware = async (
      middleware: ReturnType<typeof requireSpacePermission>,
      reqPartial: {
        user?: Partial<TokenPayload>;
        params?: Record<string, string>;
        query?: Record<string, string>;
        body?: Record<string, unknown>;
      }
    ): Promise<Error | undefined> => {
      return new Promise((resolve) => {
        const req = reqPartial as unknown as Request;
        const res = {} as Response;
        const next: NextFunction = (err?: unknown) => {
          resolve(err as Error | undefined);
        };
        middleware(req, res, next);
      });
    };

    it('rejects with 401 if req.user is missing', async () => {
      const mw = requireSpacePermission('Space.View');
      const err = await executeMiddleware(mw, { params: { id: '1' } });
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    });

    it('rejects with 400 if space ID cannot be resolved', async () => {
      const mw = requireSpacePermission('Space.View');
      const err = await executeMiddleware(mw, {
        user: { userId: 5, roleId: 1 },
        params: {},
        query: {},
        body: {},
      });
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
    });

    it('allows SuperAdmin (roleId 3) directly without checking monastery membership', async () => {
      const mw = requireSpacePermission('Space.Delete');
      const err = await executeMiddleware(mw, {
        user: { userId: 99, roleId: 3 },
        params: { id: '9' },
      });
      expect(err).toBeUndefined();
    });

    it('rejects with 403 if user is not a member of the space', async () => {
      const mw = requireSpacePermission('Space.View');
      const err = await executeMiddleware(mw, {
        user: { userId: 10, roleId: 2 },
        params: { id: '9' },
      });
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).message).toContain('not a member');
    });

    it('allows Space Owner (isOwner: true) for any permission including Space.Delete', async () => {
      mockMembers = [
        {
          id: 1,
          userId: 10,
          monasterySpaceId: 9,
          spaceRoleId: 1,
          isOwner: true,
          user: { id: 10, isDeleted: false },
          monasterySpace: { id: 9, isDeleted: false },
        },
      ];

      const mw = requireSpacePermission('Space.Delete');
      const err = await executeMiddleware(mw, {
        user: { userId: 10, roleId: 1 },
        params: { id: '9' },
      });
      expect(err).toBeUndefined();
    });

    it('STRICTLY BLOCKS Space Admin (spaceRoleId 1, isOwner: false) from Space.Delete', async () => {
      mockMembers = [
        {
          id: 2,
          userId: 15,
          monasterySpaceId: 9,
          spaceRoleId: 1, // Space Admin
          isOwner: false,
          user: { id: 15, isDeleted: false },
          monasterySpace: { id: 9, isDeleted: false },
        },
      ];

      const mw = requireSpacePermission('Space.Delete');
      const err = await executeMiddleware(mw, {
        user: { userId: 15, roleId: 2 },
        params: { id: '9' },
      });
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).message).toContain('Only the monastery space owner can delete');
    });

    it('allows Space Admin (spaceRoleId 1, isOwner: false) for non-delete actions like Space.Update and Member Invite', async () => {
      mockMembers = [
        {
          id: 2,
          userId: 15,
          monasterySpaceId: 9,
          spaceRoleId: 1, // Space Admin
          isOwner: false,
          user: { id: 15, isDeleted: false },
          monasterySpace: { id: 9, isDeleted: false },
        },
      ];

      const mwUpdate = requireSpacePermission('Space.Update');
      const errUpdate = await executeMiddleware(mwUpdate, {
        user: { userId: 15, roleId: 2 },
        params: { id: '9' },
      });
      expect(errUpdate).toBeUndefined();

      const mwInvite = requireSpacePermission('Space.Member.Invite');
      const errInvite = await executeMiddleware(mwInvite, {
        user: { userId: 15, roleId: 2 },
        params: { id: '9' },
      });
      expect(errInvite).toBeUndefined();
    });

    it('evaluates dynamic role permissions: allows Space Editor for Space.Donation.Create', async () => {
      mockMembers = [
        {
          id: 3,
          userId: 20,
          monasterySpaceId: 9,
          spaceRoleId: 3, // Space Editor
          isOwner: false,
          user: { id: 20, isDeleted: false },
          monasterySpace: { id: 9, isDeleted: false },
        },
      ];
      mockSpaceRolePermissions = [
        {
          id: 30,
          spaceRoleId: 3,
          spacePermissionId: 100,
          isDeleted: false,
          spacePermission: {
            id: 100,
            name: 'Space.Donation.Create',
            isDeleted: false,
          },
          spaceRole: { id: 3, name: 'Space Editor', isDeleted: false },
        },
      ];

      const mw = requireSpacePermission('Donation.Create', 'spaceId');
      const err = await executeMiddleware(mw, {
        user: { userId: 20, roleId: 2 },
        params: { spaceId: '9' },
      });
      expect(err).toBeUndefined();
    });

    it('evaluates dynamic role permissions: BLOCKS Space Editor from Space.Donation.Review and Space.Donation.Delete', async () => {
      mockMembers = [
        {
          id: 3,
          userId: 20,
          monasterySpaceId: 9,
          spaceRoleId: 3, // Space Editor
          isOwner: false,
          user: { id: 20, isDeleted: false },
          monasterySpace: { id: 9, isDeleted: false },
        },
      ];
      mockSpaceRolePermissions = [
        {
          id: 30,
          spaceRoleId: 3,
          spacePermissionId: 100,
          isDeleted: false,
          spacePermission: {
            id: 100,
            name: 'Space.Donation.Create',
            isDeleted: false,
          },
          spaceRole: { id: 3, name: 'Space Editor', isDeleted: false },
        },
      ];

      // Review attempt
      const mwReview = requireSpacePermission('Donation.Review', 'spaceId');
      const errReview = await executeMiddleware(mwReview, {
        user: { userId: 20, roleId: 2 },
        params: { spaceId: '9' },
      });
      expect(errReview).toBeInstanceOf(AppError);
      expect((errReview as AppError).statusCode).toBe(403);
      expect((errReview as AppError).message).toContain('Missing space permission');

      // Delete attempt
      const mwDelete = requireSpacePermission('Donation.Delete', 'spaceId');
      const errDelete = await executeMiddleware(mwDelete, {
        user: { userId: 20, roleId: 2 },
        params: { spaceId: '9' },
      });
      expect(errDelete).toBeInstanceOf(AppError);
      expect((errDelete as AppError).statusCode).toBe(403);
    });
  });
});

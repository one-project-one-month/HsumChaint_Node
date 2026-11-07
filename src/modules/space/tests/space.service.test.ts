import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { SPACE_ROLES } from '../space.permissions';
import {
  createMonasteryService,
  deleteMonasteryService,
  getCurrentUserSpacePermissionsService,
  getMembersService,
  getMonasteryService,
  getMyMonasteriesFeedService,
  getMyMonasteriesService,
  getPublicMonasteriesCatalogService,
  getPublicMonasteriesFeedService,
  getSpaceRoleByIdService,
  getSpaceRolesService,
  inviteMemberService,
  removeMemberService,
  respondToInvitationService,
  searchPublicMonasteriesFeedService,
  searchPublicMonasteriesService,
  updateMemberRoleService,
  updateMonasteryService,
} from '../space.service';

interface MockUser {
  id: number;
  name: string;
  phone: string;
  roleId: number;
  isDeleted: boolean;
}

interface MockSpace {
  id: number;
  monasteryName: string;
  description?: string | null;
  address?: string | null;
  createdById: number;
  isDeleted: boolean;
}

interface MockMember {
  id: number;
  userId: number;
  monasterySpaceId: number;
  spaceRoleId: number;
  isOwner: boolean;
}

interface MockRole {
  id: number;
  name: string;
  isDeleted: boolean;
}

interface MockSpaceRole {
  id: number;
  name: string;
  isDeleted: boolean;
}

interface MockPermission {
  id: number;
  name: string;
  isDeleted: boolean;
}

interface MockRolePermission {
  id: number;
  roleId: number;
  permissionId: number;
}

interface MockSpacePermission {
  id: number;
  name: string;
  isDeleted: boolean;
}

interface MockSpaceRolePermission {
  id: number;
  spaceRoleId: number;
  spacePermissionId: number;
  isDeleted?: boolean;
}

interface MockInvitation {
  id: number;
  monasterySpaceId: number;
  invitedUserId: number;
  invitedById: number;
  spaceRoleId: number;
  status: number;
  createdAt: Date;
}

interface MockNotification {
  id: number;
  userId: number;
  type: number;
  message: string;
  isRead: boolean;
  isDeleted: boolean;
}

let mockUsers: MockUser[] = [];
let mockSpaces: MockSpace[] = [];
let mockMembers: MockMember[] = [];
let mockRoles: MockRole[] = [];
let mockSpaceRoles: MockSpaceRole[] = [];
let mockPermissions: MockPermission[] = [];
let mockRolePermissions: MockRolePermission[] = [];
let mockSpacePermissions: MockSpacePermission[] = [];
let mockSpaceRolePermissions: MockSpaceRolePermission[] = [];
let mockInvitations: MockInvitation[] = [];
let mockNotifications: MockNotification[] = [];
mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(async () => null),
    set: mock(async () => 'OK'),
    del: mock(async () => 1),
    keys: mock(async () => []),
  },
}));

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(
        async ({ where }: { where: { id?: number; phone?: string; isDeleted?: boolean } }) => {
          const u = mockUsers.find(
            (u) =>
              (!where.id || u.id === where.id) &&
              (!where.phone || u.phone === where.phone) &&
              (!where.isDeleted || !u.isDeleted)
          );
          if (!u) return null;
          return {
            ...u,
            role: mockRoles.find((r) => r.id === u.roleId) ?? null,
          };
        }
      ),
      findUnique: mock(async ({ where }: { where: { id: number } }) => {
        return mockUsers.find((u) => u.id === where.id) ?? null;
      }),
    },
    monasterySpace: {
      create: mock(async ({ data }: { data: Omit<MockSpace, 'id'> }) => {
        const space: MockSpace = {
          id: mockSpaces.length + 1,
          monasteryName: data.monasteryName,
          description: data.description,
          address: data.address,
          createdById: data.createdById,
          isDeleted: false,
        };
        mockSpaces.push(space);
        return space;
      }),
      findMany: mock(
        async (args?: {
          where?: {
            id?: { gt?: number };
            OR?: Array<{
              monasteryName?: { contains?: string };
              address?: { contains?: string };
            }>;
          };
          skip?: number;
          take?: number;
          include?: unknown;
          orderBy?: unknown;
        }) => {
          let list = mockSpaces.filter((s) => !s.isDeleted);
          if (args?.where) {
            if (args.where.id?.gt !== undefined) {
              list = list.filter((s) => s.id > (args.where?.id?.gt ?? 0));
            }
            if (args.where.OR && Array.isArray(args.where.OR)) {
              list = list.filter((s) =>
                args.where?.OR?.some((cond) => {
                  if (cond.monasteryName?.contains) {
                    return s.monasteryName
                      .toLowerCase()
                      .includes(cond.monasteryName.contains.toLowerCase());
                  }
                  if (cond.address?.contains) {
                    return (s.address ?? '')
                      .toLowerCase()
                      .includes(cond.address.contains.toLowerCase());
                  }
                  if (cond.description?.contains) {
                    return (s.description ?? '')
                      .toLowerCase()
                      .includes(cond.description.contains.toLowerCase());
                  }
                  return false;
                })
              );
            }
          }
          const skip = args?.skip ?? 0;
          if (skip > 0) {
            list = list.slice(skip);
          }
          if (args?.take !== undefined) {
            list = list.slice(0, args.take);
          }
          if (args?.include?.createdBy || args?.include?._count) {
            return list.map((s) => {
              const creator = mockUsers.find((u) => u.id === s.createdById);
              return {
                ...s,
                createdBy: creator ? { name: creator.name } : null,
                _count: {
                  members: mockMembers.filter((m) => m.monasterySpaceId === s.id).length,
                },
              };
            });
          }
          return list;
        }
      ),
      findUnique: mock(async ({ where }: { where: { id: number } }) => {
        return mockSpaces.find((s) => s.id === where.id && !s.isDeleted) ?? null;
      }),
      findFirst: mock(async ({ where }: { where: { id: number; isDeleted?: boolean } }) => {
        return (
          mockSpaces.find(
            (s) =>
              s.id === where.id &&
              (where.isDeleted === undefined || s.isDeleted === where.isDeleted)
          ) ?? null
        );
      }),
      update: mock(async ({ where, data }: { where: { id: number }; data: Partial<MockSpace> }) => {
        const space = mockSpaces.find((s) => s.id === where.id);
        if (!space) throw new Error('Not found');
        Object.assign(space, data);
        return space;
      }),
      delete: mock(async ({ where }: { where: { id: number } }) => {
        const index = mockSpaces.findIndex((s) => s.id === where.id);
        if (index === -1) throw new Error('Not found');
        return mockSpaces.splice(index, 1)[0];
      }),
      count: mock(
        async (args?: {
          where?: {
            OR?: Array<{
              monasteryName?: { contains?: string };
              address?: { contains?: string };
            }>;
          };
        }) => {
          let list = mockSpaces.filter((s) => !s.isDeleted);
          if (args?.where?.OR && Array.isArray(args.where.OR)) {
            list = list.filter((s) =>
              args.where?.OR?.some((cond) => {
                if (cond.monasteryName?.contains) {
                  return s.monasteryName
                    .toLowerCase()
                    .includes(cond.monasteryName.contains.toLowerCase());
                }
                if (cond.address?.contains) {
                  return (s.address ?? '')
                    .toLowerCase()
                    .includes(cond.address.contains.toLowerCase());
                }
                if (cond.description?.contains) {
                  return (s.description ?? '')
                    .toLowerCase()
                    .includes(cond.description.contains.toLowerCase());
                }
                return false;
              })
            );
          }
          return list.length;
        }
      ),
    },
    monasteryMember: {
      create: mock(
        async ({
          data,
        }: {
          data: {
            userId: number;
            monasterySpaceId: number;
            spaceRoleId?: number;
            role?: number;
            isOwner: boolean;
          };
        }) => {
          const member: MockMember = {
            id: mockMembers.length + 1,
            userId: data.userId,
            monasterySpaceId: data.monasterySpaceId,
            spaceRoleId: data.spaceRoleId ?? data.role ?? 1,
            isOwner: data.isOwner,
          };
          mockMembers.push(member);
          return {
            ...member,
            spaceRole: mockSpaceRoles.find((sr) => sr.id === member.spaceRoleId),
          };
        }
      ),
      findFirst: mock(
        async ({
          where,
        }: {
          where: {
            userId?: number;
            monasterySpaceId?: number;
            spaceRoleId?: number;
            role?: number;
            user?: { isDeleted?: boolean };
          };
        }) => {
          const targetRole = where.spaceRoleId ?? where.role;
          const m = mockMembers.find((m) => {
            const user = mockUsers.find((u) => u.id === m.userId);
            if (where.user?.isDeleted !== undefined && user?.isDeleted !== where.user.isDeleted) {
              return false;
            }
            return (
              (where.userId === undefined || m.userId === where.userId) &&
              (where.monasterySpaceId === undefined ||
                m.monasterySpaceId === where.monasterySpaceId) &&
              (targetRole === undefined || m.spaceRoleId === targetRole)
            );
          });
          if (!m) return null;
          return {
            ...m,
            spaceRole: mockSpaceRoles.find((sr) => sr.id === m.spaceRoleId),
          };
        }
      ),
      findMany: mock(
        async (args: {
          where: {
            userId?: number;
            monasterySpaceId?: number | { gt?: number };
            user?: { isDeleted?: boolean };
          };
          take?: number;
          skip?: number;
          include?: unknown;
          orderBy?: unknown;
        }) => {
          const { where } = args;
          let list = mockMembers.filter((m) => {
            const user = mockUsers.find((u) => u.id === m.userId);
            if (where.user?.isDeleted !== undefined && user?.isDeleted !== where.user.isDeleted) {
              return false;
            }
            if (where.userId !== undefined && m.userId !== where.userId) {
              return false;
            }
            if (where.monasterySpaceId !== undefined) {
              if (typeof where.monasterySpaceId === 'number') {
                if (m.monasterySpaceId !== where.monasterySpaceId) return false;
              } else if (
                typeof where.monasterySpaceId === 'object' &&
                where.monasterySpaceId?.gt !== undefined
              ) {
                if (m.monasterySpaceId <= where.monasterySpaceId.gt) return false;
              }
            }
            return true;
          });
          if (args.skip && args.skip > 0) {
            list = list.slice(args.skip);
          }
          if (args.take !== undefined) {
            list = list.slice(0, args.take);
          }
          return list.map((m) => ({
            ...m,
            user: mockUsers.find((u) => u.id === m.userId),
            monasterySpace: mockSpaces.find((s) => s.id === m.monasterySpaceId),
            spaceRole: mockSpaceRoles.find((sr) => sr.id === m.spaceRoleId),
          }));
        }
      ),
      update: mock(
        async ({
          where,
          data,
        }: {
          where: { id: number };
          data: Partial<MockMember> & { role?: number };
        }) => {
          const member = mockMembers.find((m) => m.id === where.id);
          if (!member) throw new Error('Not found');
          if (data.spaceRoleId !== undefined) member.spaceRoleId = data.spaceRoleId;
          else if (data.role !== undefined) member.spaceRoleId = data.role;
          if (data.isOwner !== undefined) member.isOwner = data.isOwner;

          return {
            ...member,
            user: mockUsers.find((u) => u.id === member.userId),
            spaceRole: mockSpaceRoles.find((sr) => sr.id === member.spaceRoleId),
          };
        }
      ),
      delete: mock(async ({ where }: { where: { id: number } }) => {
        const index = mockMembers.findIndex((m) => m.id === where.id);
        if (index === -1) throw new Error('Not found');
        return mockMembers.splice(index, 1)[0];
      }),
      deleteMany: mock(async ({ where }: { where: { monasterySpaceId?: number } }) => {
        const init = mockMembers.length;
        mockMembers = mockMembers.filter(
          (m) => !where.monasterySpaceId || m.monasterySpaceId !== where.monasterySpaceId
        );
        return { count: init - mockMembers.length };
      }),
      count: mock(
        async ({
          where,
        }: {
          where?: {
            userId?: number;
            monasterySpaceId?: number;
            spaceRoleId?: number;
            role?: number;
            user?: { isDeleted?: boolean };
          };
        }) => {
          const targetRole = where?.spaceRoleId ?? where?.role;
          return mockMembers.filter((m) => {
            const user = mockUsers.find((u) => u.id === m.userId);
            if (where?.user?.isDeleted !== undefined && user?.isDeleted !== where.user.isDeleted) {
              return false;
            }
            return (
              (!where?.userId || m.userId === where.userId) &&
              (!where?.monasterySpaceId || m.monasterySpaceId === where.monasterySpaceId) &&
              (!targetRole || m.spaceRoleId === targetRole)
            );
          }).length;
        }
      ),
    },
    spaceRole: {
      findMany: mock(
        async ({
          where,
          include,
        }: {
          where?: { id?: { in?: number[] }; isDeleted?: boolean };
          include?: { permissions?: { include?: { spacePermission?: boolean } } };
        } = {}) => {
          const list = mockSpaceRoles.filter(
            (r) =>
              (!where?.isDeleted || !r.isDeleted) && (!where?.id?.in || where.id.in.includes(r.id))
          );
          if (include?.permissions) {
            return list.map((role) => ({
              ...role,
              permissions: mockSpaceRolePermissions
                .filter((srp) => srp.spaceRoleId === role.id && !srp.isDeleted)
                .map((srp) => ({
                  ...srp,
                  spacePermission: mockSpacePermissions.find(
                    (sp) => sp.id === srp.spacePermissionId
                  ),
                })),
            }));
          }
          return list;
        }
      ),
      findFirst: mock(
        async ({
          where,
          include,
        }: {
          where: { id?: number; name?: string; isDeleted?: boolean };
          include?: { permissions?: { include?: { spacePermission?: boolean } } };
        }) => {
          const role =
            mockSpaceRoles.find(
              (r) =>
                (!where.id || r.id === where.id) &&
                (!where.name || r.name.toLowerCase() === where.name.toLowerCase()) &&
                (!where.isDeleted || !r.isDeleted)
            ) ?? null;
          if (!role) return null;
          if (include?.permissions) {
            return {
              ...role,
              permissions: mockSpaceRolePermissions
                .filter((srp) => srp.spaceRoleId === role.id && !srp.isDeleted)
                .map((srp) => ({
                  ...srp,
                  spacePermission: mockSpacePermissions.find(
                    (sp) => sp.id === srp.spacePermissionId
                  ),
                })),
            };
          }
          return role;
        }
      ),
      findUnique: mock(async ({ where }: { where: { id: number } }) => {
        return mockSpaceRoles.find((r) => r.id === where.id) ?? null;
      }),
    },
    spaceRolePermission: {
      count: mock(
        async ({
          where,
        }: {
          where: {
            spaceRoleId?: number;
            spacePermission?: { name?: { in?: string[] }; isDeleted?: boolean };
          };
        }) => {
          return mockSpaceRolePermissions.filter((srp) => {
            if (where.spaceRoleId && srp.spaceRoleId !== where.spaceRoleId) return false;
            const perm = mockSpacePermissions.find((p) => p.id === srp.spacePermissionId);
            if (!perm || perm.isDeleted) return false;
            if (
              where.spacePermission?.name?.in &&
              !where.spacePermission.name.in.includes(perm.name)
            )
              return false;
            return true;
          }).length;
        }
      ),
      findMany: mock(
        async ({
          where,
        }: {
          where?: {
            spaceRoleId?: number;
            isDeleted?: boolean;
            spaceRole?: { isDeleted?: boolean };
            spacePermission?: { isDeleted?: boolean };
          };
        } = {}) => {
          return mockSpaceRolePermissions
            .filter((srp) => {
              if (where?.spaceRoleId && srp.spaceRoleId !== where.spaceRoleId) return false;
              return true;
            })
            .map((srp) => ({
              ...srp,
              spacePermission: mockSpacePermissions.find((p) => p.id === srp.spacePermissionId),
              spaceRole: mockSpaceRoles.find((r) => r.id === srp.spaceRoleId),
            }));
        }
      ),
    },
    role: {
      findMany: mock(
        async ({ where }: { where?: { id?: { in?: number[] }; isDeleted?: boolean } }) => {
          return mockRoles.filter(
            (r) =>
              (!where?.isDeleted || !r.isDeleted) && (!where?.id?.in || where.id.in.includes(r.id))
          );
        }
      ),
      findFirst: mock(
        async ({ where }: { where: { id?: number; name?: string; isDeleted?: boolean } }) => {
          return (
            mockRoles.find(
              (r) =>
                (!where.id || r.id === where.id) &&
                (!where.name || r.name.toLowerCase() === where.name.toLowerCase()) &&
                (!where.isDeleted || !r.isDeleted)
            ) ?? null
          );
        }
      ),
      findUnique: mock(async ({ where }: { where: { id: number } }) => {
        return mockRoles.find((r) => r.id === where.id) ?? null;
      }),
    },
    rolePermission: {
      count: mock(
        async ({
          where,
        }: {
          where: {
            roleId?: number;
            permission?: { name?: { in?: string[] }; isDeleted?: boolean };
          };
        }) => {
          return mockRolePermissions.filter((rp) => {
            if (where.roleId && rp.roleId !== where.roleId) return false;
            const perm = mockPermissions.find((p) => p.id === rp.permissionId);
            if (!perm || perm.isDeleted) return false;
            if (where.permission?.name?.in && !where.permission.name.in.includes(perm.name))
              return false;
            return true;
          }).length;
        }
      ),
      findMany: mock(async () => mockRolePermissions),
    },
    invitation: {
      create: mock(
        async ({
          data,
        }: {
          data: {
            monasterySpaceId: number;
            invitedUserId: number;
            invitedById: number;
            spaceRoleId?: number;
            role?: number;
            status: number;
          };
        }) => {
          const inv: MockInvitation = {
            id: mockInvitations.length + 1,
            monasterySpaceId: data.monasterySpaceId,
            invitedUserId: data.invitedUserId,
            invitedById: data.invitedById,
            spaceRoleId: data.spaceRoleId ?? data.role ?? 4,
            status: data.status,
            createdAt: new Date(),
          };
          mockInvitations.push(inv);
          return {
            ...inv,
            spaceRole: mockSpaceRoles.find((sr) => sr.id === inv.spaceRoleId),
          };
        }
      ),
      findFirst: mock(
        async ({
          where,
        }: {
          where: {
            monasterySpaceId?: number;
            invitedUserId?: number;
            spaceRoleId?: number;
            role?: number;
            status?: number;
          };
        }) => {
          const targetRole = where.spaceRoleId ?? where.role;
          const inv = mockInvitations.find(
            (i) =>
              (where.monasterySpaceId === undefined ||
                i.monasterySpaceId === where.monasterySpaceId) &&
              (where.invitedUserId === undefined || i.invitedUserId === where.invitedUserId) &&
              (targetRole === undefined || i.spaceRoleId === targetRole) &&
              (where.status === undefined || i.status === where.status)
          );
          if (!inv) return null;
          return {
            ...inv,
            spaceRole: mockSpaceRoles.find((sr) => sr.id === inv.spaceRoleId),
          };
        }
      ),
      findUnique: mock(async ({ where }: { where: { id: number } }) => {
        const inv = mockInvitations.find((i) => i.id === where.id);
        if (!inv) return null;
        return {
          ...inv,
          spaceRole: mockSpaceRoles.find((sr) => sr.id === inv.spaceRoleId),
        };
      }),
      update: mock(
        async ({ where, data }: { where: { id: number }; data: Partial<MockInvitation> }) => {
          const inv = mockInvitations.find((i) => i.id === where.id);
          if (!inv) throw new Error('Not found');
          Object.assign(inv, data);
          return {
            ...inv,
            spaceRole: mockSpaceRoles.find((sr) => sr.id === inv.spaceRoleId),
          };
        }
      ),
      deleteMany: mock(async ({ where }: { where: { monasterySpaceId?: number } }) => {
        const init = mockInvitations.length;
        mockInvitations = mockInvitations.filter(
          (i) => !where.monasterySpaceId || i.monasterySpaceId !== where.monasterySpaceId
        );
        return { count: init - mockInvitations.length };
      }),
    },
    notification: {
      create: mock(async ({ data }: { data: Omit<MockNotification, 'id'> }) => {
        const notif: MockNotification = {
          id: mockNotifications.length + 1,
          userId: data.userId,
          type: data.type,
          message: data.message,
          isRead: data.isRead ?? false,
          isDeleted: data.isDeleted ?? false,
        };
        mockNotifications.push(notif);
        return notif;
      }),
    },
    $transaction: mock(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { prisma } = await import('@/lib/prisma');
      return await callback(prisma);
    }),
  },
}));

describe('Monastery Service Unit Tests (matching C# HsumChaint)', () => {
  beforeEach(() => {
    mockRoles = [
      { id: 1, name: 'Monk', isDeleted: false },
      { id: 2, name: 'Donor', isDeleted: false },
      { id: 3, name: 'Admin', isDeleted: false },
    ];

    mockSpaceRoles = [
      { id: 1, name: 'Space Admin', isDeleted: false },
      { id: 2, name: 'Space Moderator', isDeleted: false },
      { id: 3, name: 'Space Editor', isDeleted: false },
      { id: 4, name: 'Space Member', isDeleted: false },
    ];

    mockPermissions = [
      { id: 1, name: 'Monastery.View', isDeleted: false },
      { id: 2, name: 'Monastery.Create', isDeleted: false },
      { id: 3, name: 'Monastery.Update', isDeleted: false },
      { id: 4, name: 'Monastery.Delete', isDeleted: false },
      { id: 5, name: 'Monastery.ManageMembers', isDeleted: false },
    ];

    mockSpacePermissions = [
      { id: 1, name: 'Space.View', isDeleted: false },
      { id: 2, name: 'Space.Update', isDeleted: false },
      { id: 3, name: 'Space.Delete', isDeleted: false },
      { id: 4, name: 'Space.Member.Invite', isDeleted: false },
      { id: 5, name: 'Space.Member.Manage', isDeleted: false },
      { id: 6, name: 'Space.Role.Manage', isDeleted: false },
      { id: 7, name: 'Space.Post.Create', isDeleted: false },
    ];

    mockRolePermissions = [
      // Monk has delete permission
      { id: 1, roleId: 1, permissionId: 4 },
      { id: 2, roleId: 1, permissionId: 5 },
    ];

    mockSpaceRolePermissions = [
      // Space Admin has manage members
      { id: 1, spaceRoleId: 1, spacePermissionId: 5 },
      // Space Moderator has view and invite members
      { id: 2, spaceRoleId: 2, spacePermissionId: 1 },
      { id: 3, spaceRoleId: 2, spacePermissionId: 4 },
      // Space Editor has view and post create
      { id: 4, spaceRoleId: 3, spacePermissionId: 1 },
      { id: 5, spaceRoleId: 3, spacePermissionId: 7 },
      // Space Member has view
      { id: 6, spaceRoleId: 4, spacePermissionId: 1 },
    ];

    mockUsers = [
      { id: 1, name: 'Sayadaw U Thila', phone: '09111111111', roleId: 1, isDeleted: false },
      { id: 2, name: 'Donor Ko Min', phone: '09222222222', roleId: 2, isDeleted: false },
      { id: 3, name: 'U Zaw', phone: '09333333333', roleId: 2, isDeleted: false },
      { id: 4, name: 'Admin User', phone: '09444444444', roleId: 3, isDeleted: false },
    ];

    mockSpaces = [];
    mockMembers = [];
    mockInvitations = [];
    mockNotifications = [];
  });

  describe('CreateMonastery', () => {
    it('should create monastery and add creator as owner with Space Admin role', async () => {
      const space = await createMonasteryService(1, {
        monasteryName: 'Maha Gandhayon',
        description: 'Historic Monastery in Amarapura',
        address: 'Amarapura, Mandalay',
      });

      expect(space.monasteryName).toBe('Maha Gandhayon');
      expect(space.createdById).toBe(1);
      expect(space.currentUserRoleId).toBe(SPACE_ROLES.SPACE_ADMIN);
      expect(space.currentUserRoleName).toBe('Space Admin');
      expect(space.isOwner).toBe(true);

      expect(mockSpaces.length).toBe(1);
      expect(mockMembers.length).toBe(1);
      expect(mockMembers[0].isOwner).toBe(true);
      expect(mockMembers[0].spaceRoleId).toBe(SPACE_ROLES.SPACE_ADMIN);
    });

    it('should reject creation without monastery name', async () => {
      expect(
        createMonasteryService(1, {
          monasteryName: '',
        })
      ).rejects.toThrow('Monastery name is required.');
    });
  });

  describe('UpdateMonastery & DeleteMonastery', () => {
    it('should update monastery details by authorized owner', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Initial Name' });

      const updated = await updateMonasteryService(1, space.id, {
        monasteryName: 'Updated Name',
        description: 'New Description',
      });

      expect(updated.monasteryName).toBe('Updated Name');
      expect(updated.description).toBe('New Description');
    });

    it('should delete monastery if authorized monk owner', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'To Delete' });
      const result = await deleteMonasteryService(1, space.id);

      expect(result.message).toBe('Monastery deleted successfully.');
      expect(mockSpaces.find((s) => s.id === space.id)?.isDeleted).toBe(true);
    });

    it('should reject deletion if not owner monk with delete permission', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'To Delete' });
      expect(deleteMonasteryService(2, space.id)).rejects.toThrow(
        'User is not authorized to delete this monastery.'
      );
    });
  });

  describe('GetMonastery & GetMyMonasteries', () => {
    it('should retrieve monastery details for member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery A' });
      const retrieved = await getMonasteryService(1, space.id);

      expect(retrieved.id).toBe(space.id);
      expect(retrieved.monasteryName).toBe('Monastery A');
      expect(retrieved.currentUserRoleName).toBe('Space Admin');
    });

    it('should reject retrieval for non-member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery A' });
      expect(getMonasteryService(2, space.id)).rejects.toThrow(
        'User is not a member of this monastery.'
      );
    });

    it('should allow System Admin to view any monastery without being a member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery A' });
      const retrieved = await getMonasteryService(4, space.id, 3);

      expect(retrieved.id).toBe(space.id);
      expect(retrieved.monasteryName).toBe('Monastery A');
      expect(retrieved.currentUserRoleName).toBe('Admin');
      expect(retrieved.isOwner).toBe(false);
    });

    it('should retrieve list of monasteries the user is member of', async () => {
      await createMonasteryService(1, { monasteryName: 'Monastery 1' });
      await createMonasteryService(1, { monasteryName: 'Monastery 2' });

      const result = await getMyMonasteriesService(1, { page: 1, limit: 10 });
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.items[0].currentUserRoleName).toBe('Space Admin');
    });

    it('should allow System Admin to list all monasteries even if not a member of them', async () => {
      await createMonasteryService(1, { monasteryName: 'Monastery 1' });
      await createMonasteryService(1, { monasteryName: 'Monastery 2' });

      const result = await getMyMonasteriesService(4, { page: 1, limit: 10 }, 3);
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('InviteMember & RespondToInvitation', () => {
    it('should create an invitation and send a notification', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Invite' });

      const invitation = await inviteMemberService(1, space.id, {
        roleId: SPACE_ROLES.SPACE_MEMBER, // 4
        userId: 2,
      });

      expect(invitation.status).toBe(0); // Pending
      expect(invitation.spaceRoleId).toBe(SPACE_ROLES.SPACE_MEMBER);
      expect(invitation.spaceRoleName).toBe('Space Member');
      expect(mockInvitations.length).toBe(1);
      expect(mockNotifications.length).toBe(1);
      expect(mockNotifications[0].userId).toBe(2);
      expect(mockNotifications[0].message).toBe('You have a new monastery invitation.');
    });

    it('should reject inviting self', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Invite' });

      expect(
        inviteMemberService(1, space.id, {
          roleId: SPACE_ROLES.SPACE_MEMBER,
          userId: 1,
        })
      ).rejects.toThrow('User cannot invite themselves.');
    });

    it('should reject inviting existing member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Invite' });
      mockMembers.push({
        id: 99,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      expect(
        inviteMemberService(1, space.id, {
          roleId: SPACE_ROLES.SPACE_MEMBER,
          userId: 2,
        })
      ).rejects.toThrow('User is already a monastery member.');
    });

    it('should allow user to accept invitation and become member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Invite' });
      const invitation = await inviteMemberService(1, space.id, {
        roleId: SPACE_ROLES.SPACE_MEMBER,
        userId: 2,
      });

      const response = await respondToInvitationService(2, invitation.invitationId, {
        status: 2, // Accept
      });

      expect(response.status).toBe(2);
      expect(mockMembers.some((m) => m.userId === 2 && m.monasterySpaceId === space.id)).toBe(true);
    });

    it('should allow user to reject invitation', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Invite' });
      const invitation = await inviteMemberService(1, space.id, {
        roleId: SPACE_ROLES.SPACE_MEMBER,
        userId: 2,
      });

      const response = await respondToInvitationService(2, invitation.invitationId, {
        status: 3, // Reject
      });

      expect(response.status).toBe(3);
      expect(mockMembers.some((m) => m.userId === 2 && m.monasterySpaceId === space.id)).toBe(
        false
      );
    });

    it('should allow space owner to invite a Space Admin, but invited Space Admin does not have Space.Delete permission', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Invite Admin' });
      const invitation = await inviteMemberService(1, space.id, {
        roleId: SPACE_ROLES.SPACE_ADMIN,
        userId: 2,
      });

      expect(invitation.spaceRoleId).toBe(SPACE_ROLES.SPACE_ADMIN);
      expect(invitation.spaceRoleName).toBe('Space Admin');

      // User 2 accepts invitation
      await respondToInvitationService(2, invitation.invitationId, { status: 2 });

      // User 2 retrieves space details
      const spaceDetails = await getMonasteryService(2, space.id);
      expect(spaceDetails.isOwner).toBe(false);
      expect(spaceDetails.currentUserRoleName).toBe('Space Admin');
      expect(spaceDetails.permissions).toContain('Space.View');
      expect(spaceDetails.permissions).toContain('Space.Update');
      expect(spaceDetails.permissions).not.toContain('Space.Delete');
    });

    it('should reject non-owner inviting a Space Admin', async () => {
      const space = await createMonasteryService(1, {
        monasteryName: 'Monastery Non-Owner Invite',
      });
      // User 2 is a Moderator (not owner)
      mockMembers.push({
        id: 50,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MODERATOR,
        isOwner: false,
      });

      // User 2 tries to invite user 3 as Space Admin
      await expect(
        inviteMemberService(2, space.id, {
          roleId: SPACE_ROLES.SPACE_ADMIN,
          userId: 3,
        })
      ).rejects.toThrow('Only the monastery space owner or system admin can invite a Space Admin.');
    });
  });

  describe('Member Management (getMembers, updateMemberRole, removeMember)', () => {
    it('should list all members of the monastery', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Members' });
      const result = await getMembersService(1, space.id, { page: 1, limit: 10 });

      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Sayadaw U Thila');
      expect(result.items[0].isOwner).toBe(true);
      expect(result.items[0].spaceRoleName).toBe('Space Admin');
      expect(result.items[0].permissions).toBeArray();
      expect(result.items[0].permissions).toContain('Space.View');
      expect(result.items[0].permissions).toContain('Space.Update');
    });

    it('should allow System Admin to view members of any space without being a member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Members' });
      const result = await getMembersService(4, space.id, { page: 1, limit: 10 }, 3);

      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Sayadaw U Thila');
      expect(result.items[0].permissions).toBeArray();
    });

    it('should exclude soft-deleted users from member list', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Active Members' });
      // Add a member whose user is soft deleted
      mockUsers.push({
        id: 99,
        phone: '09999999998',
        name: 'Deleted Monk',
        roleId: 1,
        isDeleted: true,
      });
      mockMembers.push({
        id: 99,
        userId: 99,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      const result = await getMembersService(1, space.id, { page: 1, limit: 10 });
      expect(result.items.some((m) => m.userId === 99)).toBe(false);
      expect(result.total).toBe(1);
    });

    it('should update member role (except owner)', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Roles' });
      mockMembers.push({
        id: 2,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      const updated = await updateMemberRoleService(1, space.id, 2, {
        roleId: SPACE_ROLES.SPACE_MODERATOR,
      });
      expect(updated.spaceRoleId).toBe(SPACE_ROLES.SPACE_MODERATOR);
      expect(updated.spaceRoleName).toBe('Space Moderator');
      expect(updated.permissions).toBeArray();
      expect(updated.permissions).toContain('Space.View');
    });

    it('should prevent modifying owner role', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Roles' });
      expect(
        updateMemberRoleService(1, space.id, 1, { roleId: SPACE_ROLES.SPACE_MODERATOR })
      ).rejects.toThrow('Owner member role cannot be changed.');
    });

    it('should remove a member from the monastery', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Remove' });
      mockMembers.push({
        id: 2,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      const removed = await removeMemberService(1, space.id, 2);
      expect(removed.userId).toBe(2);
      expect(mockMembers.some((m) => m.userId === 2)).toBe(false);
    });

    it('should prevent removing the owner', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Remove' });
      expect(removeMemberService(1, space.id, 1)).rejects.toThrow(
        'Owner member cannot be removed.'
      );
    });

    it('should allow System Admin to update member role without being a space member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Admin Manage' });
      mockMembers.push({
        id: 2,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      // User 4 is Admin (roleId 3) and NOT in mockMembers for this space
      const updated = await updateMemberRoleService(
        4,
        space.id,
        2,
        { roleId: SPACE_ROLES.SPACE_MODERATOR },
        3
      );
      expect(updated.spaceRoleId).toBe(SPACE_ROLES.SPACE_MODERATOR);
      expect(updated.spaceRoleName).toBe('Space Moderator');
    });

    it('should allow System Admin to remove a member without being a space member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Admin Remove' });
      mockMembers.push({
        id: 2,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      // User 4 is Admin (roleId 3)
      const removed = await removeMemberService(4, space.id, 2, 3);
      expect(removed.userId).toBe(2);
      expect(mockMembers.some((m) => m.userId === 2)).toBe(false);
    });

    it('should allow System Admin to invite a member without being a space member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Admin Invite' });
      const invitation = await inviteMemberService(
        4,
        space.id,
        { userId: 2, roleId: SPACE_ROLES.SPACE_MEMBER },
        3
      );
      expect(invitation.invitedUserId).toBe(2);
      expect(invitation.spaceRoleName).toBe('Space Member');
    });

    it('should allow owner to promote member to Space Admin and ensure Space.Delete is not granted', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Roles Promo' });
      mockMembers.push({
        id: 60,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      const updated = await updateMemberRoleService(1, space.id, 2, {
        roleId: SPACE_ROLES.SPACE_ADMIN,
      });

      expect(updated.spaceRoleId).toBe(SPACE_ROLES.SPACE_ADMIN);
      expect(updated.isOwner).toBe(false);
      expect(updated.permissions).toContain('Space.View');
      expect(updated.permissions).not.toContain('Space.Delete');
    });

    it('should reject non-owner promoting member to Space Admin', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Roles PrivEsc' });
      // User 2 is Moderator
      mockMembers.push({
        id: 61,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MODERATOR,
        isOwner: false,
      });
      // User 3 is Member
      mockMembers.push({
        id: 62,
        userId: 3,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MEMBER,
        isOwner: false,
      });

      await expect(
        updateMemberRoleService(2, space.id, 3, {
          roleId: SPACE_ROLES.SPACE_ADMIN,
        })
      ).rejects.toThrow(
        'Only the monastery space owner or system admin can assign the Space Admin role.'
      );
    });

    it('should reject non-owner removing or modifying a Space Admin', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Monastery Roles Protect' });
      // User 2 is Moderator
      mockMembers.push({
        id: 63,
        userId: 2,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_MODERATOR,
        isOwner: false,
      });
      // User 3 is an invited Space Admin
      mockMembers.push({
        id: 64,
        userId: 3,
        monasterySpaceId: space.id,
        spaceRoleId: SPACE_ROLES.SPACE_ADMIN,
        isOwner: false,
      });

      // User 2 tries to demote user 3
      await expect(
        updateMemberRoleService(2, space.id, 3, {
          roleId: SPACE_ROLES.SPACE_MEMBER,
        })
      ).rejects.toThrow(
        'Only the monastery space owner or system admin can change a Space Admin role.'
      );

      // User 2 tries to remove user 3
      await expect(removeMemberService(2, space.id, 3)).rejects.toThrow(
        'Only the monastery space owner or system admin can remove a Space Admin.'
      );
    });

    it('should retrieve all space roles via getSpaceRolesService', async () => {
      const roles = await getSpaceRolesService();
      expect(roles.length).toBe(4);
      expect(roles.map((r) => r.roleName)).toEqual([
        'Space Admin',
        'Space Moderator',
        'Space Editor',
        'Space Member',
      ]);
      const editorRole = roles.find((r) => r.roleName === 'Space Editor');
      expect(editorRole).toBeDefined();
      expect(editorRole?.permissions.some((p) => p.permissionName === 'Space.View')).toBe(true);
      expect(editorRole?.permissions.some((p) => p.permissionName === 'Space.Post.Create')).toBe(
        true
      );
      expect(editorRole?.permissions[0].module).toBe('Space');
      expect(editorRole?.permissions[0].action).toBe('View');
      expect(editorRole?.permissions[0].displayName).toBe('View Space');
      expect(editorRole?.permissions[0].category).toBe('Monastery & Space');
    });

    it('should retrieve a space role by ID via getSpaceRoleByIdService', async () => {
      const role = await getSpaceRoleByIdService(2);
      expect(role.roleId).toBe(2);
      expect(role.roleName).toBe('Space Moderator');
      expect(role.permissions.some((p) => p.permissionName === 'Space.View')).toBe(true);
      expect(role.permissions[0].module).toBe('Space');
    });

    it('should throw 404 if space role not found', async () => {
      expect(getSpaceRoleByIdService(999)).rejects.toThrow('Space role not found.');
    });
  });

  describe('Public Catalog, Feeds, Search & Permissions', () => {
    it('should retrieve public monasteries catalog with creator and members count', async () => {
      await createMonasteryService(1, {
        monasteryName: 'Kyauk Gu Monastery',
        description: 'Historical cave monastery',
        address: 'Bagan, Mandalay Region',
      });
      await createMonasteryService(1, {
        monasteryName: 'Mahagandhayon Monastery',
        description: 'Monastic study center',
        address: 'Amarapura, Mandalay',
      });

      const result = await getPublicMonasteriesCatalogService({ pageNumber: 1, pageSize: 10 });
      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.items[0].monasteryName).toBe('Kyauk Gu Monastery');
      expect(result.items[0].createdByName).toBe('Sayadaw U Thila');
      expect(result.items[0].membersCount).toBe(1);
      expect(result.pageNumber).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.hasPreviousPage).toBe(false);
      expect(result.hasNextPage).toBe(false);
    });

    it('should retrieve public monasteries feed with cursor pagination', async () => {
      await createMonasteryService(1, { monasteryName: 'Monastery 1' });
      await createMonasteryService(1, { monasteryName: 'Monastery 2' });
      await createMonasteryService(1, { monasteryName: 'Monastery 3' });

      // Request batch of 2
      const batch1 = await getPublicMonasteriesFeedService({ pageSize: 2 });
      expect(batch1.items.length).toBe(2);
      expect(batch1.hasNextPage).toBe(true);
      expect(batch1.nextCursor).toBe(batch1.items[1].id);

      // Request next batch
      const batch2 = await getPublicMonasteriesFeedService({
        lastId: batch1.nextCursor ?? undefined,
        pageSize: 2,
      });
      expect(batch2.items.length).toBe(1);
      expect(batch2.hasNextPage).toBe(false);
      expect(batch2.nextCursor).toBe(null);
    });

    it('should search public monasteries by keyword', async () => {
      await createMonasteryService(1, {
        monasteryName: 'Kyauk Gu Monastery',
        address: 'Bagan, Mandalay Region',
      });
      await createMonasteryService(1, {
        monasteryName: 'Mahagandhayon Monastery',
        address: 'Amarapura, Mandalay',
      });

      const searchName = await searchPublicMonasteriesService({
        keyword: 'Kyauk',
        pageNumber: 1,
        pageSize: 10,
      });
      expect(searchName.items.length).toBe(1);
      expect(searchName.items[0].monasteryName).toBe('Kyauk Gu Monastery');

      const searchAddress = await searchPublicMonasteriesService({
        keyword: 'Amarapura',
        pageNumber: 1,
        pageSize: 10,
      });
      expect(searchAddress.items.length).toBe(1);
      expect(searchAddress.items[0].monasteryName).toBe('Mahagandhayon Monastery');
    });

    it('should search public monasteries feed with cursor pagination', async () => {
      await createMonasteryService(1, {
        monasteryName: 'Bagan Temple 1',
        address: 'Bagan',
      });
      await createMonasteryService(1, {
        monasteryName: 'Bagan Temple 2',
        address: 'Bagan',
      });
      await createMonasteryService(1, {
        monasteryName: 'Mandalay Temple',
        address: 'Mandalay',
      });

      const feed = await searchPublicMonasteriesFeedService({
        keyword: 'Bagan',
        pageSize: 1,
      });
      expect(feed.items.length).toBe(1);
      expect(feed.items[0].monasteryName).toBe('Bagan Temple 1');
      expect(feed.hasNextPage).toBe(true);
    });

    it('should retrieve my monasteries feed for member', async () => {
      const space1 = await createMonasteryService(1, { monasteryName: 'My Space 1' });
      const space2 = await createMonasteryService(1, { monasteryName: 'My Space 2' });

      const feed = await getMyMonasteriesFeedService(1, { pageSize: 1 });
      expect(feed.items.length).toBe(1);
      expect(feed.items[0].id).toBe(space1.id);
      expect(feed.hasNextPage).toBe(true);

      const feedPage2 = await getMyMonasteriesFeedService(1, {
        lastId: feed.nextCursor ?? undefined,
        pageSize: 1,
      });
      expect(feedPage2.items.length).toBe(1);
      expect(feedPage2.items[0].id).toBe(space2.id);
      expect(feedPage2.hasNextPage).toBe(false);
    });

    it('should retrieve current user space permissions for space owner', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Perm Space' });

      const perms = await getCurrentUserSpacePermissionsService(1, space.id);
      expect(perms.spaceId).toBe(space.id);
      expect(perms.userId).toBe(1);
      expect(perms.isOwner).toBe(true);
      expect(perms.spaceRoleId).toBe(SPACE_ROLES.SPACE_ADMIN);
      expect(perms.permissions.includes('Space.Delete')).toBe(true);
      expect(perms.permissions.includes('Space.View')).toBe(true);
    });

    it('should reject permissions lookup if user is not a space member', async () => {
      const space = await createMonasteryService(1, { monasteryName: 'Perm Space 2' });

      // User 2 is not a member and not system admin
      await expect(getCurrentUserSpacePermissionsService(2, space.id, 2)).rejects.toThrow(
        'User is not a member of this monastery.'
      );
    });
  });
});

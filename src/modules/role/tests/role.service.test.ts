import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  assignPermissionsService,
  createRoleService,
  deleteRoleService,
  getPermissionsService,
  getRoleByIdService,
  getRolesService,
  getUserPermissionsDetailService,
  getUserPermissionsService,
  updateRoleService,
} from '../role.service';

interface MockRole {
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
  permission?: MockPermission;
}

interface MockUser {
  id: number;
  name: string;
  roleId: number;
  isDeleted: boolean;
  role?: MockRole;
}

let mockRoles: MockRole[] = [];
let mockPermissions: MockPermission[] = [];
let mockRolePermissions: MockRolePermission[] = [];
let mockUsers: MockUser[] = [];

mock.module('@/middlewares/permissionMiddleware', () => ({
  clearRolePermissionsCache: mock(async () => {}),
  getRolePermissions: mock(async () => []),
  checkPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

mock.module('@/lib/prisma', () => ({
  prisma: {
    role: {
      findMany: mock(
        async ({
          where,
          skip = 0,
          take = 10,
        }: {
          where?: { isDeleted?: boolean; name?: { contains?: string } };
          skip?: number;
          take?: number;
        }) => {
          let list = mockRoles.filter((r) => !r.isDeleted);
          if (where?.name?.contains) {
            const query = where.name.contains.toLowerCase();
            list = list.filter((r) => r.name.toLowerCase().includes(query));
          }
          return list.slice(skip, skip + take).map((r) => ({
            ...r,
            rolePermissions: mockRolePermissions
              .filter((rp) => rp.roleId === r.id)
              .map((rp) => ({
                ...rp,
                permission: mockPermissions.find((p) => p.id === rp.permissionId),
              })),
          }));
        }
      ),
      count: mock(
        async ({ where }: { where?: { isDeleted?: boolean; name?: { contains?: string } } }) => {
          let list = mockRoles.filter((r) => !r.isDeleted);
          if (where?.name?.contains) {
            const query = where.name.contains.toLowerCase();
            list = list.filter((r) => r.name.toLowerCase().includes(query));
          }
          return list.length;
        }
      ),
      findFirst: mock(
        async ({
          where,
        }: {
          where: { id?: number; name?: string; isDeleted?: boolean; id_not?: number };
        }) => {
          const role = mockRoles.find((r) => {
            if (r.isDeleted) return false;
            if (where.id !== undefined && r.id !== where.id) return false;
            if (where.name !== undefined && r.name.toLowerCase() !== where.name.toLowerCase())
              return false;
            return true;
          });
          if (!role) return null;
          return {
            ...role,
            rolePermissions: mockRolePermissions
              .filter((rp) => rp.roleId === role.id)
              .map((rp) => ({
                ...rp,
                permission: mockPermissions.find((p) => p.id === rp.permissionId),
              })),
          };
        }
      ),
      create: mock(async ({ data }: { data: { name: string; isDeleted?: boolean } }) => {
        const newRole: MockRole = {
          id: mockRoles.length + 1,
          name: data.name,
          isDeleted: data.isDeleted ?? false,
        };
        mockRoles.push(newRole);
        return newRole;
      }),
      update: mock(async ({ where, data }: { where: { id: number }; data: Partial<MockRole> }) => {
        const role = mockRoles.find((r) => r.id === where.id);
        if (!role) throw new Error('Role not found');
        Object.assign(role, data);
        return role;
      }),
      findUniqueOrThrow: mock(async ({ where }: { where: { id: number } }) => {
        const role = mockRoles.find((r) => r.id === where.id);
        if (!role) throw new Error('Role not found');
        return {
          ...role,
          rolePermissions: mockRolePermissions
            .filter((rp) => rp.roleId === role.id)
            .map((rp) => ({
              ...rp,
              permission: mockPermissions.find((p) => p.id === rp.permissionId),
            })),
        };
      }),
    },
    permission: {
      findMany: mock(
        async ({
          where,
          skip = 0,
          take = 100,
        }: {
          where?: { isDeleted?: boolean; name?: { contains?: string; startsWith?: string } };
          skip?: number;
          take?: number;
        }) => {
          let list = mockPermissions.filter((p) => !p.isDeleted);
          if (where?.name?.contains) {
            const query = where.name.contains.toLowerCase();
            list = list.filter((p) => p.name.toLowerCase().includes(query));
          }
          if (where?.name?.startsWith) {
            const prefix = where.name.startsWith.toLowerCase();
            list = list.filter((p) => p.name.toLowerCase().startsWith(prefix));
          }
          return list.slice(skip, skip + take);
        }
      ),
      count: mock(
        async ({
          where,
        }: {
          where?: {
            isDeleted?: boolean;
            id?: { in?: number[] };
            name?: { contains?: string; startsWith?: string };
          };
        }) => {
          let list = mockPermissions.filter((p) => !p.isDeleted);
          if (where?.id?.in) {
            list = list.filter((p) => where.id?.in?.includes(p.id));
          }
          if (where?.name?.contains) {
            const query = where.name.contains.toLowerCase();
            list = list.filter((p) => p.name.toLowerCase().includes(query));
          }
          if (where?.name?.startsWith) {
            const prefix = where.name.startsWith.toLowerCase();
            list = list.filter((p) => p.name.toLowerCase().startsWith(prefix));
          }
          return list.length;
        }
      ),
    },
    rolePermission: {
      findMany: mock(
        async ({ where }: { where: { roleId?: number; permission?: { isDeleted?: boolean } } }) => {
          return mockRolePermissions
            .filter((rp) => !where.roleId || rp.roleId === where.roleId)
            .map((rp) => ({
              ...rp,
              permission: mockPermissions.find((p) => p.id === rp.permissionId),
            }));
        }
      ),
      deleteMany: mock(async ({ where }: { where: { roleId: number } }) => {
        const initial = mockRolePermissions.length;
        mockRolePermissions = mockRolePermissions.filter((rp) => rp.roleId !== where.roleId);
        return { count: initial - mockRolePermissions.length };
      }),
      createMany: mock(async ({ data }: { data: { roleId: number; permissionId: number }[] }) => {
        for (const item of data) {
          mockRolePermissions.push({
            id: mockRolePermissions.length + 1,
            roleId: item.roleId,
            permissionId: item.permissionId,
          });
        }
        return { count: data.length };
      }),
    },
    user: {
      count: mock(async ({ where }: { where: { roleId: number; isDeleted: boolean } }) => {
        return mockUsers.filter((u) => u.roleId === where.roleId && !u.isDeleted).length;
      }),
      findFirst: mock(
        async ({ where }: { where: { id?: number; roleId?: number; isDeleted?: boolean } }) => {
          const user = mockUsers.find(
            (u) =>
              (!where.id || u.id === where.id) &&
              (!where.roleId || u.roleId === where.roleId) &&
              (!where.isDeleted || !u.isDeleted)
          );
          if (!user) return null;
          return {
            ...user,
            role: mockRoles.find((r) => r.id === user.roleId),
          };
        }
      ),
    },
    monasteryMember: {
      findFirst: mock(async () => null),
    },
    invitation: {
      findFirst: mock(async () => null),
    },
    $transaction: mock(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { prisma } = await import('@/lib/prisma');
      return await callback(prisma);
    }),
  },
}));

describe('Role & Dynamic RBAC Service Unit Tests', () => {
  beforeEach(() => {
    mockRoles = [
      { id: 1, name: 'Monk', isDeleted: false },
      { id: 2, name: 'Donor', isDeleted: false },
      { id: 3, name: 'Admin', isDeleted: false },
      { id: 4, name: 'Space Admin', isDeleted: false },
      { id: 5, name: 'Space Moderator', isDeleted: false },
      { id: 6, name: 'Space Editor', isDeleted: false },
      { id: 7, name: 'Space Member', isDeleted: false },
    ];

    mockPermissions = [
      { id: 1, name: 'Role.View', isDeleted: false },
      { id: 2, name: 'Role.Create', isDeleted: false },
      { id: 3, name: 'Role.Update', isDeleted: false },
      { id: 4, name: 'Role.Delete', isDeleted: false },
      { id: 5, name: 'User.View', isDeleted: false },
      { id: 6, name: 'Space.View', isDeleted: false },
      { id: 7, name: 'Space.Donation.Create', isDeleted: false },
    ];

    mockRolePermissions = [
      // Admin gets all
      { id: 1, roleId: 3, permissionId: 1 },
      { id: 2, roleId: 3, permissionId: 2 },
      { id: 3, roleId: 3, permissionId: 3 },
      { id: 4, roleId: 3, permissionId: 4 },
      { id: 5, roleId: 3, permissionId: 5 },
      // Space Member gets Space.View
      { id: 6, roleId: 7, permissionId: 6 },
    ];

    mockUsers = [
      { id: 1, name: 'Admin User', roleId: 3, isDeleted: false },
      { id: 2, name: 'Monk User', roleId: 1, isDeleted: false },
    ];
  });

  describe('getRolesService & getRoleByIdService', () => {
    it('should retrieve a paginated list of active roles with formatted permissions', async () => {
      const result = await getRolesService({ pageNumber: 1, pageSize: 5 });
      expect(result.items.length).toBe(5);
      expect(result.total).toBe(7);
      expect(result.page).toBe(1);

      const adminRole = result.items.find((r) => r.roleId === 3);
      expect(adminRole).toBeDefined();
      expect(adminRole?.permissions.length).toBe(5);
      expect(adminRole?.permissions[0].module).toBe('Role');
      expect(adminRole?.permissions[0].action).toBe('View');
      expect(adminRole?.permissions[0].category).toBe('Role & Access Control');
    });

    it('should filter roles by roleName', async () => {
      const result = await getRolesService({ pageNumber: 1, pageSize: 10, roleName: 'Space' });
      expect(result.items.length).toBe(4);
      expect(result.items.every((r) => r.roleName.includes('Space'))).toBe(true);
    });

    it('should retrieve role by ID with permissions', async () => {
      const role = await getRoleByIdService(7);
      expect(role.roleId).toBe(7);
      expect(role.roleName).toBe('Space Member');
      expect(role.permissions.some((p) => p.permissionName === 'Space.View')).toBe(true);
    });

    it('should throw 404 if role does not exist', async () => {
      expect(getRoleByIdService(999)).rejects.toThrow('Role not found');
    });
  });

  describe('createRoleService', () => {
    it('should successfully create a custom role with permissions', async () => {
      const created = await createRoleService({
        roleName: 'Custom Auditor',
        permissionIds: [1, 5],
      });

      expect(created.roleName).toBe('Custom Auditor');
      expect(created.permissions.length).toBe(2);
      expect(mockRoles.some((r) => r.name === 'Custom Auditor')).toBe(true);
    });

    it('should reject creating a role with reserved system name', async () => {
      expect(
        createRoleService({
          roleName: 'Admin',
        })
      ).rejects.toThrow("The role name 'Admin' is reserved by the system");
    });

    it('should reject creating a role with duplicate name', async () => {
      expect(
        createRoleService({
          roleName: 'Space Member',
        })
      ).rejects.toThrow('Role name already exists');
    });

    it('should reject invalid or inactive permission IDs', async () => {
      expect(
        createRoleService({
          roleName: 'New Role',
          permissionIds: [9999],
        })
      ).rejects.toThrow('One or more permissions are invalid or inactive');
    });
  });

  describe('updateRoleService', () => {
    it('should update role name and permissions', async () => {
      const updated = await updateRoleService(7, {
        roleName: 'Space Community Member',
        permissionIds: [6, 7],
      });

      expect(updated.roleName).toBe('Space Community Member');
      expect(updated.permissions.length).toBe(2);
      expect(updated.permissions.some((p) => p.permissionName === 'Space.Donation.Create')).toBe(
        true
      );
    });

    it('should reject renaming the system Admin role', async () => {
      expect(
        updateRoleService(3, {
          roleName: 'Super Admin',
        })
      ).rejects.toThrow('The system Admin role cannot be renamed or have permissions removed.');
    });

    it('should reject stripping all permissions from system Admin', async () => {
      expect(
        updateRoleService(3, {
          permissionIds: [],
        })
      ).rejects.toThrow('The system Admin role cannot be renamed or have permissions removed.');
    });
  });

  describe('deleteRoleService', () => {
    it('should soft delete a custom role with no assigned users', async () => {
      // Create custom role with no users
      const custom = await createRoleService({ roleName: 'Temporary Role' });
      const result = await deleteRoleService(custom.roleId);
      expect(result.message).toBe('Role deleted successfully');
      expect(mockRoles.find((r) => r.id === custom.roleId)?.isDeleted).toBe(true);
    });

    it('should reject deleting system Admin role', async () => {
      expect(deleteRoleService(3)).rejects.toThrow('The system Admin role cannot be deleted.');
    });

    it('should reject deleting a role if active users, members or invitations are assigned to it', async () => {
      mockUsers.push({ id: 99, name: 'Test Member', roleId: 5, isDeleted: false });
      expect(deleteRoleService(5)).rejects.toThrow(
        'Role is assigned to users, members or pending invitations.'
      );
    });
  });

  describe('getPermissionsService', () => {
    it('should return paginated permissions list with category metadata', async () => {
      const result = await getPermissionsService({ pageNumber: 1, pageSize: 10 });
      expect(result.items.length).toBe(7);
      expect(result.total).toBe(7);

      const perm = result.items[0];
      expect(perm.displayName).toBeDefined();
      expect(perm.category).toBeDefined();
    });

    it('should filter permissions by search term', async () => {
      const result = await getPermissionsService({ pageNumber: 1, pageSize: 10, search: 'Space' });
      expect(result.items.length).toBe(2);
      expect(result.items.every((p) => p.permissionName.includes('Space'))).toBe(true);
    });
  });

  describe('assignPermissionsService', () => {
    it('should dynamically reassign permissions to a role and invalidate cache', async () => {
      const result = await assignPermissionsService({
        roleId: 4,
        permissionIds: [1, 2, 6],
      });

      expect(result.message).toBe('Permissions assigned successfully');
      expect(result.count).toBe(3);

      const role = await getRoleByIdService(4);
      expect(role.permissions.length).toBe(3);
    });

    it('should reject invalid permissions during assignment', async () => {
      expect(
        assignPermissionsService({
          roleId: 4,
          permissionIds: [99999],
        })
      ).rejects.toThrow('One or more permissions are invalid or inactive');
    });
  });

  describe('getUserPermissionsService', () => {
    it('should retrieve distinct active permissions for a user via their role', async () => {
      const permissions = await getUserPermissionsService(1); // Admin user
      expect(permissions.length).toBe(5);
      expect(permissions).toContain('Role.View');
      expect(permissions).toContain('Role.Create');
      expect(permissions).toContain('User.View');
    });

    it('should return empty list for user without role or if user is deleted', async () => {
      const permissions = await getUserPermissionsService(999);
      expect(permissions).toEqual([]);
    });
  });

  describe('getUserPermissionsDetailService', () => {
    it('should retrieve full user permission details with userId, roleId, roleName, and permissions', async () => {
      const details = await getUserPermissionsDetailService(1);
      expect(details.userId).toBe(1);
      expect(details.roleId).toBe(3);
      expect(details.roleName).toBe('Admin');
      expect(details.permissions.length).toBe(5);
      expect(details.permissions).toContain('Role.View');
    });

    it('should return empty permissions and null role for non-existent user', async () => {
      const details = await getUserPermissionsDetailService(999);
      expect(details.userId).toBe(999);
      expect(details.roleId).toBeNull();
      expect(details.roleName).toBeNull();
      expect(details.permissions).toEqual([]);
    });
  });
});

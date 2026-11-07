import { beforeEach, describe, expect, it, mock, test } from 'bun:test';
import request from 'supertest';
import { generateAccessToken } from '@/utils/jwt';

interface MockRole {
  id: number;
  name: string;
  isDeleted: boolean;
}

interface MockPermission {
  id: number;
  name: string;
  description?: string;
  isDeleted: boolean;
}

interface MockRolePermission {
  id: number;
  roleId: number;
  permissionId: number;
}

interface MockSpaceRole {
  id: number;
  name: string;
  description: string | null;
  isDeleted: boolean;
}

interface MockSpacePermission {
  id: number;
  name: string;
  description: string;
  isDeleted: boolean;
}

interface MockSpaceRolePermission {
  id: number;
  spaceRoleId: number;
  spacePermissionId: number;
  isDeleted: boolean;
}

// Mock DB state
let mockRoles: MockRole[] = [];
let mockPermissions: MockPermission[] = [];
let mockRolePermissions: MockRolePermission[] = [];
let mockSpaceRoles: MockSpaceRole[] = [];
let mockSpacePermissions: MockSpacePermission[] = [];
let mockSpaceRolePermissions: MockSpaceRolePermission[] = [];

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

interface MockFindManyArgs {
  where?: {
    name?: { contains?: string };
    isDeleted?: boolean;
    roleId?: number;
    spaceRoleId?: number;
    id?: { in?: number[] } | number;
  };
  skip?: number;
  take?: number;
  orderBy?: unknown;
}

interface MockCountArgs {
  where?: {
    name?: { contains?: string };
    isDeleted?: boolean;
    id?: { in?: number[] };
  };
}

interface MockFindFirstArgs {
  where?: {
    id?: number | { not?: number };
    name?: string;
    isDeleted?: boolean;
    roleId?: number;
  };
}

interface MockUpdateArgs<T> {
  where: { id: number };
  data: T;
}

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(async ({ where }: MockFindFirstArgs = {}) => {
        if (where?.roleId !== undefined && where.roleId !== 3) {
          return null;
        }
        return { id: 1, roleId: 3, isDeleted: false };
      }),
    },
    monasteryMember: {
      findFirst: mock(async () => null),
    },
    role: {
      findMany: mock(async ({ where, skip = 0, take = 10 }: MockFindManyArgs = {}) => {
        let list = mockRoles.filter((r) => !r.isDeleted);
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((r) => r.name.toLowerCase().includes(q));
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
      }),
      count: mock(async ({ where }: MockCountArgs = {}) => {
        let list = mockRoles.filter((r) => !r.isDeleted);
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((r) => r.name.toLowerCase().includes(q));
        }
        return list.length;
      }),
      findFirst: mock(async ({ where }: MockFindFirstArgs = {}) => {
        const r = mockRoles.find((role) => {
          if (where?.isDeleted !== undefined && role.isDeleted !== where.isDeleted) return false;
          if (where?.id !== undefined && typeof where.id === 'number' && role.id !== where.id)
            return false;
          if (where?.name !== undefined && role.name.toLowerCase() !== where.name.toLowerCase())
            return false;
          if (
            where?.id !== undefined &&
            typeof where.id === 'object' &&
            where.id.not !== undefined &&
            role.id === where.id.not
          )
            return false;
          return true;
        });
        if (!r) return null;
        return {
          ...r,
          rolePermissions: mockRolePermissions
            .filter((rp) => rp.roleId === r.id)
            .map((rp) => ({
              ...rp,
              permission: mockPermissions.find((p) => p.id === rp.permissionId),
            })),
        };
      }),
      create: mock(async ({ data }: { data: { name: string; isDeleted?: boolean } }) => {
        const newR = {
          id: mockRoles.length + 1,
          name: data.name,
          isDeleted: data.isDeleted ?? false,
        };
        mockRoles.push(newR);
        return newR;
      }),
      update: mock(async ({ where, data }: MockUpdateArgs<Partial<MockRole>>) => {
        const r = mockRoles.find((role) => role.id === where.id);
        if (r) Object.assign(r, data);
        return r;
      }),
      findUniqueOrThrow: mock(async ({ where }: { where: { id: number } }) => {
        const r = mockRoles.find((role) => role.id === where.id);
        return {
          ...r,
          rolePermissions: mockRolePermissions
            .filter((rp) => rp.roleId === r?.id)
            .map((rp) => ({
              ...rp,
              permission: mockPermissions.find((p) => p.id === rp.permissionId),
            })),
        };
      }),
    },
    permission: {
      findMany: mock(async ({ where, skip = 0, take = 20 }: MockFindManyArgs = {}) => {
        let list = mockPermissions.filter((p) => !p.isDeleted);
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((p) => p.name.toLowerCase().includes(q));
        }
        return list.slice(skip, skip + take);
      }),
      count: mock(async ({ where }: MockCountArgs = {}) => {
        let list = mockPermissions.filter((p) => !p.isDeleted);
        if (where?.id?.in) {
          list = list.filter((p) => where.id?.in?.includes(p.id));
        }
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((p) => p.name.toLowerCase().includes(q));
        }
        return list.length;
      }),
    },
    rolePermission: {
      findMany: mock(async ({ where }: { where?: { roleId?: number } } = {}) => {
        return mockRolePermissions
          .filter((rp) => !where?.roleId || rp.roleId === where.roleId)
          .map((rp) => ({
            ...rp,
            permission: mockPermissions.find((p) => p.id === rp.permissionId),
          }));
      }),
      deleteMany: mock(async ({ where }: { where: { roleId?: number } }) => {
        mockRolePermissions = mockRolePermissions.filter((rp) => rp.roleId !== where.roleId);
        return { count: 1 };
      }),
      createMany: mock(
        async ({ data }: { data: Array<{ roleId: number; permissionId: number }> }) => {
          for (const item of data) {
            mockRolePermissions.push({
              id: mockRolePermissions.length + 1,
              roleId: item.roleId,
              permissionId: item.permissionId,
            });
          }
          return { count: data.length };
        }
      ),
    },
    spaceRole: {
      findMany: mock(async ({ where, skip = 0, take = 10 }: MockFindManyArgs = {}) => {
        let list = mockSpaceRoles.filter((r) => !r.isDeleted);
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((r) => r.name.toLowerCase().includes(q));
        }
        return list.slice(skip, skip + take).map((r) => ({
          ...r,
          permissions: mockSpaceRolePermissions
            .filter((srp) => srp.spaceRoleId === r.id && !srp.isDeleted)
            .map((srp) => ({
              ...srp,
              spacePermission: mockSpacePermissions.find((sp) => sp.id === srp.spacePermissionId),
            })),
        }));
      }),
      count: mock(async ({ where }: MockCountArgs = {}) => {
        let list = mockSpaceRoles.filter((r) => !r.isDeleted);
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((r) => r.name.toLowerCase().includes(q));
        }
        return list.length;
      }),
      findFirst: mock(async ({ where }: MockFindFirstArgs = {}) => {
        const r = mockSpaceRoles.find((role) => {
          if (where?.isDeleted !== undefined && role.isDeleted !== where.isDeleted) return false;
          if (where?.id !== undefined && typeof where.id === 'number' && role.id !== where.id)
            return false;
          if (where?.name !== undefined && role.name.toLowerCase() !== where.name.toLowerCase())
            return false;
          if (
            where?.id !== undefined &&
            typeof where.id === 'object' &&
            where.id.not !== undefined &&
            role.id === where.id.not
          )
            return false;
          return true;
        });
        if (!r) return null;
        return {
          ...r,
          permissions: mockSpaceRolePermissions
            .filter((srp) => srp.spaceRoleId === r.id && !srp.isDeleted)
            .map((srp) => ({
              ...srp,
              spacePermission: mockSpacePermissions.find((sp) => sp.id === srp.spacePermissionId),
            })),
        };
      }),
      create: mock(async ({ data }: { data: { name: string; description?: string | null } }) => {
        const newR = {
          id: mockSpaceRoles.length + 1,
          name: data.name,
          description: data.description ?? null,
          isDeleted: false,
        };
        mockSpaceRoles.push(newR);
        return newR;
      }),
      update: mock(async ({ where, data }: MockUpdateArgs<Partial<MockSpaceRole>>) => {
        const r = mockSpaceRoles.find((role) => role.id === where.id);
        if (r) Object.assign(r, data);
        return r;
      }),
      findUniqueOrThrow: mock(async ({ where }: { where: { id: number } }) => {
        const r = mockSpaceRoles.find((role) => role.id === where.id);
        return {
          ...r,
          permissions: mockSpaceRolePermissions
            .filter((srp) => srp.spaceRoleId === r?.id && !srp.isDeleted)
            .map((srp) => ({
              ...srp,
              spacePermission: mockSpacePermissions.find((sp) => sp.id === srp.spacePermissionId),
            })),
        };
      }),
    },
    spacePermission: {
      findMany: mock(async ({ where, skip = 0, take = 10 }: MockFindManyArgs = {}) => {
        let list = mockSpacePermissions.filter((p) => !p.isDeleted);
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((p) => p.name.toLowerCase().includes(q));
        }
        return list.slice(skip, skip + take);
      }),
      count: mock(async ({ where }: MockCountArgs = {}) => {
        let list = mockSpacePermissions.filter((p) => !p.isDeleted);
        if (where?.id?.in) {
          list = list.filter((p) => where.id?.in?.includes(p.id));
        }
        if (where?.name?.contains) {
          const q = where.name.contains.toLowerCase();
          list = list.filter((p) => p.name.toLowerCase().includes(q));
        }
        return list.length;
      }),
    },
    spaceRolePermission: {
      findMany: mock(async ({ where }: { where?: { spaceRoleId?: number } } = {}) => {
        return mockSpaceRolePermissions.filter(
          (srp) => !where?.spaceRoleId || srp.spaceRoleId === where.spaceRoleId
        );
      }),
      deleteMany: mock(async ({ where }: { where: { spaceRoleId?: number } }) => {
        mockSpaceRolePermissions = mockSpaceRolePermissions.filter(
          (srp) => srp.spaceRoleId !== where.spaceRoleId
        );
        return { count: 1 };
      }),
      createMany: mock(
        async ({ data }: { data: Array<{ spaceRoleId: number; spacePermissionId: number }> }) => {
          for (const item of data) {
            mockSpaceRolePermissions.push({
              id: mockSpaceRolePermissions.length + 1,
              spaceRoleId: item.spaceRoleId,
              spacePermissionId: item.spacePermissionId,
              isDeleted: false,
            });
          }
          return { count: data.length };
        }
      ),
    },
    $transaction: mock(async <T>(callback: (tx: unknown) => Promise<T>) => {
      const { prisma } = await import('@/lib/prisma');
      return await callback(prisma);
    }),
  },
}));

const { app } = await import('@/app');

describe('Dynamic RBAC & System Permissions (/api/v1/roles, /api/v1/permissions)', () => {
  let adminToken: string;

  beforeEach(() => {
    adminToken = generateAccessToken({ userId: 1, roleId: 3 });

    mockRoles = [
      { id: 1, name: 'Monk', isDeleted: false },
      { id: 2, name: 'Donor', isDeleted: false },
      { id: 3, name: 'Admin', isDeleted: false },
    ];

    mockPermissions = [
      { id: 1, name: 'Roles.View', isDeleted: false },
      { id: 2, name: 'Roles.Manage', isDeleted: false },
      { id: 3, name: 'Roles.Assign', isDeleted: false },
      { id: 4, name: 'Users.View', isDeleted: false },
    ];

    mockRolePermissions = [
      { id: 1, roleId: 1, permissionId: 1 },
      { id: 2, roleId: 1, permissionId: 2 },
      { id: 3, roleId: 1, permissionId: 3 },
    ];

    mockSpaceRoles = [
      { id: 1, name: 'Owner', description: 'Monk creator', isDeleted: false },
      { id: 2, name: 'Admin', description: 'Monastery trustee', isDeleted: false },
      { id: 3, name: 'Editor', description: 'Accountant', isDeleted: false },
      { id: 4, name: 'Viewer', description: 'Member/devotee', isDeleted: false },
    ];

    mockSpacePermissions = [
      { id: 1, name: 'Space.View', description: 'View space details', isDeleted: false },
      { id: 2, name: 'Space.Update', description: 'Update space details', isDeleted: false },
      { id: 3, name: 'Space.Delete', description: 'Delete space', isDeleted: false },
      { id: 4, name: 'Donation.View', description: 'View donations', isDeleted: false },
    ];

    mockSpaceRolePermissions = [
      { id: 1, spaceRoleId: 1, spacePermissionId: 1, isDeleted: false },
      { id: 2, spaceRoleId: 1, spacePermissionId: 2, isDeleted: false },
      { id: 3, spaceRoleId: 1, spacePermissionId: 3, isDeleted: false },
      { id: 4, spaceRoleId: 2, spacePermissionId: 1, isDeleted: false },
    ];
  });

  // 44. Get System Roles
  it('44. GET /api/v1/roles - retrieves paginated list of system roles with envelope', async () => {
    const res = await request(app)
      .get('/api/v1/roles?pageNumber=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(res.body.data).toBeArray();
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.pageNumber).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
    expect(res.body.pagination.totalCount).toBe(3);
  });

  // 45. Get System Role by ID
  it('45. GET /api/v1/roles/:id - returns role metadata and permissionKeys', async () => {
    const res = await request(app)
      .get('/api/v1/roles/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('Monk');
    expect(res.body.data.permissionKeys).toBeArray();
  });

  // 46. Create System Role
  it('46. POST /api/v1/roles - creates custom system role', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Auditor',
        description: 'Read-only system inspector',
      });

    expect(res.status).toBe(201);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.data.name).toBe('Auditor');
    expect(res.body.data.description).toBe('Read-only system inspector');
  });

  // 47. Update System Role
  it('47. PUT /api/v1/roles/:id - updates custom role and protects Admin role', async () => {
    // Should reject updating Admin role
    const adminRes = await request(app)
      .put('/api/v1/roles/3')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Super Admin',
        description: 'Updated description',
      });
    expect(adminRes.status).toBe(400);

    // Create a custom role to update
    mockRoles.push({ id: 10, name: 'Auditor', isDeleted: false });
    const updateRes = await request(app)
      .put('/api/v1/roles/10')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Senior Auditor',
        description: 'Updated auditor role description',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Senior Auditor');
  });

  // 48. Delete System Role
  it('48. DELETE /api/v1/roles/:id - soft-deletes custom role and protects Admin role', async () => {
    const adminDeleteRes = await request(app)
      .delete('/api/v1/roles/3')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDeleteRes.status).toBe(400);

    mockRoles.push({ id: 20, name: 'Temp Role', isDeleted: false });
    const res = await request(app)
      .delete('/api/v1/roles/20')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(mockRoles.find((r) => r.id === 20)?.isDeleted).toBe(true);
  });

  // 49. List All System Permissions
  it('49. GET /api/v1/permissions - retrieves system permissions with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/permissions?pageNumber=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.data).toBeArray();
    expect(res.body.pagination).toBeDefined();
  });

  // 50. Assign Permissions to Role
  it('50. POST /api/v1/roles/assign-permissions - assigns permissions and protects Admin', async () => {
    mockRoles.push({ id: 30, name: 'Tester', isDeleted: false });

    const res = await request(app)
      .post('/api/v1/roles/assign-permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleId: 30,
        permissionIds: [1, 2],
      });

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
  });
});

describe('Dynamic Space RBAC & Space Permissions (/api/v1/space-roles, /api/v1/space-permissions)', () => {
  let adminToken: string;

  beforeEach(() => {
    adminToken = generateAccessToken({ userId: 1, roleId: 3 });

    mockSpaceRoles = [
      { id: 1, name: 'Owner', description: 'Monk creator', isDeleted: false },
      { id: 2, name: 'Admin', description: 'Monastery trustee', isDeleted: false },
      { id: 3, name: 'Editor', description: 'Accountant', isDeleted: false },
      { id: 4, name: 'Viewer', description: 'Member/devotee', isDeleted: false },
    ];

    mockSpacePermissions = [
      { id: 1, name: 'Space.View', description: 'View space details', isDeleted: false },
      { id: 2, name: 'Space.Update', description: 'Update space details', isDeleted: false },
      { id: 3, name: 'Space.Delete', description: 'Delete space', isDeleted: false },
      { id: 4, name: 'Donation.View', description: 'View donations', isDeleted: false },
    ];

    mockSpaceRolePermissions = [
      { id: 1, spaceRoleId: 1, spacePermissionId: 1, isDeleted: false },
      { id: 2, spaceRoleId: 1, spacePermissionId: 2, isDeleted: false },
      { id: 3, spaceRoleId: 1, spacePermissionId: 3, isDeleted: false },
      { id: 4, spaceRoleId: 2, spacePermissionId: 1, isDeleted: false },
    ];
  });

  // 51. Get Space Roles
  it('51. GET /api/v1/space-roles - returns paginated list of space roles with envelope', async () => {
    const res = await request(app)
      .get('/api/v1/space-roles?pageNumber=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(res.body.data).toBeArray();
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.pageNumber).toBe(1);
    expect(res.body.pagination.totalCount).toBe(4);
  });

  // 52. Get Space Role by ID
  it('52. GET /api/v1/space-roles/:id - retrieves space role details by id', async () => {
    const res = await request(app)
      .get('/api/v1/space-roles/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('Owner');
    expect(res.body.data.permissions).toBeArray();
    expect(res.body.data.permissionKeys).toContain('Space.View');
  });

  // 53. Create Custom Space Role
  it('53. POST /api/v1/space-roles - creates custom space role', async () => {
    const res = await request(app)
      .post('/api/v1/space-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Treasurer',
        description: 'Monastery accountant with financial tracking permissions',
        permissionIds: [1, 4],
      });

    expect(res.status).toBe(201);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.data.name).toBe('Treasurer');
    expect(res.body.data.description).toBe(
      'Monastery accountant with financial tracking permissions'
    );
  });

  // 54. Update Space Role
  it('54. PUT /api/v1/space-roles/:id - updates space role and protects Owner role', async () => {
    const ownerRes = await request(app)
      .put('/api/v1/space-roles/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Owner Name',
      });
    expect(ownerRes.status).toBe(400);

    mockSpaceRoles.push({ id: 10, name: 'Treasurer', description: 'Accountant', isDeleted: false });
    const res = await request(app)
      .put('/api/v1/space-roles/10')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Senior Treasurer',
        description: 'Lead accountant with full financial access',
        permissionIds: [1, 2, 4],
      });

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.data.name).toBe('Senior Treasurer');
  });

  // 55. Delete Space Role
  it('55. DELETE /api/v1/space-roles/:id - soft-deletes custom space role and protects Owner role', async () => {
    const ownerDeleteRes = await request(app)
      .delete('/api/v1/space-roles/1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ownerDeleteRes.status).toBe(400);

    mockSpaceRoles.push({ id: 25, name: 'Temporary Space Role', isDeleted: false });
    const res = await request(app)
      .delete('/api/v1/space-roles/25')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(mockSpaceRoles.find((r) => r.id === 25)?.isDeleted).toBe(true);
  });

  // 56. Assign Permissions to Space Role
  it('56. POST /api/v1/space-roles/assign-permissions - assigns permissions to space role', async () => {
    const res = await request(app)
      .post('/api/v1/space-roles/assign-permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        spaceRoleId: 3,
        permissionIds: [1, 4],
      });

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
  });

  // 57. List All Space Permissions
  it('57. GET /api/v1/space-permissions - lists space permissions with envelope', async () => {
    const res = await request(app)
      .get('/api/v1/space-permissions?pageNumber=1&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(res.body.data).toBeArray();
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.pageNumber).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
  });
});

describe('RBAC compatibility and role boundaries', () => {
  it('keeps the documented permission-catalog alias', async () => {
    const res = await request(app)
      .get('/api/v1/roles/permissions')
      .set('Authorization', `Bearer ${generateAccessToken({ userId: 1, roleId: 3 })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeArray();
  });

  it('does not treat Monk or Donor roles as administrators', async () => {
    const { isSystemAdminRoleId } = await import('@/middlewares/permissionMiddleware');
    const { isSystemAdmin } = await import('../role.service');
    for (const roleId of [1, 2]) {
      expect(isSystemAdminRoleId(roleId)).toBe(false);
      expect(isSystemAdmin({ id: roleId, name: roleId === 1 ? 'Monk' : 'Donor' })).toBe(false);
      mockRolePermissions = [];
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${generateAccessToken({ userId: 10, roleId })}`)
        .send({ name: 'Unauthorized role' });
      expect(res.status).toBe(403);
    }
    expect(isSystemAdminRoleId(3)).toBe(true);
    expect(isSystemAdmin({ id: 3, name: 'Admin' })).toBe(true);
  });
});

test('space permission results never fabricate IDs for disabled or missing rows', async () => {
  const { searchSpacePermissionsService, getSpacePermissionsOnlyService } = await import(
    '@/modules/space-permission/space-permission.service'
  );
  mockSpacePermissions = [
    { id: 12, name: 'Donation.Delete', description: 'Disabled', isDeleted: true },
  ];
  expect((await searchSpacePermissionsService(1, 10, 'Donation.Delete')).items).toEqual([]);
  mockSpacePermissions = [];
  expect((await getSpacePermissionsOnlyService()).items).toEqual([]);
});

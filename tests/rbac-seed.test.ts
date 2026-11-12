import { expect, mock, test } from 'bun:test';

type Row = { id: number; name: string; isDeleted: boolean; description?: string };
const roles: Row[] = [];
const spaceRoles: Row[] = [];
const permissions: Row[] = [
  { id: 1, name: 'Donation.View', isDeleted: false },
  { id: 2, name: 'Roles.Manage', isDeleted: true },
];
const spacePermissions: Row[] = [
  { id: 1, name: 'Space.Post.Create', isDeleted: false },
  { id: 2, name: 'Donation.Delete', isDeleted: true },
];
const roleGrants: Array<{ roleId: number; permissionId: number }> = [];
const spaceGrants: Array<{ spaceRoleId: number; spacePermissionId: number }> = [];

function table(rows: Row[]) {
  return {
    findFirst: mock(
      async ({ where }: { where: { name: string } }) =>
        rows.find((r) => r.name === where.name) ?? null
    ),
    create: mock(async ({ data }: { data: Omit<Row, 'id'> }) => {
      const row = { id: Math.max(0, ...rows.map((r) => r.id)) + 1, ...data };
      rows.push(row);
      return row;
    }),
    update: mock(async ({ where, data }: { where: { id: number }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.id === where.id);
      if (!row) throw new Error('Missing test row');
      if (data.name && rows.some((r) => r.id !== row.id && r.name === data.name)) {
        throw new Error(`Unique constraint failed on name: ${data.name}`);
      }
      Object.assign(row, data);
      return row;
    }),
    upsert: mock(
      async ({
        where,
        update,
        create,
      }: {
        where: { id?: number; name?: string };
        update: Partial<Row>;
        create: Omit<Row, 'id'> & { id?: number };
      }) => {
        const row = rows.find((r) =>
          where.id !== undefined ? r.id === where.id : r.name === where.name
        );
        if (row) {
          if (update.name && rows.some((r) => r.id !== row.id && r.name === update.name)) {
            throw new Error(`Unique constraint failed on name: ${update.name}`);
          }
          Object.assign(row, update);
          return row;
        }
        const added = { id: Math.max(0, ...rows.map((r) => r.id)) + 1, ...create };
        rows.push(added);
        return added;
      }
    ),
  };
}

mock.module('@/lib/prisma', () => ({
  prisma: {
    role: table(roles),
    spaceRole: table(spaceRoles),
    permission: table(permissions),
    spacePermission: table(spacePermissions),
    rolePermission: {
      findFirst: mock(
        async ({ where }: { where: { roleId: number; permissionId: number } }) =>
          roleGrants.find(
            (g) => g.roleId === where.roleId && g.permissionId === where.permissionId
          ) ?? null
      ),
      create: mock(async ({ data }: { data: (typeof roleGrants)[number] }) => {
        roleGrants.push(data);
        return data;
      }),
      deleteMany: mock(
        async ({ where }: { where: { roleId: number; permissionId?: { notIn: number[] } } }) => {
          const notIn = where.permissionId?.notIn ?? [];
          for (let i = roleGrants.length - 1; i >= 0; i--) {
            if (
              roleGrants[i].roleId === where.roleId &&
              !notIn.includes(roleGrants[i].permissionId)
            ) {
              roleGrants.splice(i, 1);
            }
          }
          return { count: 0 };
        }
      ),
    },
    spaceRolePermission: {
      findFirst: mock(async () => null),
      create: mock(async ({ data }: { data: (typeof spaceGrants)[number] }) => {
        spaceGrants.push(data);
        return data;
      }),
    },
  },
}));

const { ensureSystemPermissionsInDb } = await import(
  '../src/modules/permission/permission.service'
);
const { ensureSpacePermissionsInDb } = await import(
  '../src/modules/space-permission/space-permission.service'
);
const { seedRbac } = await import('../prisma/seed');

test('permission initialization preserves occupied IDs and disabled permissions', async () => {
  await ensureSystemPermissionsInDb();
  await ensureSpacePermissionsInDb();
  expect(permissions.find((r) => r.id === 1)?.name).toBe('Donation.View');
  expect(spacePermissions.find((r) => r.id === 1)?.name).toBe('Space.Post.Create');
  expect(permissions.find((r) => r.id === 2)?.isDeleted).toBe(true);
  expect(spacePermissions.find((r) => r.id === 2)?.isDeleted).toBe(true);
  expect(permissions.some((r) => r.name === 'Roles.Assign')).toBe(true);
  expect(spacePermissions.some((r) => r.name === 'Donation.Schedule')).toBe(true);
  const counts = [permissions.length, spacePermissions.length];
  await ensureSystemPermissionsInDb();
  await ensureSpacePermissionsInDb();
  expect([permissions.length, spacePermissions.length]).toEqual(counts);
});

test('RBAC seed preserves role IDs and grants the documented workflows', async () => {
  await seedRbac();
  expect(roles.map((r) => [r.id, r.name])).toEqual([
    [1, 'Admin'],
    [2, 'Monk'],
    [3, 'Donor'],
  ]);
  const systemNames = (id: number) =>
    roleGrants
      .filter((g) => g.roleId === id)
      .map((g) => permissions.find((p) => p.id === g.permissionId)?.name);
  expect(systemNames(1)).toContain('Role.Create');
  expect(systemNames(2)).not.toContain('Role.Create');
  expect(systemNames(3)).not.toContain('Role.Create');
  const spaceNames = (id: number) =>
    spaceGrants
      .filter((g) => g.spaceRoleId === id)
      .map((g) => spacePermissions.find((p) => p.id === g.spacePermissionId)?.name);
  for (const name of ['Donation.View', 'Donation.Create', 'Donation.Review', 'Donation.Schedule']) {
    expect(spaceNames(3)).toContain(name);
  }
  expect(spaceNames(3)).not.toContain('Space.Delete');
  expect(spaceNames(4)).toContain('Donation.View');
});

test('RBAC seed safely swaps legacy role names and prunes stale permissions', async () => {
  roles.length = 0;
  roles.push(
    { id: 1, name: 'Monk', isDeleted: false },
    { id: 2, name: 'Donor', isDeleted: false },
    { id: 3, name: 'Admin', isDeleted: false }
  );

  await seedRbac();

  const roleCreatePerm = permissions.find((p) => p.name === 'Role.Create');
  expect(roleCreatePerm).toBeDefined();
  if (roleCreatePerm) {
    // Simulate legacy Admin permission remaining on roleId 3 before re-seeding
    roleGrants.push({ roleId: 3, permissionId: roleCreatePerm.id });
  }

  // Reset roles back to legacy order and run seedRbac again
  roles.length = 0;
  roles.push(
    { id: 1, name: 'Monk', isDeleted: false },
    { id: 2, name: 'Donor', isDeleted: false },
    { id: 3, name: 'Admin', isDeleted: false }
  );

  await seedRbac();

  expect(roles.map((r) => [r.id, r.name])).toEqual([
    [1, 'Admin'],
    [2, 'Monk'],
    [3, 'Donor'],
  ]);

  const systemNames = (id: number) =>
    roleGrants
      .filter((g) => g.roleId === id)
      .map((g) => permissions.find((p) => p.id === g.permissionId)?.name);

  expect(systemNames(1)).toContain('Role.Create');
  expect(systemNames(2)).toContain('Monastery.Create');
  expect(systemNames(2)).toContain('Donation.Review');
  expect(systemNames(3)).not.toContain('Role.Create');
  expect(systemNames(3)).not.toContain('Monastery.Create');
});

import { prisma } from '../src/lib/prisma';
import { DONATION_PERMISSIONS } from '../src/modules/donation/donation.types';
import { logger } from '../src/utils/logger';

export const SYSTEM_ROLES = [
  { id: 1, name: 'Monk' },
  { id: 2, name: 'Donor' },
  { id: 3, name: 'Admin' },
];

export const SPACE_ROLES = [
  {
    id: 1,
    name: 'Space Admin',
    description: 'Full control and administration of the monastery space',
  },
  {
    id: 2,
    name: 'Space Moderator',
    description: 'Moderate space activities, members, and review donations',
  },
  {
    id: 3,
    name: 'Space Editor',
    description: 'Create posts and initiate donations in space',
  },
  {
    id: 4,
    name: 'Space Member',
    description: 'General monastery space member with view access',
  },
];

export const SYSTEM_PERMISSIONS = [
  ...DONATION_PERMISSIONS,
  // User Management
  'User.View',
  'User.Create',
  'User.Update',
  'User.Delete',

  // Role Management
  'Role.View',
  'Role.Create',
  'Role.Update',
  'Role.Delete',

  // Donor Management
  'Donor.View',
  'Donor.Create',
  'Donor.Update',
  'Donor.Delete',

  // Monastery Spaces (Global)
  'Monastery.View',
  'Monastery.Create',
  'Monastery.Update',
  'Monastery.Delete',
  'Monastery.ManageMembers',
];

export const SPACE_PERMISSIONS = [
  {
    name: 'Space.View',
    description: 'View space details, members, and general activities',
  },
  {
    name: 'Space.Update',
    description: 'Update monastery space profile and details',
  },
  {
    name: 'Space.Delete',
    description: 'Delete monastery space',
  },
  {
    name: 'Space.Member.Invite',
    description: 'Invite new members to the monastery space',
  },
  {
    name: 'Space.Member.Manage',
    description: 'Manage existing member statuses and roles',
  },
  {
    name: 'Space.Member.Remove',
    description: 'Remove members from the monastery space',
  },
  {
    name: 'Space.Role.Manage',
    description: 'Assign or change member roles within space',
  },
  {
    name: 'Space.Post.Create',
    description: 'Create updates and posts in space',
  },
  {
    name: 'Space.Donation.Create',
    description: 'Submit donation entries in space',
  },
  {
    name: 'Space.Donation.Review',
    description: 'Approve, reject, or mark donations completed',
  },
];

async function seedRbac() {
  logger.info('Seeding System Roles and Permissions...');

  // 1. Seed System Roles
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, isDeleted: false },
      create: { id: role.id, name: role.name, isDeleted: false },
    });
  }

  // 2. Seed System Permissions
  const sysPermMap = new Map<string, number>();
  for (const permName of SYSTEM_PERMISSIONS) {
    const existing = await prisma.permission.findFirst({
      where: { name: permName },
    });
    if (existing) {
      if (existing.isDeleted) {
        await prisma.permission.update({
          where: { id: existing.id },
          data: { isDeleted: false },
        });
      }
      sysPermMap.set(permName, existing.id);
    } else {
      const created = await prisma.permission.create({
        data: { name: permName, isDeleted: false },
      });
      sysPermMap.set(permName, created.id);
    }
  }

  // 3. Helper to assign system permissions
  const assignSysPermissions = async (roleId: number, permNames: string[]) => {
    for (const name of permNames) {
      const permissionId = sysPermMap.get(name);
      if (!permissionId) continue;

      const existing = await prisma.rolePermission.findFirst({
        where: { roleId, permissionId },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: { roleId, permissionId, isDeleted: false },
        });
      }
    }
  };

  // SuperAdmin (3): All System Permissions
  await assignSysPermissions(3, SYSTEM_PERMISSIONS);

  // Monk (1): System permissions for monastery management
  await assignSysPermissions(1, [
    'User.View',
    'Donor.View',
    'Monastery.View',
    'Monastery.Create',
    'Monastery.Update',
    'Monastery.Delete',
    'Monastery.ManageMembers',
    ...DONATION_PERMISSIONS,
  ]);

  // Donor (2): Read-only view
  await assignSysPermissions(2, [
    'User.View',
    'Donor.View',
    'Monastery.View',
    'Donation.View',
    'Donation.Create',
    'Donation.Cancel',
  ]);

  logger.info('Seeding Space Roles and Space Permissions...');

  // 4. Seed Space Roles
  for (const sRole of SPACE_ROLES) {
    await prisma.spaceRole.upsert({
      where: { id: sRole.id },
      update: {
        name: sRole.name,
        description: sRole.description,
        isDeleted: false,
      },
      create: {
        id: sRole.id,
        name: sRole.name,
        description: sRole.description,
        isDeleted: false,
      },
    });
  }

  // 5. Seed Space Permissions
  const spacePermMap = new Map<string, number>();
  for (const sp of SPACE_PERMISSIONS) {
    const existing = await prisma.spacePermission.findFirst({
      where: { name: sp.name },
    });
    if (existing) {
      if (existing.isDeleted) {
        await prisma.spacePermission.update({
          where: { id: existing.id },
          data: { description: sp.description, isDeleted: false },
        });
      }
      spacePermMap.set(sp.name, existing.id);
    } else {
      const created = await prisma.spacePermission.create({
        data: {
          name: sp.name,
          description: sp.description,
          isDeleted: false,
        },
      });
      spacePermMap.set(sp.name, created.id);
    }
  }

  // 6. Helper to assign space permissions
  const assignSpacePermissions = async (spaceRoleId: number, permNames: string[]) => {
    for (const name of permNames) {
      const spacePermissionId = spacePermMap.get(name);
      if (!spacePermissionId) continue;

      const existing = await prisma.spaceRolePermission.findFirst({
        where: { spaceRoleId, spacePermissionId },
      });
      if (!existing) {
        await prisma.spaceRolePermission.create({
          data: { spaceRoleId, spacePermissionId, isDeleted: false },
        });
      }
    }
  };

  // Space Admin (1): Full space management (all space permissions except Space.Delete, reserved for Owner)
  await assignSpacePermissions(
    1,
    SPACE_PERMISSIONS.filter((p) => p.name !== 'Space.Delete').map((p) => p.name)
  );

  // Space Moderator (2)
  await assignSpacePermissions(2, [
    'Space.View',
    'Space.Member.Invite',
    'Space.Member.Manage',
    'Space.Post.Create',
    'Space.Donation.Create',
    'Space.Donation.Review',
  ]);

  // Space Editor (3)
  await assignSpacePermissions(3, ['Space.View', 'Space.Post.Create', 'Space.Donation.Create']);

  // Space Member (4)
  await assignSpacePermissions(4, ['Space.View']);

  logger.info('RBAC seeding complete: 3 System Roles, 4 Space Roles, and permissions assigned.');
}

async function userSeeder() {
  await seedRbac();

  logger.info('Seeding default users...');
  const password = await Bun.password.hash('password123');

  // Admin user
  await prisma.user.upsert({
    where: { phone: '09999999999' },
    update: { roleId: 3 },
    create: {
      phone: '09999999999',
      name: 'SuperAdmin',
      password,
      email: 'admin@hsumchaint.org',
      roleId: 3,
    },
  });

  // Default Monk User
  await prisma.user.upsert({
    where: { phone: '09111111111' },
    update: { roleId: 1 },
    create: {
      phone: '09111111111',
      name: 'U Thuzana (Monk)',
      password,
      email: 'monk@hsumchaint.org',
      roleId: 1,
      monkProfile: {
        create: {
          monasteryName: 'Mahasi Sasana Yeiktha',
          monasteryAddress: 'Bahan Township, Yangon',
        },
      },
    },
  });

  // Test users
  for (let i = 0; i < 5; i++) {
    const phone = `0912345678${i}`;
    await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        name: `testUser${i}`,
        password,
        email: `test${i}@gmail.com`,
        roleId: i % 2 === 0 ? 1 : 2,
      },
    });
  }

  logger.info('Seeding finished successfully.');
}

userSeeder()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

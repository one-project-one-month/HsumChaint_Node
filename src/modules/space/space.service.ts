import { prisma } from '@/lib/prisma';
import { getSpaceRolePermissions } from '@/middlewares/permissionMiddleware';
import { AppError } from '@/utils/AppError';
import { type FormattedPermission, formatPermission } from '../role/role.service';
import { SPACE_PERMISSIONS, SPACE_ROLE_NAMES, SPACE_ROLES } from './space.permissions';
import type {
  CreateSpaceInput,
  InviteMemberInput,
  RespondInvitationInput,
  UpdateMemberRoleInput,
  UpdateSpaceInput,
} from './space.schema';

export interface MonasterySpaceDto {
  id: number;
  monasteryName: string;
  description: string | null;
  address: string | null;
  createdById: number | null;
  currentUserRoleId: number | null;
  currentUserRoleName: string | null;
  isOwner: boolean;
  permissions: string[];
}

/**
 * Resolves active space permissions for a user in a given space.
 */
export const resolveSpacePermissions = async (
  spaceRoleId: number | null | undefined,
  isOwner: boolean,
  isAdmin = false
): Promise<string[]> => {
  if (isOwner || isAdmin) {
    return [...SPACE_PERMISSIONS];
  }
  if (!spaceRoleId) {
    return [];
  }
  if (spaceRoleId === SPACE_ROLES.SPACE_ADMIN) {
    return SPACE_PERMISSIONS.filter((p) => p !== 'Space.Delete');
  }
  const perms = await getSpaceRolePermissions(spaceRoleId);
  return perms.filter((p) => p !== 'Space.Delete');
};

export interface MonasteryMemberDto {
  id: number;
  userId: number;
  name: string | null;
  phone: string | null;
  monasterySpaceId: number;
  spaceRoleId: number;
  spaceRoleName: string | null;
  roleId: number;
  roleName: string | null;
  isOwner: boolean;
  permissions: string[];
}

export interface InvitationResponseDto {
  invitationId: number;
  monasterySpaceId: number;
  invitedUserId: number;
  invitedById: number | null;
  spaceRoleId: number;
  spaceRoleName: string | null;
  roleId: number;
  roleName: string | null;
  status: number;
  createdAt: Date;
  message?: string;
}

/**
 * Checks if the member has permission to manage monastery (owner or has Space.Member.Manage)
 */
export const canManageMonastery = async (
  member: { spaceRoleId?: number; role?: number; isOwner: boolean } | null
): Promise<boolean> => {
  if (!member) return false;
  if (member.isOwner) return true;

  const roleId = member.spaceRoleId ?? member.role;
  if (!roleId) return false;

  if (roleId === SPACE_ROLES.SPACE_ADMIN) return true;

  const count = await prisma.spaceRolePermission.count({
    where: {
      spaceRoleId: roleId,
      isDeleted: false,
      spaceRole: { isDeleted: false },
      spacePermission: {
        isDeleted: false,
        name: {
          in: ['Space.Update', 'Space.Member.Manage', 'Space.Member.Invite', 'Space.Role.Manage'],
        },
      },
    },
  });
  return count > 0;
};

/**
 * Checks if the member can delete the monastery:
 * must be Owner, Monk role, and have Monastery.Delete permission
 */
export const canDeleteMonastery = async (
  member:
    | ({
        spaceRoleId?: number;
        role?: number;
        isOwner: boolean;
        userId?: number;
      } & {
        roleData?: { name: string; isDeleted: boolean } | null;
      })
    | null,
  currentUserId?: number
): Promise<boolean> => {
  if (!member?.isOwner) return false;

  const userId = member.userId ?? currentUserId;
  if (!userId) return false;

  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    include: { role: true },
  });

  if (!user?.role || user.role.isDeleted || user.role.name.toLowerCase() !== 'monk') {
    return false;
  }

  const count = await prisma.rolePermission.count({
    where: {
      roleId: user.roleId,
      role: { isDeleted: false },
      permission: {
        isDeleted: false,
        name: { in: ['Monastery.Delete', 'Space.Delete'] },
      },
    },
  });
  return count > 0;
};

/**
 * Helper to get a member of a monastery space
 */
export const getMember = async (userId: number, monasterySpaceId: number) => {
  return await prisma.monasteryMember.findFirst({
    where: {
      userId,
      monasterySpaceId,
      monasterySpace: { isDeleted: false },
      user: { isDeleted: false },
    },
    include: {
      spaceRole: true,
    },
  });
};

/**
 * Create Monastery (matching C# CreateMonastery)
 */
export const createMonasteryService = async (
  currentUserId: number,
  request: CreateSpaceInput
): Promise<MonasterySpaceDto> => {
  if (!request.monasteryName || request.monasteryName.trim().length === 0) {
    throw new AppError('Monastery name is required.', 400);
  }

  const creator = await prisma.user.findFirst({
    where: { id: currentUserId, isDeleted: false },
    include: { role: true },
  });

  if (!creator?.role || creator.role.isDeleted) {
    throw new AppError('User or active role not found.', 404);
  }

  return await prisma.$transaction(async (tx) => {
    const monastery = await tx.monasterySpace.create({
      data: {
        monasteryName: request.monasteryName.trim(),
        description: request.description?.trim(),
        address: request.address?.trim(),
        createdById: currentUserId,
        isDeleted: false,
      },
    });

    await tx.monasteryMember.create({
      data: {
        userId: currentUserId,
        monasterySpaceId: monastery.id,
        spaceRoleId: SPACE_ROLES.SPACE_ADMIN,
        isOwner: true,
      },
    });

    return {
      id: monastery.id,
      monasteryName: monastery.monasteryName,
      description: monastery.description,
      address: monastery.address,
      createdById: monastery.createdById,
      currentUserRoleId: SPACE_ROLES.SPACE_ADMIN,
      currentUserRoleName: SPACE_ROLE_NAMES[SPACE_ROLES.SPACE_ADMIN],
      isOwner: true,
      permissions: [...SPACE_PERMISSIONS],
    };
  });
};

/**
 * Helper to check if a user is a System Admin (role ID 3 or role named 'Admin')
 */
export const checkIsAdmin = async (userId: number, roleId?: number): Promise<boolean> => {
  if (roleId === 3) return true;
  if (roleId) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, isDeleted: false },
    });
    if (role && (role.id === 3 || role.name.toLowerCase() === 'admin')) {
      return true;
    }
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    include: { role: true },
  });
  return Boolean(user?.role && (user.role.id === 3 || user.role.name.toLowerCase() === 'admin'));
};

/**
 * Update Monastery (matching C# UpdateMonastery)
 */
export const updateMonasteryService = async (
  currentUserId: number,
  monasterySpaceId: number,
  request: UpdateSpaceInput,
  currentUserRoleId?: number
): Promise<MonasterySpaceDto> => {
  const member = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);

  if (!isAdmin && !(await canManageMonastery(member))) {
    throw new AppError('User is not authorized to manage this monastery.', 403);
  }

  const monastery = await prisma.monasterySpace.findFirst({
    where: { id: monasterySpaceId, isDeleted: false },
  });
  if (!monastery) {
    throw new AppError('Monastery not found.', 404);
  }

  const updated = await prisma.monasterySpace.update({
    where: { id: monasterySpaceId },
    data: {
      monasteryName: request.monasteryName?.trim() || monastery.monasteryName,
      description:
        request.description !== undefined ? request.description.trim() : monastery.description,
      address: request.address !== undefined ? request.address.trim() : monastery.address,
    },
  });

  const memberSpaceRoleId = member?.spaceRoleId;
  const isOwner = member?.isOwner ?? false;
  const spaceRoleName = member?.spaceRole?.name ?? (isAdmin ? 'Admin' : null);
  const permissions = await resolveSpacePermissions(memberSpaceRoleId, isOwner, isAdmin);

  return {
    id: updated.id,
    monasteryName: updated.monasteryName,
    description: updated.description,
    address: updated.address,
    createdById: updated.createdById,
    currentUserRoleId: memberSpaceRoleId ?? (isAdmin ? null : (currentUserRoleId ?? null)),
    currentUserRoleName: spaceRoleName,
    isOwner,
    permissions,
  };
};

/**
 * Delete Monastery (matching C# DeleteMonastery: soft delete)
 */
export const deleteMonasteryService = async (
  currentUserId: number,
  monasterySpaceId: number,
  currentUserRoleId?: number
): Promise<{ success: boolean; message: string }> => {
  const monastery = await prisma.monasterySpace.findFirst({
    where: { id: monasterySpaceId, isDeleted: false },
  });
  if (!monastery) {
    throw new AppError('Monastery not found.', 404);
  }

  const member = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);

  if (!isAdmin && !(await canDeleteMonastery(member, currentUserId))) {
    throw new AppError(
      'User is not authorized to delete this monastery. Only the monastery owner (Monk) can delete the space.',
      403
    );
  }

  await prisma.monasterySpace.update({
    where: { id: monasterySpaceId },
    data: { isDeleted: true },
  });

  return { success: true, message: 'Monastery deleted successfully.' };
};

/**
 * Get Monastery by ID (matching C# GetMonastery)
 */
export const getMonasteryService = async (
  currentUserId: number,
  monasterySpaceId: number,
  currentUserRoleId?: number
): Promise<MonasterySpaceDto> => {
  const monastery = await prisma.monasterySpace.findFirst({
    where: { id: monasterySpaceId, isDeleted: false },
  });
  if (!monastery) {
    throw new AppError('Monastery not found.', 404);
  }

  const member = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);

  if (!member && !isAdmin) {
    throw new AppError('User is not a member of this monastery.', 403);
  }

  const roleId = member?.spaceRoleId ?? (isAdmin ? null : (currentUserRoleId ?? null));
  const roleName = member?.spaceRole?.name ?? (isAdmin ? 'Admin' : null);
  const isOwner = member?.isOwner ?? false;
  const permissions = await resolveSpacePermissions(roleId, isOwner, isAdmin);

  return {
    id: monastery.id,
    monasteryName: monastery.monasteryName,
    description: monastery.description,
    address: monastery.address,
    createdById: monastery.createdById,
    currentUserRoleId: roleId,
    currentUserRoleName: roleName,
    isOwner,
    permissions,
  };
};

/**
 * Get My Monasteries (matching C# GetMyMonasteries, or all monasteries for System Admin)
 */
export const getMyMonasteriesService = async (
  currentUserId: number,
  pagination: { page?: number; limit?: number; search?: string },
  currentUserRoleId?: number
) => {
  const page = pagination.page && pagination.page > 0 ? pagination.page : 1;
  const limit = pagination.limit && pagination.limit > 0 ? pagination.limit : 10;
  const skip = (page - 1) * limit;

  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);

  if (isAdmin) {
    const spaceWhere: {
      isDeleted: boolean;
      OR?: { monasteryName?: { contains: string }; description?: { contains: string } }[];
    } = {
      isDeleted: false,
    };

    if (pagination.search) {
      spaceWhere.OR = [
        { monasteryName: { contains: pagination.search.trim() } },
        { description: { contains: pagination.search.trim() } },
      ];
    }

    const [spaces, total] = await Promise.all([
      prisma.monasterySpace.findMany({
        where: spaceWhere,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          members: {
            where: { userId: currentUserId },
            include: { spaceRole: true },
          },
        },
      }),
      prisma.monasterySpace.count({ where: spaceWhere }),
    ]);

    const distinctRoleIds = Array.from(
      new Set(
        spaces
          .flatMap((s) => s.members?.map((m) => m.spaceRoleId) ?? [])
          .filter((id): id is number => typeof id === 'number')
      )
    );
    const rolePermMap = new Map<number, string[]>();
    await Promise.all(
      distinctRoleIds.map(async (id) => {
        rolePermMap.set(id, await getSpaceRolePermissions(id));
      })
    );

    const items: MonasterySpaceDto[] = spaces.map((s) => {
      const myMembership = s.members && s.members.length > 0 ? s.members[0] : null;
      const isOwner = myMembership ? myMembership.isOwner : false;
      const perms =
        isAdmin || isOwner
          ? [...SPACE_PERMISSIONS]
          : myMembership
            ? (rolePermMap.get(myMembership.spaceRoleId) ?? [])
            : [...SPACE_PERMISSIONS];

      return {
        id: s.id,
        monasteryName: s.monasteryName,
        description: s.description,
        address: s.address,
        createdById: s.createdById,
        currentUserRoleId: myMembership ? myMembership.spaceRoleId : null,
        currentUserRoleName: myMembership?.spaceRole?.name ?? 'Admin',
        isOwner,
        permissions: perms,
      };
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const whereClause: {
    userId: number;
    monasterySpace: {
      isDeleted: boolean;
      OR?: { monasteryName?: { contains: string }; description?: { contains: string } }[];
    };
  } = {
    userId: currentUserId,
    monasterySpace: {
      isDeleted: false,
    },
  };

  if (pagination.search) {
    whereClause.monasterySpace.OR = [
      { monasteryName: { contains: pagination.search.trim() } },
      { description: { contains: pagination.search.trim() } },
    ];
  }

  const [memberships, total] = await Promise.all([
    prisma.monasteryMember.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        monasterySpace: true,
        spaceRole: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.monasteryMember.count({ where: whereClause }),
  ]);

  const distinctRoleIds = Array.from(
    new Set(
      memberships.map((m) => m.spaceRoleId).filter((id): id is number => typeof id === 'number')
    )
  );
  const rolePermMap = new Map<number, string[]>();
  await Promise.all(
    distinctRoleIds.map(async (id) => {
      rolePermMap.set(id, await getSpaceRolePermissions(id));
    })
  );

  const items: MonasterySpaceDto[] = memberships.map((m) => {
    const perms = m.isOwner ? [...SPACE_PERMISSIONS] : (rolePermMap.get(m.spaceRoleId) ?? []);

    return {
      id: m.monasterySpace.id,
      monasteryName: m.monasterySpace.monasteryName,
      description: m.monasterySpace.description,
      address: m.monasterySpace.address,
      createdById: m.monasterySpace.createdById,
      currentUserRoleId: m.spaceRoleId,
      currentUserRoleName: m.spaceRole?.name ?? null,
      isOwner: m.isOwner,
      permissions: perms,
    };
  });

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Invite Member to Monastery (matching C# InviteMember)
 */
export const inviteMemberService = async (
  currentUserId: number,
  monasterySpaceId: number,
  request: InviteMemberInput,
  currentUserRoleId?: number
): Promise<InvitationResponseDto> => {
  const inviter = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);
  if (!isAdmin && !(await canManageMonastery(inviter))) {
    throw new AppError('User is not authorized to invite monastery members.', 403);
  }

  const targetRoleId = request.spaceRoleId ?? request.roleId ?? SPACE_ROLES.SPACE_MEMBER;
  if (targetRoleId === SPACE_ROLES.SPACE_ADMIN && !inviter?.isOwner && !isAdmin) {
    throw new AppError(
      'Only the monastery space owner or system admin can invite a Space Admin.',
      403
    );
  }
  const spaceRole = await prisma.spaceRole.findFirst({
    where: { id: targetRoleId, isDeleted: false },
  });
  if (!spaceRole) {
    throw new AppError('Space role not found.', 404);
  }

  let invitedUser = null;
  const targetPhone = (request.phone ?? request.phoneNumber)?.trim();
  const normalizedPhone = targetPhone
    ? targetPhone.startsWith('+959')
      ? `09${targetPhone.slice(4)}`
      : targetPhone.startsWith('959')
        ? `09${targetPhone.slice(3)}`
        : targetPhone
    : undefined;

  if (request.userId) {
    invitedUser = await prisma.user.findFirst({
      where: { id: request.userId, isDeleted: false },
    });
  } else if (normalizedPhone) {
    invitedUser = await prisma.user.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone: targetPhone }],
        isDeleted: false,
      },
    });
  }

  if (!invitedUser) {
    throw new AppError('Invited user not found.', 404);
  }

  if (invitedUser.id === currentUserId) {
    throw new AppError('User cannot invite themselves.', 400);
  }

  const existingMember = await getMember(invitedUser.id, monasterySpaceId);
  if (existingMember) {
    throw new AppError('User is already a monastery member.', 400);
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      monasterySpaceId,
      invitedUserId: invitedUser.id,
      status: 0, // Pending
    },
  });
  if (existingInvitation) {
    throw new AppError('User already has a pending invitation.', 400);
  }

  return await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.create({
      data: {
        monasterySpaceId,
        invitedUserId: invitedUser.id,
        invitedById: currentUserId,
        spaceRoleId: targetRoleId,
        status: 0, // Pending
      },
    });

    await tx.notification.create({
      data: {
        userId: invitedUser.id,
        type: 1, // NotificationType.Invitation
        message: 'You have a new monastery invitation.',
        isRead: false,
        isDeleted: false,
      },
    });

    return {
      invitationId: invitation.id,
      monasterySpaceId,
      invitedUserId: invitedUser.id,
      invitedById: currentUserId,
      spaceRoleId: targetRoleId,
      spaceRoleName: spaceRole.name,
      roleId: targetRoleId,
      roleName: spaceRole.name,
      status: invitation.status,
      createdAt: invitation.createdAt,
    };
  });
};

/**
 * Respond to Invitation (matching C# RespondToInvitation)
 */
export const respondToInvitationService = async (
  currentUserId: number,
  invitationId: number,
  request: RespondInvitationInput
): Promise<InvitationResponseDto> => {
  const isAccept = request.status === 1;
  const isReject = request.status === 0 || request.status === 2;
  if (!isAccept && !isReject) {
    throw new AppError('Invitation response must be Accept or Reject.', 400);
  }
  const resolvedStatus = isAccept ? 1 : 2;

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { spaceRole: true },
  });
  if (!invitation) {
    throw new AppError('Invitation not found.', 404);
  }

  if (invitation.invitedUserId !== currentUserId) {
    throw new AppError('User is not authorized to respond to this invitation.', 403);
  }

  if (invitation.status !== 0) {
    throw new AppError('Invitation has already been answered.', 400);
  }

  const spaceRole =
    invitation.spaceRole ??
    (await prisma.spaceRole.findFirst({
      where: { id: invitation.spaceRoleId, isDeleted: false },
    }));

  if (resolvedStatus === 1) {
    // Accept
    if (!spaceRole || spaceRole.isDeleted) {
      throw new AppError('Invitation role is inactive or not found.', 400);
    }

    const existingMember = await getMember(currentUserId, invitation.monasterySpaceId);
    if (!existingMember) {
      await prisma.monasteryMember.create({
        data: {
          userId: currentUserId,
          monasterySpaceId: invitation.monasterySpaceId,
          spaceRoleId: invitation.spaceRoleId,
          isOwner: false,
        },
      });
    }
  }

  const updated = await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: resolvedStatus },
    include: { spaceRole: true },
  });

  return {
    invitationId: updated.id,
    monasterySpaceId: updated.monasterySpaceId,
    invitedUserId: updated.invitedUserId,
    invitedById: updated.invitedById,
    spaceRoleId: updated.spaceRoleId,
    spaceRoleName: updated.spaceRole?.name ?? spaceRole?.name ?? null,
    roleId: updated.spaceRoleId,
    roleName: updated.spaceRole?.name ?? spaceRole?.name ?? null,
    status: updated.status,
    createdAt: updated.createdAt,
    message:
      resolvedStatus === 1
        ? 'Invitation accepted successfully.'
        : 'Invitation rejected successfully.',
  };
};

/**
 * Get Members of Monastery (matching C# GetMembers)
 */
export const getMembersService = async (
  currentUserId: number,
  monasterySpaceId: number,
  pagination: { page?: number; limit?: number },
  currentUserRoleId?: number
) => {
  const monastery = await prisma.monasterySpace.findFirst({
    where: { id: monasterySpaceId, isDeleted: false },
  });
  if (!monastery) {
    throw new AppError('Monastery not found.', 404);
  }

  const member = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);

  if (!member && !isAdmin) {
    throw new AppError('User is not a member of this monastery.', 403);
  }

  const page = pagination.page && pagination.page > 0 ? pagination.page : 1;
  const limit = pagination.limit && pagination.limit > 0 ? pagination.limit : 10;
  const skip = (page - 1) * limit;

  const [memberships, total] = await Promise.all([
    prisma.monasteryMember.findMany({
      where: {
        monasterySpaceId,
        user: { isDeleted: false },
      },
      skip,
      take: limit,
      orderBy: { id: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
        spaceRole: true,
      },
    }),
    prisma.monasteryMember.count({
      where: {
        monasterySpaceId,
        user: { isDeleted: false },
      },
    }),
  ]);

  const distinctRoleIds = Array.from(
    new Set(
      memberships.map((m) => m.spaceRoleId).filter((id): id is number => typeof id === 'number')
    )
  );
  const rolePermMap = new Map<number, string[]>();
  await Promise.all(
    distinctRoleIds.map(async (id) => {
      rolePermMap.set(id, await getSpaceRolePermissions(id));
    })
  );

  const items: MonasteryMemberDto[] = memberships.map((m) => {
    const perms = m.isOwner
      ? [...SPACE_PERMISSIONS]
      : m.spaceRoleId === SPACE_ROLES.SPACE_ADMIN
        ? SPACE_PERMISSIONS.filter((p) => p !== 'Space.Delete')
        : (rolePermMap.get(m.spaceRoleId) ?? []).filter((p) => p !== 'Space.Delete');

    return {
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      phone: m.user.phone,
      monasterySpaceId: m.monasterySpaceId,
      spaceRoleId: m.spaceRoleId,
      spaceRoleName: m.spaceRole?.name ?? null,
      roleId: m.spaceRoleId,
      roleName: m.spaceRole?.name ?? null,
      isOwner: m.isOwner,
      permissions: perms,
    };
  });

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Update Member Role (matching C# UpdateMemberRole)
 */
export const updateMemberRoleService = async (
  currentUserId: number,
  monasterySpaceId: number,
  memberUserId: number,
  request: UpdateMemberRoleInput,
  currentUserRoleId?: number
): Promise<MonasteryMemberDto> => {
  const actor = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);
  if (!isAdmin && !(await canManageMonastery(actor))) {
    throw new AppError('User is not authorized to manage monastery members.', 403);
  }

  const targetRoleId = request.spaceRoleId ?? request.roleId;
  if (!targetRoleId) {
    throw new AppError('Valid roleId is required.', 400);
  }

  const spaceRole = await prisma.spaceRole.findFirst({
    where: { id: targetRoleId, isDeleted: false },
  });
  if (!spaceRole) {
    throw new AppError('Space role not found.', 404);
  }

  const member = await getMember(memberUserId, monasterySpaceId);
  if (!member) {
    throw new AppError('Member not found.', 404);
  }

  if (member.isOwner) {
    throw new AppError('Owner member role cannot be changed.', 400);
  }

  if (targetRoleId === SPACE_ROLES.SPACE_ADMIN && !actor?.isOwner && !isAdmin) {
    throw new AppError(
      'Only the monastery space owner or system admin can assign the Space Admin role.',
      403
    );
  }

  if (member.spaceRoleId === SPACE_ROLES.SPACE_ADMIN && !actor?.isOwner && !isAdmin) {
    throw new AppError(
      'Only the monastery space owner or system admin can change a Space Admin role.',
      403
    );
  }

  const updated = await prisma.monasteryMember.update({
    where: { id: member.id },
    data: { spaceRoleId: targetRoleId },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      spaceRole: true,
    },
  });

  const permissions = await resolveSpacePermissions(updated.spaceRoleId, updated.isOwner);

  return {
    id: updated.id,
    userId: updated.user.id,
    name: updated.user.name,
    phone: updated.user.phone,
    monasterySpaceId: updated.monasterySpaceId,
    spaceRoleId: updated.spaceRoleId,
    spaceRoleName: updated.spaceRole?.name ?? spaceRole.name,
    roleId: updated.spaceRoleId,
    roleName: updated.spaceRole?.name ?? spaceRole.name,
    isOwner: updated.isOwner,
    permissions,
  };
};

/**
 * Remove Member from Monastery (matching C# RemoveMember)
 */
export const removeMemberService = async (
  currentUserId: number,
  monasterySpaceId: number,
  memberUserId: number,
  currentUserRoleId?: number
): Promise<MonasteryMemberDto> => {
  const actor = await getMember(currentUserId, monasterySpaceId);
  const isAdmin = await checkIsAdmin(currentUserId, currentUserRoleId);
  if (!isAdmin && !(await canManageMonastery(actor))) {
    throw new AppError('User is not authorized to remove monastery members.', 403);
  }

  const member = await prisma.monasteryMember.findFirst({
    where: {
      userId: memberUserId,
      monasterySpaceId,
      monasterySpace: { isDeleted: false },
    },
    include: {
      spaceRole: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!member) {
    throw new AppError('Member not found.', 404);
  }

  if (member.isOwner) {
    throw new AppError('Owner member cannot be removed.', 400);
  }

  if (member.spaceRoleId === SPACE_ROLES.SPACE_ADMIN && !actor?.isOwner && !isAdmin) {
    throw new AppError(
      'Only the monastery space owner or system admin can remove a Space Admin.',
      403
    );
  }

  const user =
    member.user ??
    (await prisma.user.findUnique({
      where: { id: memberUserId },
      select: { id: true, name: true, phone: true },
    }));
  const spaceRole =
    member.spaceRole ?? (await prisma.spaceRole.findUnique({ where: { id: member.spaceRoleId } }));

  await prisma.monasteryMember.delete({ where: { id: member.id } });

  return {
    id: member.id,
    userId: member.userId,
    name: user?.name ?? null,
    phone: user?.phone ?? null,
    monasterySpaceId: member.monasterySpaceId,
    spaceRoleId: member.spaceRoleId,
    spaceRoleName: spaceRole?.name ?? null,
    roleId: member.spaceRoleId,
    roleName: spaceRole?.name ?? null,
    isOwner: member.isOwner,
    permissions: [],
  };
};

export interface SpaceRoleDto {
  roleId: number;
  roleName: string;
  description: string | null;
  isDeleted: boolean;
  permissions: FormattedPermission[];
}

/**
 * Get all available space roles with their permissions
 */
export const getSpaceRolesService = async (): Promise<SpaceRoleDto[]> => {
  const roles = await prisma.spaceRole.findMany({
    where: { isDeleted: false },
    orderBy: { id: 'asc' },
    include: {
      permissions: {
        where: { isDeleted: false },
        include: {
          spacePermission: true,
        },
      },
    },
  });

  return roles.map((role) => ({
    roleId: role.id,
    roleName: role.name,
    description: role.description,
    isDeleted: role.isDeleted,
    permissions: role.permissions
      .filter((p) => p.spacePermission && !p.spacePermission.isDeleted)
      .map((p) => formatPermission(p.spacePermission)),
  }));
};

/**
 * Get space role by ID with its permissions
 */
export const getSpaceRoleByIdService = async (id: number): Promise<SpaceRoleDto> => {
  const role = await prisma.spaceRole.findFirst({
    where: { id, isDeleted: false },
    include: {
      permissions: {
        where: { isDeleted: false },
        include: {
          spacePermission: true,
        },
      },
    },
  });

  if (!role) {
    throw new AppError('Space role not found.', 404);
  }

  return {
    roleId: role.id,
    roleName: role.name,
    description: role.description,
    isDeleted: role.isDeleted,
    permissions: role.permissions
      .filter((p) => p.spacePermission && !p.spacePermission.isDeleted)
      .map((p) => formatPermission(p.spacePermission)),
  };
};

// Aliases for compatibility
export const createSpaceService = createMonasteryService;
export const updateSpaceService = updateMonasteryService;
export const deleteSpaceService = deleteMonasteryService;
export const getSpaceByIdService = getMonasteryService;
export const getSpacesService = getMyMonasteriesService;

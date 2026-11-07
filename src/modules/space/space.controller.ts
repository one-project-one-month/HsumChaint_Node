import type { NextFunction, Request, Response } from 'express';
import {
  sendCursorPaginatedResponse,
  sendPaginatedResponse,
  sendSuccessResponse,
} from '@/utils/response';
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
} from './space.service';

/**
 * 16. Public Monastery Catalog Listing (offset pagination, [AllowAnonymous])
 */
export const getPublicMonasteriesCatalog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const pageNumber = Number(req.query.pageNumber || req.query.page || 1);
    const pageSize = Number(req.query.pageSize || req.query.limit || 10);

    const result = await getPublicMonasteriesCatalogService({ pageNumber, pageSize });

    return sendPaginatedResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      },
      'Monasteries retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 16b. Public Monastery Catalog Feed (mobile cursor pagination, [AllowAnonymous])
 */
export const getPublicMonasteriesFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lastId =
      req.query.lastId !== undefined && req.query.lastId !== ''
        ? Number(req.query.lastId)
        : undefined;
    const pageSize = Number(req.query.pageSize || req.query.limit || 15);

    const result = await getPublicMonasteriesFeedService({ lastId, pageSize });

    return sendCursorPaginatedResponse(
      res,
      result.items,
      {
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
        pageSize: result.pageSize,
      },
      'Monasteries feed retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 17. Search Public Monasteries (offset pagination, [AllowAnonymous])
 */
export const searchPublicMonasteries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keyword = (req.query.keyword as string | undefined) ?? '';
    const pageNumber = Number(req.query.pageNumber || req.query.page || 1);
    const pageSize = Number(req.query.pageSize || req.query.limit || 10);

    const result = await searchPublicMonasteriesService({ keyword, pageNumber, pageSize });

    return sendPaginatedResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      },
      'Monasteries retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 17b. Search Public Monasteries Feed (mobile cursor pagination, [AllowAnonymous])
 */
export const searchPublicMonasteriesFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const keyword = req.query.keyword as string | undefined;
    const lastId =
      req.query.lastId !== undefined && req.query.lastId !== ''
        ? Number(req.query.lastId)
        : undefined;
    const pageSize = Number(req.query.pageSize || req.query.limit || 15);

    const result = await searchPublicMonasteriesFeedService({ keyword, lastId, pageSize });

    return sendCursorPaginatedResponse(
      res,
      result.items,
      {
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
        pageSize: result.pageSize,
      },
      'Monasteries feed retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 18. Create Monastery Space (authenticated, Monastery.Create)
 */
export const createSpace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const space = await createMonasteryService(req.user.userId, req.body);
    return sendSuccessResponse(res, space, 'Monastery created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 19. Get My Monasteries (authenticated, offset pagination)
 */
export const getMyMonasteries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageNumber = Number(req.query.pageNumber || req.query.page || 1);
    const pageSize = Number(req.query.pageSize || req.query.limit || 10);
    const search = req.query.search as string | undefined;

    const result = await getMyMonasteriesService(
      req.user.userId,
      { pageNumber, pageSize, search },
      req.user.roleId
    );

    return sendPaginatedResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      },
      'Monasteries retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 19b. Get My Monasteries Feed (authenticated, mobile cursor pagination)
 */
export const getMyMonasteriesFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lastId =
      req.query.lastId !== undefined && req.query.lastId !== ''
        ? Number(req.query.lastId)
        : undefined;
    const pageSize = Number(req.query.pageSize || req.query.limit || 15);

    const result = await getMyMonasteriesFeedService(
      req.user.userId,
      { lastId, pageSize },
      req.user.roleId
    );

    return sendCursorPaginatedResponse(
      res,
      result.items,
      {
        nextCursor: result.nextCursor,
        hasNextPage: result.hasNextPage,
        pageSize: result.pageSize,
      },
      'Monasteries feed retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 20. Get Monastery Space Details (authenticated, Space.View)
 */
export const getSpaceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const space = await getMonasteryService(req.user.userId, spaceId, req.user.roleId);
    return sendSuccessResponse(res, space, 'Monastery retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 21. Update Monastery Space (authenticated, Space.Update)
 */
export const updateSpace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const updated = await updateMonasteryService(
      req.user.userId,
      spaceId,
      req.body,
      req.user.roleId
    );
    return sendSuccessResponse(res, updated, 'Monastery updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 22. Delete Monastery Space (authenticated, Space.Delete - Owner only)
 */
export const deleteSpace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const result = await deleteMonasteryService(req.user.userId, spaceId, req.user.roleId);
    return sendSuccessResponse(res, result, 'Monastery deleted successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Get current user space permissions (authenticated)
 */
export const getSpacePermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const permissions = await getCurrentUserSpacePermissionsService(
      req.user.userId,
      spaceId,
      req.user.roleId
    );
    return sendSuccessResponse(res, permissions, 'User space permissions retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Space Roles catalog (e.g. Space Admin, Space Moderator, Space Editor, Space Member)
 */
export const getSpaceRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params.id ? Number(req.params.id) : undefined;
    const roles = await getSpaceRolesService(spaceId);
    return sendSuccessResponse(res, { roles }, 'Space roles retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

export const getSpaceRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleId = Number(req.params.id);
    const role = await getSpaceRoleByIdService(roleId);
    return sendSuccessResponse(res, role, 'Space role retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * 23. Member Invitations (authenticated, Space.InviteMember)
 */
export const inviteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const invitation = await inviteMemberService(
      req.user.userId,
      spaceId,
      req.body,
      req.user.roleId
    );
    return sendSuccessResponse(res, invitation, 'Invitation created successfully.', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Respond to invitation (authenticated)
 */
export const respondToInvitation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invitationId = Number(req.params.invitationId);
    const result = await respondToInvitationService(req.user.userId, invitationId, req.body);
    return sendSuccessResponse(res, result, result.message ?? 'Invitation answered successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Member Management: Get members (authenticated, Space.View)
 */
export const getSpaceMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const pageNumber = Number(req.query.pageNumber || req.query.page || 1);
    const pageSize = Number(req.query.pageSize || req.query.limit || 10);

    const result = await getMembersService(
      req.user.userId,
      spaceId,
      { pageNumber, pageSize },
      req.user.roleId
    );

    return sendPaginatedResponse(
      res,
      result.items,
      {
        pageNumber: result.pageNumber,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasPreviousPage: result.hasPreviousPage,
        hasNextPage: result.hasNextPage,
      },
      'Members retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Member Management: Update member role (authenticated, Space.Role.Manage)
 */
export const updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const memberUserId = Number(req.params.memberUserId ?? req.params.userId);
    const updated = await updateMemberRoleService(
      req.user.userId,
      spaceId,
      memberUserId,
      req.body,
      req.user.roleId
    );
    return sendSuccessResponse(res, updated, 'Member role updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Member Management: Remove space member (authenticated, Space.Member.Remove)
 */
export const removeSpaceMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = Number(req.params.id);
    const memberUserId = Number(req.params.memberUserId ?? req.params.userId);
    const result = await removeMemberService(
      req.user.userId,
      spaceId,
      memberUserId,
      req.user.roleId
    );
    return sendSuccessResponse(res, result, 'Member removed successfully.');
  } catch (err) {
    next(err);
  }
};

// Aliases for compatibility
export const getSpaces = getPublicMonasteriesCatalog;

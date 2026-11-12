import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@/lib/prisma';
import { getSpaceRolePermissions } from '@/middlewares/permissionMiddleware';
import { AppError } from '@/utils/AppError';
import type { SpacePermission } from './space.permissions';

export interface SpaceMemberContext {
  id: number;
  userId: number;
  monasterySpaceId: number;
  spaceRoleId: number;
  isOwner: boolean;
}

declare global {
  namespace Express {
    interface Request {
      spaceMember?: SpaceMemberContext;
    }
  }
}

/**
 * Express middleware to check if the authenticated user has a specific required space permission
 * within the requested Monastery Space.
 */
export const checkSpacePermission = (requiredPermission: SpacePermission) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user?.userId) {
        return next(new AppError('Unauthorized: Missing user authentication', 401));
      }

      // 1. SuperAdmin Bypass (Global System Admin roleId = 1)
      if (user.roleId === 1) {
        return next();
      }

      const spaceId = Number(req.params.id || req.params.spaceId);
      if (!spaceId || Number.isNaN(spaceId)) {
        return next(new AppError('Bad Request: Invalid or missing Space ID', 400));
      }

      // 2. Fetch space membership
      const member = await prisma.monasteryMember.findFirst({
        where: {
          userId: user.userId,
          monasterySpaceId: spaceId,
        },
      });

      if (!member) {
        return next(new AppError('Forbidden: You are not a member of this space', 403));
      }

      req.spaceMember = member;

      // 3. Space Owner Bypass (Monk who created/owns the space)
      if (member.isOwner) {
        return next();
      }

      // 4. Dynamic RBAC check: retrieve permissions for the member's space role
      const permissions = await getSpaceRolePermissions(member.spaceRoleId);

      if (!permissions.includes(requiredPermission)) {
        return next(
          new AppError(
            `Forbidden: You do not have permission '${requiredPermission}' in this space`,
            403
          )
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

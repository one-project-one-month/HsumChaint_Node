import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission, requireSpacePermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import { createSpaceDonationRouter } from '@/modules/donation/donation.routes';
import {
  createSpace,
  deleteSpace,
  getMyMonasteries,
  getMyMonasteriesFeed,
  getPublicMonasteriesCatalog,
  getPublicMonasteriesFeed,
  getSpaceById,
  getSpaceMembers,
  getSpacePermissions,
  getSpaceRoleById,
  getSpaceRoles,
  inviteMember,
  removeSpaceMember,
  respondToInvitation,
  searchPublicMonasteries,
  searchPublicMonasteriesFeed,
  updateMemberRole,
  updateSpace,
} from './space.controller';
import {
  catalogPaginationSchema,
  createSpaceSchema,
  cursorFeedSchema,
  inviteMemberSchema,
  membersPaginationSchema,
  removeMemberSchema,
  respondInvitationSchema,
  searchFeedSchema,
  searchMonasteriesSchema,
  spaceIdParamSchema,
  updateMemberRoleSchema,
  updateSpaceSchema,
} from './space.schema';

export const spaceRouter = Router();

// ==========================================
// Public Monastery Catalog & Discovery ([AllowAnonymous])
// ==========================================
// 16. Public Monastery Catalog Listing (offset pagination)
spaceRouter.get('/', validator(catalogPaginationSchema), getPublicMonasteriesCatalog);

// 16b. Public Monastery Catalog Feed (mobile cursor pagination)
spaceRouter.get('/feed', validator(cursorFeedSchema), getPublicMonasteriesFeed);

// 17. Search Public Monasteries (offset pagination)
spaceRouter.get('/search', validator(searchMonasteriesSchema), searchPublicMonasteries);

// 17b. Search Public Monasteries Feed (mobile cursor pagination)
spaceRouter.get('/search/feed', validator(searchFeedSchema), searchPublicMonasteriesFeed);

// ==========================================
// Space Roles Catalog (Global)
// ==========================================
spaceRouter.get('/roles', authMiddleware, getSpaceRoles);
spaceRouter.get('/roles/:id', authMiddleware, validator(spaceIdParamSchema), getSpaceRoleById);

// ==========================================
// Authenticated Space Management Endpoints
// ==========================================
// 18. Create Monastery Space (monk/admin)
spaceRouter.post(
  '/',
  authMiddleware,
  checkPermission('Monastery.Create'),
  validator(createSpaceSchema),
  createSpace
);

// 19. Get My Monasteries (offset pagination)
spaceRouter.get('/mine', authMiddleware, validator(catalogPaginationSchema), getMyMonasteries);

// 19b. Get My Monasteries Feed (mobile cursor pagination)
spaceRouter.get('/mine/feed', authMiddleware, validator(cursorFeedSchema), getMyMonasteriesFeed);

// Member Invitations response
spaceRouter.post(
  '/invitations/:invitationId/respond',
  authMiddleware,
  validator(respondInvitationSchema),
  respondToInvitation
);

// Space Donations sub-router
spaceRouter.use('/:spaceId/donations', authMiddleware, createSpaceDonationRouter());

// ==========================================
// Space Context Endpoints (by Space ID)
// ==========================================
// Current user space permissions
spaceRouter.get(
  '/:id/permissions',
  authMiddleware,
  validator(spaceIdParamSchema),
  getSpacePermissions
);

// Space roles available for monastery space
spaceRouter.get('/:id/roles', authMiddleware, validator(spaceIdParamSchema), getSpaceRoles);

// Space members listing
spaceRouter.get(
  '/:id/members',
  authMiddleware,
  validator(membersPaginationSchema),
  requireSpacePermission('Space.View'),
  getSpaceMembers
);

// Space member role updates (supports /:id/members/:memberUserId/role and /:id/members/:userId)
spaceRouter.put(
  '/:id/members/:memberUserId/role',
  authMiddleware,
  requireSpacePermission('Space.Role.Manage'),
  validator(updateMemberRoleSchema),
  updateMemberRole
);
spaceRouter.put(
  '/:id/members/:userId',
  authMiddleware,
  requireSpacePermission('Space.Role.Manage'),
  validator(updateMemberRoleSchema),
  updateMemberRole
);

// Remove space member
spaceRouter.delete(
  '/:id/members/:memberUserId',
  authMiddleware,
  requireSpacePermission('Space.Member.Remove'),
  validator(removeMemberSchema),
  removeSpaceMember
);
spaceRouter.delete(
  '/:id/members/:userId',
  authMiddleware,
  requireSpacePermission('Space.Member.Remove'),
  validator(removeMemberSchema),
  removeSpaceMember
);

// Invite member to space
spaceRouter.post(
  '/:id/invitations',
  authMiddleware,
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Member.Invite'),
  validator(inviteMemberSchema),
  inviteMember
);

// 20. Get Monastery Space Details
spaceRouter.get(
  '/:id',
  authMiddleware,
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.View'),
  getSpaceById
);

// 21. Update Monastery Space (supports PUT and PATCH)
spaceRouter.put(
  '/:id',
  authMiddleware,
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Update'),
  validator(updateSpaceSchema),
  updateSpace
);
spaceRouter.patch(
  '/:id',
  authMiddleware,
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Update'),
  validator(updateSpaceSchema),
  updateSpace
);

// 22. Delete Monastery Space (Owner only)
spaceRouter.delete(
  '/:id',
  authMiddleware,
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Delete'),
  deleteSpace
);

export default spaceRouter;

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

const router = Router();

// ==========================================
// Public Monastery Catalog & Discovery ([AllowAnonymous])
// ==========================================

// Public Monastery Catalog Listing
router.get('/', validator(catalogPaginationSchema), getPublicMonasteriesCatalog);

// Public Monastery Catalog Feed (Mobile Cursor)
router.get('/feed', validator(cursorFeedSchema), getPublicMonasteriesFeed);

// Search Public Monasteries
router.get('/search', validator(searchMonasteriesSchema), searchPublicMonasteries);

// Search Public Monasteries Feed (Mobile Cursor)
router.get('/search/feed', validator(searchFeedSchema), searchPublicMonasteriesFeed);

// ==========================================
// Authenticated Space Endpoints (Requires Login)
// ==========================================
router.use(authMiddleware);

// Space Roles Catalog (Global)
router.get('/roles', getSpaceRoles);
router.get('/roles/:id', validator(spaceIdParamSchema), getSpaceRoleById);

// Create Monastery Space
router.post('/', checkPermission('Monastery.Create'), validator(createSpaceSchema), createSpace);

// Get My Monasteries
router.get('/mine', validator(catalogPaginationSchema), getMyMonasteries);

// Get My Monasteries Feed (Mobile Cursor)
router.get('/mine/feed', validator(cursorFeedSchema), getMyMonasteriesFeed);

// Get Monastery Space Details
router.get(
  '/:id',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.View'),
  getSpaceById
);

// Update Monastery Space
router.patch(
  '/:id',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Update'),
  validator(updateSpaceSchema),
  updateSpace
);

// Delete Monastery Space
router.delete(
  '/:id',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Delete'),
  deleteSpace
);

// Invite Member to Space
router.post(
  '/:id/invitations',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.InviteMember'),
  validator(inviteMemberSchema),
  inviteMember
);

// Respond to Space Invitation
router.post(
  '/invitations/:invitationId/respond',
  checkPermission('Invitation.Respond'),
  validator(respondInvitationSchema),
  respondToInvitation
);

// List Space Members
router.get(
  '/:id/members',
  validator(membersPaginationSchema),
  requireSpacePermission('Space.ViewMembers'),
  getSpaceMembers
);

// Update Space Member Role
router.put(
  '/:id/members/:memberUserId/role',
  requireSpacePermission('Space.UpdateMemberRole'),
  validator(updateMemberRoleSchema),
  updateMemberRole
);

// Remove Member from Space
router.delete(
  '/:id/members/:memberUserId',
  requireSpacePermission('Space.RemoveMember'),
  validator(removeMemberSchema),
  removeSpaceMember
);

// Get Current User's Space Permissions
router.get('/:id/permissions', validator(spaceIdParamSchema), getSpacePermissions);

// Get Available Monastery Space Roles
router.get('/:id/roles', validator(spaceIdParamSchema), getSpaceRoles);

// Space Donations sub-router
router.use('/:spaceId/donations', createSpaceDonationRouter());

export { router as spaceRouter };
export default router;

import { Router } from 'express';
import { authMiddleware } from '@/middlewares/authMiddleWare';
import { checkPermission, requireSpacePermission } from '@/middlewares/permissionMiddleware';
import { validator } from '@/middlewares/validator';
import { createSpaceDonationRouter } from '@/modules/donation/donation.routes';
import {
  createSpace,
  deleteSpace,
  getSpaceById,
  getSpaceMembers,
  getSpaceRoleById,
  getSpaceRoles,
  getSpaces,
  inviteMember,
  removeSpaceMember,
  respondToInvitation,
  updateMemberRole,
  updateSpace,
} from './space.controller';
import {
  createSpaceSchema,
  inviteMemberSchema,
  removeMemberSchema,
  respondInvitationSchema,
  spaceIdParamSchema,
  spacePaginationSchema,
  updateMemberRoleSchema,
  updateSpaceSchema,
} from './space.schema';

export const spaceRouter = Router();

// All space/monastery endpoints require authentication
spaceRouter.use(authMiddleware);
spaceRouter.use('/:spaceId/donations', createSpaceDonationRouter());

// Space Roles catalog (e.g. Space Admin, Space Moderator, Space Editor, Space Member)
spaceRouter.get('/roles', getSpaceRoles);
spaceRouter.get('/roles/:id', validator(spaceIdParamSchema), getSpaceRoleById);

// 1. Space / Monastery CRUD
spaceRouter.post(
  '/',
  checkPermission('Monastery.Create'),
  validator(createSpaceSchema),
  createSpace
);
spaceRouter.get('/', validator(spacePaginationSchema), getSpaces);
spaceRouter.get('/:id', validator(spaceIdParamSchema), getSpaceById);
spaceRouter.put(
  '/:id',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Update'),
  validator(updateSpaceSchema),
  updateSpace
);
spaceRouter.delete(
  '/:id',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Delete'),
  deleteSpace
);

// 2. Member Invitations
spaceRouter.post(
  '/:id/invitations',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Member.Invite'),
  validator(inviteMemberSchema),
  inviteMember
);
spaceRouter.post(
  '/invitations/:invitationId/respond',
  validator(respondInvitationSchema),
  respondToInvitation
);

// 3. Member Management
spaceRouter.get(
  '/:id/members',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.View'),
  getSpaceMembers
);
spaceRouter.put(
  '/:id/members/:userId',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Role.Manage'),
  validator(updateMemberRoleSchema),
  updateMemberRole
);
spaceRouter.delete(
  '/:id/members/:userId',
  validator(spaceIdParamSchema),
  requireSpacePermission('Space.Member.Remove'),
  validator(removeMemberSchema),
  removeSpaceMember
);

export default spaceRouter;

export const SPACE_ROLES = {
  SPACE_ADMIN: 1,
  SPACE_MODERATOR: 2,
  SPACE_EDITOR: 3,
  SPACE_MEMBER: 4,
} as const;

export type SpaceRoleId = (typeof SPACE_ROLES)[keyof typeof SPACE_ROLES];

export const SPACE_ROLE_NAMES: Record<SpaceRoleId, string> = {
  [SPACE_ROLES.SPACE_ADMIN]: 'Space Admin',
  [SPACE_ROLES.SPACE_MODERATOR]: 'Space Moderator',
  [SPACE_ROLES.SPACE_EDITOR]: 'Space Editor',
  [SPACE_ROLES.SPACE_MEMBER]: 'Space Member',
};

export const SPACE_PERMISSIONS = [
  'Space.View',
  'Space.ViewMembers',
  'Space.Update',
  'Space.Delete',
  'Space.Member.Invite',
  'Space.InviteMember',
  'Space.Member.Manage',
  'Space.Member.Remove',
  'Space.RemoveMember',
  'Space.Role.Manage',
  'Space.UpdateMemberRole',
  'Space.Post.Create',
  'Space.Donation.Create',
  'Space.Donation.Review',
  'Space.Donation.Schedule',
  'Donation.View',
  'Donation.Create',
  'Donation.Review',
  'Donation.Schedule',
  'Donation.Cancel',
  'Donation.Delete',
] as const;

export type SpacePermission = (typeof SPACE_PERMISSIONS)[number];

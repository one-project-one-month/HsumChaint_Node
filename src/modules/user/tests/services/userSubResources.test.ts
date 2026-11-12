import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { prisma } from '@/lib/prisma';
import {
  clearAllUserNotificationsService,
  deleteMonkProfileService,
  getMonkProfileService,
  getUserNotificationsCursorFeedService,
  getUserNotificationsOffsetService,
  getUserReceivedInvitationsFeedService,
  getUserReceivedInvitationsService,
  getUserSentInvitationsFeedService,
  getUserSentInvitationsService,
  getUserSettingsService,
  mapUserDto,
  updateMonkProfileService,
  updateUserService,
  updateUserSettingsService,
} from '../../user.service';

mock.module('@/lib/redis', () => ({
  redis: {
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve('OK')),
    del: mock(() => Promise.resolve(1)),
    scan: mock(() => Promise.resolve(['0', []])),
  },
}));

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(() => Promise.resolve(null)),
      findUnique: mock(() => Promise.resolve(null)),
      update: mock(() => Promise.resolve(null)),
    },
    monkProfile: {
      findUnique: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve(null)),
      delete: mock(() => Promise.resolve(null)),
    },
    invitation: {
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
    },
    notification: {
      findMany: mock(() => Promise.resolve([])),
      count: mock(() => Promise.resolve(0)),
      updateMany: mock(() => Promise.resolve({ count: 0 })),
    },
    userSetting: {
      findUnique: mock(() => Promise.resolve(null)),
      upsert: mock(() => Promise.resolve(null)),
    },
    $transaction: mock(async (promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

describe('User Sub-Resources & Aligned Services Unit Tests', () => {
  beforeEach(() => {
    mock.restore();
  });

  describe('mapUserDto', () => {
    it('should map user fields to exact .NET contracts', () => {
      const user = {
        id: 2,
        name: 'U Thuzana',
        phone: '09100000002',
        roleId: 2, // Monk in .NET C# spec
        email: 'thuzana@monastery.org',
        contactPhone: '09100000002',
      };

      const mapped = mapUserDto(user);
      expect(mapped.id).toBe(2);
      expect(mapped.name).toBe('U Thuzana');
      expect(mapped.phoneNumber).toBe('09100000002');
      expect(mapped.phone).toBe('09100000002');
      expect(mapped.roleId).toBe(2);
      expect(mapped.roleName).toBe('Monk');
      expect(mapped.contactPhoneNumber).toBe('09100000002');
      expect(mapped.email).toBe('thuzana@monastery.org');
    });

    it('should map Donor role correctly', () => {
      const mapped = mapUserDto({
        id: 3,
        name: 'Daw Hla',
        phone: '09200000001',
        roleId: 3, // Donor in .NET C# spec
      });
      expect(mapped.roleName).toBe('Donor');
    });

    it('should map Admin role correctly', () => {
      const mapped = mapUserDto({
        id: 1,
        name: 'Admin User',
        phone: '09300000001',
        roleId: 1, // Admin in .NET C# spec
      });
      expect(mapped.roleName).toBe('Admin');
    });
  });

  describe('updateUserService role security', () => {
    it('should reject role change if caller is not an Admin (roleId 1)', async () => {
      prisma.user.findUnique = mock(() =>
        Promise.resolve({
          id: 2,
          roleId: 2,
          name: 'Monk User',
          phone: '09100000002',
          isDeleted: false,
        })
      ) as unknown as typeof prisma.user.findUnique;

      // Caller has roleId 2 (Monk) trying to change own roleId to 1
      expect(updateUserService(2, { roleId: 1 }, 2)).rejects.toThrow(
        'Changing user role requires administrative privileges'
      );
    });
  });

  describe('Monk Profile Services', () => {
    it('should retrieve monk profile for monk user', async () => {
      prisma.user.findFirst = mock(() =>
        Promise.resolve({
          id: 2,
          roleId: 2,
          isDeleted: false,
          monkProfile: {
            id: 1,
            userId: 2,
            monasteryName: 'Mahagandhayon Monastery',
            monasteryAddress: 'Amarapura, Mandalay',
          },
        })
      ) as unknown as typeof prisma.user.findFirst;

      const profile = await getMonkProfileService(2);
      expect(profile.userId).toBe(2);
      expect(profile.monasteryName).toBe('Mahagandhayon Monastery');
      expect(profile.monasteryAddress).toBe('Amarapura, Mandalay');
    });

    it('should reject monk profile query if user is not a monk', async () => {
      prisma.user.findFirst = mock(() =>
        Promise.resolve({
          id: 3,
          roleId: 3, // Donor
          isDeleted: false,
          monkProfile: null,
        })
      ) as unknown as typeof prisma.user.findFirst;

      expect(getMonkProfileService(3)).rejects.toThrow(
        'User is not a monk or monk profile does not exist'
      );
    });

    it('should upsert monk profile', async () => {
      prisma.user.findFirst = mock(() =>
        Promise.resolve({
          id: 2,
          roleId: 2,
          isDeleted: false,
        })
      ) as unknown as typeof prisma.user.findFirst;

      prisma.monkProfile.upsert = mock(() =>
        Promise.resolve({
          id: 1,
          userId: 2,
          monasteryName: 'Updated Monastery',
          monasteryAddress: 'Updated Address',
        })
      ) as unknown as typeof prisma.monkProfile.upsert;

      const result = await updateMonkProfileService(2, {
        monasteryName: 'Updated Monastery',
        monasteryAddress: 'Updated Address',
      });

      expect(result.monasteryName).toBe('Updated Monastery');
      expect(result.monasteryAddress).toBe('Updated Address');
    });

    it('should delete monk profile', async () => {
      prisma.user.findFirst = mock(() =>
        Promise.resolve({
          id: 2,
          roleId: 2,
          isDeleted: false,
        })
      ) as unknown as typeof prisma.user.findFirst;

      prisma.monkProfile.findUnique = mock(() =>
        Promise.resolve({
          id: 1,
          userId: 2,
          monasteryName: 'M',
          monasteryAddress: 'A',
        })
      ) as unknown as typeof prisma.monkProfile.findUnique;

      prisma.monkProfile.delete = mock(() =>
        Promise.resolve({ id: 1, userId: 2 })
      ) as unknown as typeof prisma.monkProfile.delete;

      const result = await deleteMonkProfileService(2);
      expect(result).toBeNull();
    });
  });

  describe('Invitations Services', () => {
    it('should return offset paginated received invitations', async () => {
      const mockInvitations = [
        {
          id: 10,
          monasterySpaceId: 1,
          invitedUserId: 2,
          invitedById: 1,
          spaceRoleId: 3,
          status: 0,
          createdAt: new Date('2026-11-01T08:00:00Z'),
          monasterySpace: { id: 1, monasteryName: 'Mahagandhayon Monastery' },
          invitedUser: { id: 2, name: 'Daw Mya' },
          invitedBy: { id: 1, name: 'U Thuzana' },
          spaceRole: { id: 3, name: 'Editor' },
        },
      ];

      prisma.invitation.findMany = mock(() =>
        Promise.resolve(mockInvitations)
      ) as unknown as typeof prisma.invitation.findMany;
      prisma.invitation.count = mock(() =>
        Promise.resolve(1)
      ) as unknown as typeof prisma.invitation.count;

      const result = await getUserReceivedInvitationsService(2, { pageNumber: 1, pageSize: 10 });

      expect(result.items.length).toBe(1);
      expect(result.items[0].monasterySpaceName).toBe('Mahagandhayon Monastery');
      expect(result.items[0].spaceRoleName).toBe('Editor');
      expect(result.pagination.totalCount).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should return mobile cursor keyset feed for received invitations', async () => {
      const mockInvitations = [
        {
          id: 25,
          monasterySpaceId: 1,
          invitedUserId: 2,
          invitedById: 1,
          spaceRoleId: 3,
          status: 0,
          createdAt: new Date(),
          monasterySpace: { id: 1, monasteryName: 'Space 1' },
          invitedUser: { id: 2, name: 'User 2' },
          invitedBy: { id: 1, name: 'User 1' },
          spaceRole: { id: 3, name: 'Member' },
        },
      ];

      prisma.invitation.findMany = mock(() =>
        Promise.resolve(mockInvitations)
      ) as unknown as typeof prisma.invitation.findMany;

      const result = await getUserReceivedInvitationsFeedService(2, { pageSize: 15 });

      expect(result.items.length).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.pageSize).toBe(15);
    });

    it('should return offset paginated sent invitations', async () => {
      const mockInvitations = [
        {
          id: 11,
          monasterySpaceId: 1,
          invitedUserId: 3,
          invitedById: 2,
          spaceRoleId: 4,
          status: 0,
          createdAt: new Date(),
          monasterySpace: { id: 1, monasteryName: 'Space 1' },
          invitedUser: { id: 3, name: 'User 3' },
          invitedBy: { id: 2, name: 'User 2' },
          spaceRole: { id: 4, name: 'Viewer' },
        },
      ];

      prisma.invitation.findMany = mock(() =>
        Promise.resolve(mockInvitations)
      ) as unknown as typeof prisma.invitation.findMany;
      prisma.invitation.count = mock(() =>
        Promise.resolve(1)
      ) as unknown as typeof prisma.invitation.count;

      const result = await getUserSentInvitationsService(2, { pageNumber: 1, pageSize: 10 });
      expect(result.items.length).toBe(1);
      expect(result.items[0].invitedUserName).toBe('User 3');
      expect(result.pagination.totalCount).toBe(1);
    });

    it('should return mobile cursor keyset feed for sent invitations', async () => {
      const mockInvitations = [
        {
          id: 11,
          monasterySpaceId: 1,
          invitedUserId: 3,
          invitedById: 2,
          spaceRoleId: 4,
          status: 0,
          createdAt: new Date(),
          monasterySpace: { id: 1, monasteryName: 'Space 1' },
          invitedUser: { id: 3, name: 'User 3' },
          invitedBy: { id: 2, name: 'User 2' },
          spaceRole: { id: 4, name: 'Viewer' },
        },
      ];

      prisma.invitation.findMany = mock(() =>
        Promise.resolve(mockInvitations)
      ) as unknown as typeof prisma.invitation.findMany;

      const result = await getUserSentInvitationsFeedService(2, { pageSize: 15 });
      expect(result.items.length).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('Notifications Services', () => {
    it('should return offset paginated notifications', async () => {
      const mockNotifs = [
        {
          id: 101,
          userId: 2,
          type: 1,
          message: 'Donation accepted',
          isRead: false,
          createdAt: new Date(),
        },
      ];

      prisma.notification.findMany = mock(() =>
        Promise.resolve(mockNotifs)
      ) as unknown as typeof prisma.notification.findMany;
      prisma.notification.count = mock(() =>
        Promise.resolve(1)
      ) as unknown as typeof prisma.notification.count;

      const result = await getUserNotificationsOffsetService(2, { pageNumber: 1, pageSize: 10 });
      expect(result.items.length).toBe(1);
      expect(result.items[0].message).toBe('Donation accepted');
      expect(result.pagination.totalCount).toBe(1);
    });

    it('should return mobile cursor keyset feed for notifications', async () => {
      const mockNotifs = [
        {
          id: 102,
          userId: 2,
          type: 1,
          message: 'Item 1',
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: 101,
          userId: 2,
          type: 1,
          message: 'Item 2',
          isRead: false,
          createdAt: new Date(),
        },
      ];

      // If pageSize is 1 and query returns 2 items, hasNextPage must be true
      prisma.notification.findMany = mock(() =>
        Promise.resolve(mockNotifs)
      ) as unknown as typeof prisma.notification.findMany;

      const result = await getUserNotificationsCursorFeedService(2, { pageSize: 1 });
      expect(result.items.length).toBe(1);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.nextCursor).toBe(102);
    });

    it('should clear all notifications for user', async () => {
      prisma.notification.updateMany = mock(() =>
        Promise.resolve({ count: 5 })
      ) as unknown as typeof prisma.notification.updateMany;

      const result = await clearAllUserNotificationsService(2);
      expect(result).toBeNull();
    });
  });

  describe('Settings Services', () => {
    it('should retrieve user reminder settings with defaults if none exist', async () => {
      prisma.user.findFirst = mock(() =>
        Promise.resolve({ id: 2, isDeleted: false })
      ) as unknown as typeof prisma.user.findFirst;

      prisma.userSetting.findUnique = mock(() =>
        Promise.resolve(null)
      ) as unknown as typeof prisma.userSetting.findUnique;

      const settings = await getUserSettingsService(2);
      expect(settings.userId).toBe(2);
      expect(settings.pickupNotificationTime).toBeDefined();
      expect(settings.dropoffNotificationTime).toBeDefined();
    });

    it('should update reminder settings', async () => {
      prisma.user.findFirst = mock(() =>
        Promise.resolve({ id: 2, isDeleted: false })
      ) as unknown as typeof prisma.user.findFirst;

      const newDate = new Date('2026-11-01T14:00:00Z');
      prisma.userSetting.upsert = mock(() =>
        Promise.resolve({
          id: 1,
          userId: 2,
          pickupNotificationTime: newDate,
          dropoffNotificationTime: newDate,
          pickupTime: null,
          dropoffTime: null,
        })
      ) as unknown as typeof prisma.userSetting.upsert;

      const result = await updateUserSettingsService(2, {
        pickupNotificationTime: '2026-11-01T14:00:00Z',
      });
      expect(result.userId).toBe(2);
      expect(result.pickupNotificationTime).toEqual(newDate);
    });
  });
});

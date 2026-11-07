import { beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { Notification, User } from 'prisma-client';
import request from 'supertest';
import { app } from '@/app';
import { generateAccessToken, type TokenPayload } from '@/utils/jwt';

const FAKE_USER_ID = 101;
const OTHER_USER_ID = 202;

const FAKE_USER = {
  id: FAKE_USER_ID,
  name: 'test_user',
  email: 'test@example.com',
  fcmToken: 'mock-fcm-token',
  isDeleted: false,
};

const FAKE_NOTIFICATION = {
  id: 1,
  userId: FAKE_USER_ID,
  type: 2,
  message: 'Test notification message',
  isRead: false,
  isDeleted: false,
  createdAt: new Date('2026-11-05T12:00:00Z'),
};

const sendPushMock = mock(async () => {});
mock.module('@/lib/firebase', () => ({
  sendPush: sendPushMock,
}));

mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mock(() => Promise.resolve(FAKE_USER)),
    },
    notification: {
      create: mock(() => Promise.resolve(FAKE_NOTIFICATION)),
      findFirst: mock(() => Promise.resolve(FAKE_NOTIFICATION)),
      findMany: mock(() => Promise.resolve([FAKE_NOTIFICATION])),
      count: mock(() => Promise.resolve(1)),
      update: mock(() => Promise.resolve({ ...FAKE_NOTIFICATION, isRead: true })),
    },
    $transaction: mock((promises: Promise<unknown>[]) => Promise.all(promises)),
  },
}));

import { prisma } from '@/lib/prisma';

const userFindFirstMock = spyOn(prisma.user, 'findFirst');
const notificationCreateMock = spyOn(prisma.notification, 'create');
const notificationFindFirstMock = spyOn(prisma.notification, 'findFirst');
const notificationFindManyMock = spyOn(prisma.notification, 'findMany');
const notificationCountMock = spyOn(prisma.notification, 'count');
const notificationUpdateMock = spyOn(prisma.notification, 'update');

describe('Notification Module Endpoints', () => {
  let accessToken: string;

  beforeAll(() => {
    const payload: TokenPayload = { userId: FAKE_USER_ID, roleId: 1 };
    accessToken = `Bearer ${generateAccessToken(payload)}`;
  });

  beforeEach(() => {
    userFindFirstMock.mockClear();
    notificationCreateMock.mockClear();
    notificationFindFirstMock.mockClear();
    notificationFindManyMock.mockClear();
    notificationCountMock.mockClear();
    notificationUpdateMock.mockClear();
    sendPushMock.mockClear();
  });

  describe('POST /api/v1/notifications/create', () => {
    it('should create notification for current user by default and send push if token exists', async () => {
      userFindFirstMock.mockResolvedValue(FAKE_USER as unknown as User);
      notificationCreateMock.mockResolvedValue(FAKE_NOTIFICATION as unknown as Notification);

      const response = await request(app)
        .post('/api/v1/notifications/create')
        .set('Authorization', accessToken)
        .send({
          message: 'Donation reminder message',
          type: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.isFailure).toBe(false);
      expect(response.body.message).toBe('Notification created successfully.');
      expect(response.body.data.id).toBe(FAKE_NOTIFICATION.id);
      expect(notificationCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: FAKE_USER_ID,
            type: 2,
            message: 'Donation reminder message',
          }),
        })
      );
      expect(sendPushMock).toHaveBeenCalled();
    });

    it('should create notification for another target userId when specified', async () => {
      userFindFirstMock.mockResolvedValue({
        ...FAKE_USER,
        id: OTHER_USER_ID,
      } as unknown as User);
      notificationCreateMock.mockResolvedValue({
        ...FAKE_NOTIFICATION,
        id: 2,
        userId: OTHER_USER_ID,
      } as unknown as Notification);

      const response = await request(app)
        .post('/api/v1/notifications/create')
        .set('Authorization', accessToken)
        .send({
          userId: OTHER_USER_ID,
          message: 'Message for other user',
        });

      expect(response.status).toBe(201);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.isFailure).toBe(false);
      expect(notificationCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: OTHER_USER_ID,
            message: 'Message for other user',
          }),
        })
      );
    });

    it('should return 400 when message is empty or missing', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/create')
        .set('Authorization', accessToken)
        .send({
          message: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.isSuccess).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should return 401 when no token is provided', async () => {
      const response = await request(app).post('/api/v1/notifications/create').send({
        message: 'No auth',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/notifications', () => {
    it('should retrieve notifications list with pagination and unreadCount in new format', async () => {
      notificationFindManyMock.mockResolvedValue([FAKE_NOTIFICATION] as unknown as Notification[]);
      notificationCountMock.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/v1/notifications?page=1&limit=10')
        .set('Authorization', accessToken);

      expect(response.status).toBe(200);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.isFailure).toBe(false);
      expect(response.body.message).toBe('Notifications retrieved successfully.');
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.unreadCount).toBe(1);
      expect(response.body.pagination).toMatchObject({
        pageNumber: 1,
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });

    it('should return 401 when unauthenticated', async () => {
      const response = await request(app).get('/api/v1/notifications');
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/notifications/read-noti', () => {
    it('should mark notification as read with body { notificationId, userId }', async () => {
      notificationFindFirstMock.mockResolvedValue(FAKE_NOTIFICATION as unknown as Notification);
      notificationUpdateMock.mockResolvedValue({
        ...FAKE_NOTIFICATION,
        isRead: true,
      } as unknown as Notification);

      const response = await request(app)
        .patch('/api/v1/notifications/read-noti')
        .set('Authorization', accessToken)
        .send({
          notificationId: FAKE_NOTIFICATION.id,
          userId: FAKE_USER_ID,
        });

      expect(response.status).toBe(200);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.isFailure).toBe(false);
      expect(response.body.message).toBe('Notification marked as read.');
      expect(notificationUpdateMock).toHaveBeenCalledWith({
        where: { id: FAKE_NOTIFICATION.id },
        data: { isRead: true },
      });
    });

    it('should mark notification as read with only notificationId in body', async () => {
      notificationFindFirstMock.mockResolvedValue(FAKE_NOTIFICATION as unknown as Notification);
      notificationUpdateMock.mockResolvedValue({
        ...FAKE_NOTIFICATION,
        isRead: true,
      } as unknown as Notification);

      const response = await request(app)
        .patch('/api/v1/notifications/read-noti')
        .set('Authorization', accessToken)
        .send({ notificationId: FAKE_NOTIFICATION.id });

      expect(response.status).toBe(200);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.message).toBe('Notification marked as read.');
    });

    it('should return 404 when notification does not exist or belongs to another user', async () => {
      notificationFindFirstMock.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/v1/notifications/read-noti')
        .set('Authorization', accessToken)
        .send({ notificationId: 999, userId: FAKE_USER_ID });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Notification not found');
    });

    it('should return 400 when notificationId is missing or invalid', async () => {
      const response = await request(app)
        .patch('/api/v1/notifications/read-noti')
        .set('Authorization', accessToken)
        .send({ notificationId: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/notifications/delete', () => {
    it('should soft delete notification with body { notificationId, userId }', async () => {
      notificationFindFirstMock.mockResolvedValue(FAKE_NOTIFICATION as unknown as Notification);
      notificationUpdateMock.mockResolvedValue({
        ...FAKE_NOTIFICATION,
        isDeleted: true,
      } as unknown as Notification);

      const response = await request(app)
        .delete('/api/v1/notifications/delete')
        .set('Authorization', accessToken)
        .send({
          notificationId: 12,
          userId: 3,
        });

      expect(response.status).toBe(200);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.isFailure).toBe(false);
      expect(response.body.message).toBe('Notification deleted successfully.');
      expect(notificationUpdateMock).toHaveBeenCalledWith({
        where: { id: 12 },
        data: { isDeleted: true },
      });
    });

    it('should soft delete notification via route param DELETE /:id', async () => {
      notificationFindFirstMock.mockResolvedValue(FAKE_NOTIFICATION as unknown as Notification);
      notificationUpdateMock.mockResolvedValue({
        ...FAKE_NOTIFICATION,
        isDeleted: true,
      } as unknown as Notification);

      const response = await request(app)
        .delete(`/api/v1/notifications/${FAKE_NOTIFICATION.id}`)
        .set('Authorization', accessToken);

      expect(response.status).toBe(200);
      expect(response.body.isSuccess).toBe(true);
      expect(response.body.message).toBe('Notification deleted successfully.');
    });

    it('should return 404 when notification to delete does not exist', async () => {
      notificationFindFirstMock.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/v1/notifications/delete')
        .set('Authorization', accessToken)
        .send({ notificationId: 999, userId: FAKE_USER_ID });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Notification not found');
    });

    it('should return 400 when notificationId is missing on delete', async () => {
      const response = await request(app)
        .delete('/api/v1/notifications/delete')
        .set('Authorization', accessToken)
        .send({});

      expect(response.status).toBe(400);
    });
  });
});

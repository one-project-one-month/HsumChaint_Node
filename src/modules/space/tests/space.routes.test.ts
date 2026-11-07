import { describe, expect, it, mock } from 'bun:test';
import request from 'supertest';
import { app } from '@/app';

const mockMonastery = {
  id: 1,
  monasteryName: 'Kyauk Gu Monastery',
  description: 'Historical cave monastery',
  address: 'Bagan, Mandalay Region',
  createdById: 10,
  isDeleted: false,
  createdBy: { name: 'Ashin Pannita' },
  _count: { members: 6 },
};

mock.module('@/lib/prisma', () => ({
  prisma: {
    monasterySpace: {
      findMany: mock(async () => [mockMonastery]),
      count: mock(async () => 1),
      findFirst: mock(async () => mockMonastery),
    },
    monasteryMember: {
      findMany: mock(async () => []),
      count: mock(async () => 0),
      findFirst: mock(async () => null),
    },
    spaceRole: {
      findMany: mock(async () => []),
      findFirst: mock(async () => null),
    },
    user: {
      findFirst: mock(async () => null),
    },
  },
}));

describe('Monastery Space Routes HTTP Integration Tests', () => {
  it('GET /api/v1/monasteries should allow anonymous public catalog listing with generic envelope', async () => {
    const res = await request(app).get('/api/v1/monasteries');

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].monasteryName).toBe('Kyauk Gu Monastery');
    expect(res.body.data[0].createdByName).toBe('Ashin Pannita');
    expect(res.body.data[0].membersCount).toBe(6);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.pageNumber).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
    expect(res.body.pagination.totalCount).toBe(1);
    expect(res.body.pagination.totalPages).toBe(1);
    expect(res.body.pagination.hasPreviousPage).toBe(false);
    expect(res.body.pagination.hasNextPage).toBe(false);
  });

  it('GET /api/v1/monasteries/feed should allow anonymous cursor-based feed', async () => {
    const res = await request(app).get('/api/v1/monasteries/feed?pageSize=15');

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(res.body.message).toBe('Monasteries feed retrieved successfully.');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.hasNextPage).toBe(false);
    expect(res.body.pagination.pageSize).toBe(15);
  });

  it('GET /api/v1/monasteries/search should allow anonymous search with offset pagination', async () => {
    const res = await request(app).get('/api/v1/monasteries/search?keyword=Kyauk');

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.pageNumber).toBe(1);
  });

  it('GET /api/v1/monasteries/search/feed should allow anonymous search feed', async () => {
    const res = await request(app).get('/api/v1/monasteries/search/feed?keyword=Kyauk&pageSize=15');

    expect(res.status).toBe(200);
    expect(res.body.isSuccess).toBe(true);
    expect(res.body.isFailure).toBe(false);
    expect(res.body.message).toBe('Monasteries feed retrieved successfully.');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.pageSize).toBe(15);
  });

  it('protected routes should return 401 when called anonymously', async () => {
    const resCreate = await request(app).post('/api/v1/monasteries').send({
      monasteryName: 'Test',
    });
    expect(resCreate.status).toBe(401);

    const resMine = await request(app).get('/api/v1/monasteries/mine');
    expect(resMine.status).toBe(401);

    const resMineFeed = await request(app).get('/api/v1/monasteries/mine/feed');
    expect(resMineFeed.status).toBe(401);

    const resGetById = await request(app).get('/api/v1/monasteries/1');
    expect(resGetById.status).toBe(401);

    const resUpdate = await request(app).put('/api/v1/monasteries/1').send({
      monasteryName: 'Updated',
    });
    expect(resUpdate.status).toBe(401);

    const resPatch = await request(app).patch('/api/v1/monasteries/1').send({
      monasteryName: 'Updated',
    });
    expect(resPatch.status).toBe(401);

    const resDelete = await request(app).delete('/api/v1/monasteries/1');
    expect(resDelete.status).toBe(401);

    const resPerms = await request(app).get('/api/v1/monasteries/1/permissions');
    expect(resPerms.status).toBe(401);

    const resRoles = await request(app).get('/api/v1/monasteries/1/roles');
    expect(resRoles.status).toBe(401);

    const resMembers = await request(app).get('/api/v1/monasteries/1/members');
    expect(resMembers.status).toBe(401);

    const resInvite = await request(app).post('/api/v1/monasteries/1/invitations').send({
      phoneNumber: '09100000003',
      spaceRoleId: 3,
    });
    expect(resInvite.status).toBe(401);

    const resRespond = await request(app).post('/api/v1/monasteries/invitations/1/respond').send({
      status: 2,
    });
    expect(resRespond.status).toBe(401);

    const resUpdateRole = await request(app)
      .put('/api/v1/monasteries/1/members/2/role')
      .send({ spaceRoleId: 2 });
    expect(resUpdateRole.status).toBe(401);

    const resRemoveMember = await request(app).delete('/api/v1/monasteries/1/members/2');
    expect(resRemoveMember.status).toBe(401);
  });
});

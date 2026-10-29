import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { globalErrorHandler } from '@/middlewares/errorHandler';
import { createDonationRouter, createSpaceDonationRouter } from '../donation.routes';
import {
  batchInput,
  DONATION_STATUS,
  DONATION_TYPE,
  donationInput,
  donationQuery,
  donationReview,
  donationSchedule,
  manualDonationInput,
  monthlyQuery,
  recurringInput,
} from '../donation.schema';
import { DONATION_NOTIFICATION_TYPE, recurringDates } from '../donation.service';
import { donationFixture } from './donation.fixture';

const input = donationInput.parse({ donationType: 'Food', quantity: 12, note: 'Rice bags' });
const recurring = recurringInput.parse({
  donationType: 'Food',
  startDate: '2026-01-15',
  dayOfMonth: 15,
  monthsCount: 6,
  pickupTimeOfDay: '06:00:00',
  amount: 50000,
});

describe('C# donation contracts', () => {
  test('matches the C# status and type numeric values', () => {
    expect(DONATION_STATUS).toEqual({
      Draft: 0,
      Submitted: 1,
      PendingReview: 2,
      Accepted: 3,
      Scheduled: 4,
      Completed: 5,
      Rejected: 6,
      Cancelled: 7,
    });
    expect(DONATION_TYPE).toEqual({
      Money: 0,
      Food: 1,
      Medicine: 2,
      Robe: 3,
      Supplies: 4,
      Other: 5,
    });
  });
  test('donors outside the monastery can submit; server supplies their identity and name', async () => {
    const f = donationFixture(false);
    const result = await f.service.request(2, 10, input);
    expect(result).toMatchObject({
      donorId: 2,
      donorName: 'User 2',
      monasterySpaceId: 10,
      status: 2,
      donationType: 1,
      quantity: '12',
    });
    expect(f.tables.notification.map((row) => row.userId)).toEqual([1, 3]);
    expect(f.tables.notification[0]).toMatchObject({
      type: DONATION_NOTIFICATION_TYPE,
      message: 'A new donation request is waiting for review.',
    });
    expect(f.push).toHaveBeenCalledTimes(2);
  });
  test('inactive users and deleted/missing spaces cannot receive requests', async () => {
    const f = donationFixture(false);
    await expect(f.service.request(6, 10, input)).rejects.toMatchObject({ statusCode: 403 });
    await expect(f.service.request(2, 12, input)).rejects.toMatchObject({ statusCode: 404 });
    await expect(f.service.request(2, 99, input)).rejects.toMatchObject({ statusCode: 404 });
    expect(f.tables.donorList).toHaveLength(0);
  });
  test('revoking global create permission blocks an unaffiliated donor', async () => {
    const f = donationFixture(false);
    f.tables.rolePermission = f.tables.rolePermission.filter((row) => row.roleId !== 2);
    await expect(f.service.request(2, 10, input)).rejects.toMatchObject({ statusCode: 403 });
  });
  test('custom review and scheduling permissions are independent and scoped', async () => {
    const f = donationFixture();
    await f.service.change(3, 100, 'review', { status: 3 });
    await expect(
      f.service.change(3, 100, 'schedule', { pickupTime: '2026-12-01T06:00:00Z' })
    ).rejects.toMatchObject({ statusCode: 403 });
    f.grant(20, 'Donation.Schedule');
    expect(
      await f.service.change(3, 100, 'schedule', { pickupTime: '2026-12-01T06:00:00Z' })
    ).toMatchObject({ status: 4 });
    f.donation({ id: 101, monasterySpaceId: 11 });
    await expect(f.service.change(3, 101, 'review', { status: 3 })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
  test('deleted permissions stop custom reviewers while ownership still grants access', async () => {
    const f = donationFixture();
    for (const permission of f.tables.rolePermission)
      if (permission.roleId === 20)
        (permission.permission as Record<string, unknown>).isDeleted = true;
    await expect(f.service.change(3, 100, 'review', { status: 3 })).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(await f.service.change(1, 100, 'review', { status: 3 })).toMatchObject({ status: 3 });
  });
  test('manual account donations record reviewer and begin Accepted or Scheduled', async () => {
    const f = donationFixture(false);
    const result = await f.service.manual(1, 10, { donationType: 0, donorId: 2, amount: '50000' });
    expect(result).toMatchObject({
      donorId: 2,
      donorName: 'User 2',
      donationType: 0,
      status: 3,
      reviewerId: 1,
      reviewedAt: expect.any(Date),
    });
    const scheduled = await f.service.manual(1, 10, {
      donationType: 1,
      donorId: 2,
      pickupTime: '2026-12-01T00:00:00Z',
    });
    expect(scheduled.status).toBe(4);
    expect(f.push).toHaveBeenCalledTimes(2);
  });
  test('offline manual donors have null account IDs and get no account notifications', async () => {
    const f = donationFixture(false);
    const result = await f.service.manual(1, 10, {
      donationType: 0,
      donorName: 'Cash donor',
      amount: '9999999999999999.99',
    });
    expect(result).toMatchObject({
      donorId: null,
      donorName: 'Cash donor',
      amount: '9999999999999999.99',
      status: 3,
    });
    expect(f.tables.notification).toHaveLength(0);
    expect(f.push).not.toHaveBeenCalled();
  });
  test('manual donations reject viewers, nonmembers, absent accounts and unnamed donors', async () => {
    const f = donationFixture(false);
    await expect(
      f.service.manual(7, 10, { ...input, donorName: 'Cash donor' })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      f.service.manual(5, 10, { ...input, donorName: 'Cash donor' })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(f.service.manual(1, 10, { ...input, donorId: 99 })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(f.service.manual(1, 10, input)).rejects.toMatchObject({ statusCode: 400 });
    expect(f.tables.donorList).toHaveLength(0);
  });
  for (const status of [3, 6])
    test(`review sets numeric status ${status}, note and reviewer, and notifies the donor`, async () => {
      const f = donationFixture();
      const result = await f.service.change(3, 100, 'review', {
        status,
        note: 'Reviewed by monastery',
      });
      expect(result).toMatchObject({
        status,
        reviewerId: 3,
        reviewedAt: expect.any(Date),
        note: 'Reviewed by monastery',
      });
      expect(f.tables.notification[0]).toMatchObject({
        userId: 2,
        message: status === 3 ? 'Your donation was accepted.' : 'Your donation was rejected.',
      });
      expect(f.push.mock.calls[0]).toEqual([
        'token-2',
        expect.any(String),
        { donationId: '100', type: 'Donation' },
      ]);
    });
  test('review can reconsider rejection and retains a previous note when supplied note is blank', async () => {
    const f = donationFixture();
    await f.service.change(1, 100, 'review', { status: 6, note: 'Keep this note' });
    const result = await f.service.change(1, 100, 'review', { status: 3, note: ' ' });
    expect(result).toMatchObject({ status: 3, note: 'Keep this note' });
  });
  test('scheduler can schedule and complete without review permission', async () => {
    const f = donationFixture();
    await f.service.change(4, 100, 'schedule', { pickupTime: '2026-12-01T06:00:00Z' });
    const result = await f.service.change(4, 100, 'complete');
    expect(result).toMatchObject({ status: 5, completedAt: expect.any(Date), reviewerId: null });
  });
  test('rescheduling replaces both pickup and dropoff including clearing an omitted time', async () => {
    const f = donationFixture();
    await f.service.change(4, 100, 'schedule', {
      pickupTime: '2026-12-01T06:00:00Z',
      dropoffTime: '2026-12-02T06:00:00Z',
    });
    const result = await f.service.change(4, 100, 'schedule', {
      dropoffTime: '2026-12-03T06:00:00Z',
    });
    expect(result).toMatchObject({
      status: 4,
      pickupTime: null,
      dropoffTime: new Date('2026-12-03T06:00:00Z'),
    });
  });
  test('donors can cancel their own donations without membership, but cannot cancel another donor', async () => {
    const f = donationFixture();
    await expect(f.service.change(5, 100, 'cancel')).rejects.toMatchObject({ statusCode: 403 });
    expect(await f.service.change(2, 100, 'cancel')).toMatchObject({ status: 7 });
  });
  for (const [current, action] of [
    [5, 'review'],
    [7, 'review'],
    [6, 'schedule'],
    [7, 'schedule'],
    [5, 'schedule'],
    [6, 'complete'],
    [7, 'complete'],
    [5, 'cancel'],
    [5, 'delete'],
  ] as const) {
    test(`blocks C# forbidden transition status=${current} action=${action}`, async () => {
      const f = donationFixture(false);
      f.donation({ statusValue: current });
      await expect(
        f.service.change(1, 100, action, { status: 3, pickupTime: '2026-12-01T00:00:00Z' })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.db.donorList.updateMany).not.toHaveBeenCalled();
      expect(f.db.donorList.deleteMany).not.toHaveBeenCalled();
    });
  }
  test('scope mismatches return 404 and competing updates return 409 without notification', async () => {
    const f = donationFixture();
    await expect(f.service.change(1, 100, 'review', { status: 3 }, 11)).rejects.toMatchObject({
      statusCode: 404,
    });
    f.db.donorList.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.change(1, 100, 'review', { status: 3 })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(f.tables.notification).toHaveLength(0);
  });
  test('donation and notification roll back together on database failure; push failure retains committed data', async () => {
    const f = donationFixture(false);
    f.db.notification.create.mockRejectedValueOnce(new Error('Notification insert failed'));
    await expect(f.service.request(2, 10, input)).rejects.toThrow('Notification insert failed');
    expect(f.tables.donorList).toHaveLength(0);
    expect(f.push).not.toHaveBeenCalled();
    f.push.mockRejectedValue(new Error('FCM unavailable'));
    const result = await f.service.request(2, 10, input);
    expect(result.status).toBe(2);
    expect(f.tables.notification).toHaveLength(2);
    expect(f.pushError).toHaveBeenCalledTimes(2);
  });
  test('deletes active donations and rejects deletion without review permission', async () => {
    const f = donationFixture();
    await expect(f.service.change(7, 100, 'delete')).rejects.toMatchObject({ statusCode: 403 });
    expect(await f.service.change(1, 100, 'delete')).toBe(true);
    expect(f.tables.donorList).toHaveLength(0);
  });
  test('batches insert all entries and roll back invalid donors or database failures', async () => {
    const f = donationFixture(false);
    const result = await f.service.batch(1, 10, [
      { ...input, donorName: 'Donor A' },
      { donationType: 0, donorId: 2, amount: '20000' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ donorId: null, donorName: 'Donor A' });
    await expect(
      f.service.batch(1, 10, [
        { ...input, donorName: 'Donor C' },
        { ...input, donorId: 99 },
      ])
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(f.tables.donorList).toHaveLength(2);
    f.db.donorList.create.mockRejectedValueOnce(new Error('Insert failed'));
    await expect(f.service.batch(1, 10, [{ ...input, donorName: 'Donor D' }])).rejects.toThrow(
      'Insert failed'
    );
    expect(f.tables.donorList).toHaveLength(2);
  });
  test('recurring requests create monthly PendingReview rows with one series tag', async () => {
    const f = donationFixture(false);
    const rows = await f.service.recurring(2, 10, recurring);
    expect(rows).toHaveLength(6);
    for (const [i, row] of rows.entries()) {
      expect(row).toMatchObject({
        donorId: 2,
        status: 2,
        pickupTime: new Date(Date.UTC(2026, i, 15, 6)),
      });
      expect(row.note).toContain(`(${i + 1}/6)`);
    }
    expect(new Set(rows.map((row) => row.note?.split(']')[0])).size).toBe(1);
    expect(f.tables.notification).toHaveLength(2);
  });
  test('manual recurring donations support offline donors and Accepted/Scheduled initial state', async () => {
    const f = donationFixture(false);
    const rows = await f.service.recurring(
      1,
      10,
      { ...recurring, donorName: 'Offline donor' },
      true
    );
    expect(
      rows.every((row) => row.donorId === null && row.status === 4 && row.reviewerId === 1)
    ).toBe(true);
    const accepted = await f.service.recurring(
      1,
      10,
      { ...recurring, donorId: 2, pickupTimeOfDay: null },
      true
    );
    expect(accepted.every((row) => row.status === 3)).toBe(true);
    expect(f.tables.notification).toHaveLength(1);
  });
  test('clamps recurring dates at February/leap years and rolls over December', () => {
    const normal = recurringDates({ ...recurring, dayOfMonth: 31, monthsCount: 3 });
    expect(normal.map((row) => row.pickupTime?.getUTCDate())).toEqual([31, 28, 31]);
    const leap = recurringDates({
      ...recurring,
      startDate: '2028-01-01',
      dayOfMonth: 31,
      monthsCount: 2,
    });
    expect(leap[1]?.pickupTime?.getUTCDate()).toBe(29);
    const rollover = recurringDates({ ...recurring, startDate: '2026-12-01', monthsCount: 2 });
    expect(rollover[1]?.pickupTime?.getUTCFullYear()).toBe(2027);
  });
});

describe('C# donation visibility and pagination', () => {
  test('unscoped list is own history; filters run before counting and ties use ascending IDs', async () => {
    const f = donationFixture(false);
    for (let i = 0; i < 12; i++) f.donation({ statusValue: 3 });
    f.donation({ donorId: 5, statusValue: 3 });
    f.donation({ statusValue: 6 });
    const result = await f.service.list(
      2,
      donationQuery.parse({
        pageNumber: 2,
        pageSize: 5,
        status: 3,
        fromDate: '2026-10-01T00:00:00Z',
        toDate: '2026-10-01T00:00:00Z',
      })
    );
    expect(result.items.map((row) => row.id)).toEqual([105, 106, 107, 108, 109]);
    expect(result.pagination).toMatchObject({
      totalCount: 12,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    await expect(f.service.list(2, donationQuery.parse({ donorId: 5 }))).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      f.service.list(2, donationQuery.parse({ monasterySpaceId: 10 }))
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  test('members see a space history and donors see own detail without membership', async () => {
    const f = donationFixture();
    expect(
      (await f.service.list(7, donationQuery.parse({ monasterySpaceId: 10 }))).items
    ).toHaveLength(1);
    expect(await f.service.get(2, 100)).toMatchObject({ id: 100 });
    expect(await f.service.get(7, 100)).toMatchObject({ id: 100 });
    await expect(f.service.get(5, 100)).rejects.toMatchObject({ statusCode: 403 });
    await expect(f.service.get(2, 100, 11)).rejects.toMatchObject({ statusCode: 404 });
  });
  test('monthly calendar matches C# UTC month, pickup/createdAt fallback, grouping and exact totals', async () => {
    const f = donationFixture(false);
    f.donation({ amount: '10000', pickupTime: new Date('2026-11-05T06:00:00Z'), statusValue: 4 });
    f.donation({ amount: '25000', pickupTime: new Date('2026-11-05T07:00:00Z'), statusValue: 3 });
    f.donation({ amount: '15000', pickupTime: new Date('2026-11-10T08:00:00Z'), statusValue: 5 });
    f.donation({ amount: '50000', pickupTime: new Date('2026-12-01T00:00:00Z') });
    const result = await f.service.monthly(
      7,
      monthlyQuery.parse({ monasterySpaceId: 10, year: 2026, month: 11 })
    );
    expect(result).toMatchObject({ totalDonationsCount: 3, totalAmount: '50000.00' });
    expect(result.days.map((day) => [day.day, day.donationsCount])).toEqual([
      [5, 2],
      [10, 1],
    ]);
    f.donation({
      donorId: null,
      donorName: 'Offline',
      amount: '0.10',
      createdAt: new Date('2026-11-30T23:30:00Z'),
      dropoffTime: new Date('2026-12-02T00:00:00Z'),
    });
    expect(
      (
        await f.service.monthly(
          7,
          monthlyQuery.parse({ monasterySpaceId: 10, year: 2026, month: 11 })
        )
      ).totalAmount
    ).toBe('50000.10');
    expect(
      (await f.service.monthly(2, monthlyQuery.parse({ year: 2026, month: 11 })))
        .totalDonationsCount
    ).toBe(3);
  });
});

describe('donation schema contracts', () => {
  test('accepts Money=0, zero amounts and both numeric and named enums', () => {
    expect(donationInput.parse({ donationType: 0, amount: 0 })).toMatchObject({
      donationType: 0,
      amount: '0',
    });
    expect(donationReview.parse({ status: 'Accepted' }).status).toBe(3);
    expect(donationQuery.parse({ status: '6' }).status).toBe(6);
  });
  for (const invalid of [
    { donationType: 'Other' },
    { donationType: 9 },
    { donationType: 1, amount: '-1' },
    { donationType: 1, amount: '1.001' },
    { donationType: 1, donorId: 99 },
    { donationType: 1, donorName: 'Impersonated' },
    { donationType: 1, status: 3 },
    { donationType: 1, pickupTime: 'bad date' },
  ]) {
    test(`rejects invalid submission ${JSON.stringify(invalid)}`, () =>
      expect(donationInput.safeParse(invalid).success).toBe(false));
  }
  test('validates manual donors, review status, schedule, recurrence, batches and pagination bounds', () => {
    expect(manualDonationInput.safeParse({ donationType: 1 }).success).toBe(false);
    expect(donationReview.safeParse({ status: 5 }).success).toBe(false);
    expect(donationSchedule.safeParse({}).success).toBe(false);
    expect(recurringInput.safeParse({ ...recurring, dayOfMonth: 32 }).success).toBe(false);
    expect(recurringInput.safeParse({ ...recurring, monthsCount: 25 }).success).toBe(false);
    expect(batchInput.safeParse({ donations: [] }).success).toBe(false);
    expect(
      batchInput.safeParse({ donations: Array(51).fill({ donationType: 1, donorName: 'A' }) })
        .success
    ).toBe(false);
    expect(donationQuery.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(monthlyQuery.safeParse({ year: 2026, month: 13 }).success).toBe(false);
  });
});

describe('C# compatible and space-scoped HTTP routes', () => {
  function httpFixture() {
    const f = donationFixture(false);
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      const userId = Number(req.headers['x-test-user']);
      if (!userId) return res.sendStatus(401);
      req.user = { userId, roleId: 2 };
      next();
    });
    app.use('/api/v1/donations', createDonationRouter(f.service));
    app.use('/api/v1/spaces/:spaceId/donations', createSpaceDonationRouter(f.service));
    app.get('/api/v1/donations/calendar', (_req, res) =>
      res.json({ existingDateRangeCalendar: true })
    );
    app.use(globalErrorHandler);
    return { ...f, app };
  }
  test('canonical submission, own history/detail, review, schedule, completion and DTOs', async () => {
    const f = httpFixture();
    expect(
      (
        await request(f.app)
          .post('/api/v1/donations/request')
          .send({ monasterySpaceId: 10, donationType: 1 })
      ).status
    ).toBe(401);
    const created = await request(f.app)
      .post('/api/v1/donations/request')
      .set('x-test-user', '2')
      .send({ monasterySpaceId: 10, donationType: 1, quantity: 12 });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 2, donationType: 1, donorId: 2 });
    const listed = await request(f.app).get('/api/v1/donations?status=2').set('x-test-user', '2');
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.pagination.totalCount).toBe(1);
    expect((await request(f.app).get('/api/v1/donations/100').set('x-test-user', '2')).status).toBe(
      200
    );
    expect(
      (
        await request(f.app)
          .patch('/api/v1/donations/100/review')
          .set('x-test-user', '1')
          .send({ status: 3 })
      ).body.data.status
    ).toBe(3);
    expect(
      (
        await request(f.app)
          .patch('/api/v1/donations/100/schedule')
          .set('x-test-user', '1')
          .send({ pickupTime: '2026-12-01T06:00:00Z' })
      ).body.data.status
    ).toBe(4);
    expect(
      (await request(f.app).patch('/api/v1/donations/100/complete').set('x-test-user', '1')).body
        .data.status
    ).toBe(5);
  });
  test('manual, batch, recurring, cancellation and deletion routes', async () => {
    const f = httpFixture();
    const manual = await request(f.app)
      .post('/api/v1/donations/manual')
      .set('x-test-user', '1')
      .send({ monasterySpaceId: 10, donationType: 0, donorName: 'Cash donor', amount: 10000 });
    expect(manual.status).toBe(201);
    expect(manual.body.data.donorId).toBeNull();
    expect(
      (await request(f.app).patch('/api/v1/donations/100/cancel').set('x-test-user', '1')).body.data
        .status
    ).toBe(7);
    expect(
      (await request(f.app).delete('/api/v1/donations/100').set('x-test-user', '1')).status
    ).toBe(200);
    expect(
      (
        await request(f.app)
          .post('/api/v1/donations/batch')
          .set('x-test-user', '1')
          .send({ monasterySpaceId: 10, donations: [{ donationType: 1, donorName: 'A' }] })
      ).status
    ).toBe(201);
    expect(
      (
        await request(f.app)
          .post('/api/v1/donations/recurring/request')
          .set('x-test-user', '2')
          .send({ monasterySpaceId: 10, ...recurring })
      ).body.data
    ).toHaveLength(6);
    expect(
      (
        await request(f.app)
          .post('/api/v1/donations/recurring/manual')
          .set('x-test-user', '1')
          .send({ monasterySpaceId: 10, ...recurring, donorName: 'Recurring offline' })
      ).body.data
    ).toHaveLength(6);
  });
  test('space aliases enforce URL scope and validate before writing', async () => {
    const f = httpFixture();
    expect(
      (
        await request(f.app)
          .post('/api/v1/spaces/10/donations')
          .set('x-test-user', '2')
          .send({ donationType: 1 })
      ).status
    ).toBe(201);
    expect(
      (
        await request(f.app)
          .patch('/api/v1/spaces/10/donations/100/review')
          .set('x-test-user', '3')
          .send({ status: 'Accepted' })
      ).body.data.status
    ).toBe(3);
    expect(
      (await request(f.app).get('/api/v1/spaces/11/donations/100').set('x-test-user', '2')).status
    ).toBe(404);
    expect(
      (
        await request(f.app)
          .post('/api/v1/spaces/10/donations')
          .set('x-test-user', '2')
          .send({ monasterySpaceId: 11, donationType: 1 })
      ).status
    ).toBe(400);
    expect(
      (
        await request(f.app)
          .get('/api/v1/spaces/10/donations?monasterySpaceId=11')
          .set('x-test-user', '7')
      ).status
    ).toBe(400);
    expect(
      (
        await request(f.app)
          .post('/api/v1/donations/request')
          .set('x-test-user', '2')
          .send({ monasterySpaceId: 10, donationType: 1, donorId: 5 })
      ).status
    ).toBe(400);
  });
  test('monthly calendar and existing date-range calendar coexist', async () => {
    const f = httpFixture();
    expect(
      (
        await request(f.app)
          .get('/api/v1/donations/calendar?year=2026&month=11')
          .set('x-test-user', '2')
      ).body.data
    ).toMatchObject({ year: 2026, month: 11, totalDonationsCount: 0 });
    expect(
      (
        await request(f.app)
          .get(
            '/api/v1/donations/calendar?monasterySpaceId=10&fromDate=2026-11-01&toDate=2026-11-30'
          )
          .set('x-test-user', '7')
      ).body.existingDateRangeCalendar
    ).toBe(true);
  });
  test('endpoint View applies to own details, member lists and monthly calendars', async () => {
    const f = httpFixture();
    f.donation();
    f.tables.rolePermission = f.tables.rolePermission.filter(
      (row) =>
        !(row.roleId === 2 && (row.permission as Record<string, unknown>).name === 'Donation.View')
    );
    for (const path of [
      '/api/v1/donations/100',
      '/api/v1/donations?monasterySpaceId=10',
      '/api/v1/donations/calendar?year=2026&month=11&monasterySpaceId=10',
    ]) {
      expect((await request(f.app).get(path).set('x-test-user', '7')).status).toBe(403);
    }
    expect((await request(f.app).get('/api/v1/donations/100').set('x-test-user', '2')).status).toBe(
      403
    );
    // Scoped aliases can obtain the endpoint grant from the space role.
    expect(
      (await request(f.app).get('/api/v1/spaces/10/donations').set('x-test-user', '7')).status
    ).toBe(200);
  });
  test('manual/batch/manual-recurring need endpoint Create as well as space Review', async () => {
    const f = httpFixture();
    f.tables.rolePermission = f.tables.rolePermission.filter(
      (row) =>
        !(
          row.roleId === 2 && (row.permission as Record<string, unknown>).name === 'Donation.Create'
        )
    );
    for (const [path, payload] of [
      ['/manual', { monasterySpaceId: 10, donationType: 1, donorName: 'Cash donor' }],
      [
        '/batch',
        { monasterySpaceId: 10, donations: [{ donationType: 1, donorName: 'Cash donor' }] },
      ],
      ['/recurring/manual', { monasterySpaceId: 10, ...recurring, donorName: 'Cash donor' }],
    ] as const) {
      expect(
        (
          await request(f.app)
            .post(`/api/v1/donations${path}`)
            .set('x-test-user', '3')
            .send(payload)
        ).status
      ).toBe(403);
    }
    expect(f.tables.donorList).toHaveLength(0);
  });
  test('revoking Cancel blocks donor cancellation and review alone does not grant Cancel/Delete', async () => {
    const f = httpFixture();
    f.donation();
    f.tables.rolePermission = f.tables.rolePermission.filter(
      (row) =>
        !(
          row.roleId === 2 && (row.permission as Record<string, unknown>).name === 'Donation.Cancel'
        )
    );
    expect(
      (await request(f.app).patch('/api/v1/donations/100/cancel').set('x-test-user', '2')).status
    ).toBe(403);
    expect(
      (await request(f.app).patch('/api/v1/spaces/10/donations/100/cancel').set('x-test-user', '3'))
        .status
    ).toBe(403);
    expect(
      (await request(f.app).delete('/api/v1/spaces/10/donations/100').set('x-test-user', '3'))
        .status
    ).toBe(403);
    f.grant(20, 'Donation.Cancel');
    expect(
      (await request(f.app).patch('/api/v1/spaces/10/donations/100/cancel').set('x-test-user', '3'))
        .body.data.status
    ).toBe(7);
    f.grant(20, 'Donation.Delete');
    expect(
      (await request(f.app).delete('/api/v1/spaces/10/donations/100').set('x-test-user', '3'))
        .status
    ).toBe(200);
  });
  test('endpoint grants do not bypass space service authorization', async () => {
    const f = httpFixture();
    f.donation();
    f.grant(2, 'Donation.Delete');
    f.grant(2, 'Donation.Schedule');
    expect(
      (await request(f.app).delete('/api/v1/donations/100').set('x-test-user', '7')).status
    ).toBe(403);
    expect(
      (await request(f.app).patch('/api/v1/donations/100/complete').set('x-test-user', '7')).status
    ).toBe(403);
    expect(
      (
        await request(f.app)
          .patch('/api/v1/donations/100/review')
          .set('x-test-user', '3')
          .send({ status: 3 })
      ).status
    ).toBe(403);
  });
  test('batch creation stamps title onto note and customDonationType', async () => {
    const f = donationFixture(false);
    const result = await f.service.batch(
      1,
      10,
      [
        { donationType: 0, donorName: 'U Ba', amount: '50000' },
        { donationType: 0, donorName: 'Daw Mya', amount: '100000', note: 'Family fund' },
      ],
      'Brick Wall Construction'
    );
    expect(result).toHaveLength(2);
    expect(result[0].note).toBe('[Batch: Brick Wall Construction]');
    expect(result[0].customDonationType).toBe('Brick Wall Construction');
    expect(result[1].note).toBe('[Batch: Brick Wall Construction] - Family fund');
  });
  test('recurring series can be approved or cancelled in a single call using seriesId', async () => {
    const f = httpFixture();
    const created = await request(f.app)
      .post('/api/v1/donations/recurring/request')
      .set('x-test-user', '2')
      .send({
        monasterySpaceId: 10,
        donationType: 0,
        amount: '10000',
        monthsCount: 3,
        dayOfMonth: 1,
        startDate: '2026-11-01',
      });
    expect(created.status).toBe(201);
    const seriesId = created.body.data[0].seriesId;
    expect(seriesId).toBeTruthy();
    expect(created.body.data[0].seriesIndex).toBe(1);
    expect(created.body.data[0].seriesTotal).toBe(3);

    // Monk reviews all 3 in 1 call
    const reviewed = await request(f.app)
      .patch(`/api/v1/donations/series/${seriesId}/review`)
      .set('x-test-user', '1')
      .send({ status: 3, note: 'Accepted all 3 months' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toHaveLength(3);
    for (const item of reviewed.body.data) {
      expect(item.status).toBe(3);
      expect(item.seriesId).toBe(seriesId);
    }

    // Donor cancels the remaining series in 1 call
    const cancelled = await request(f.app)
      .patch(`/api/v1/donations/series/${seriesId}/cancel`)
      .set('x-test-user', '2')
      .send({ note: 'Relocating to another city' });
    expect(cancelled.status).toBe(200);
    for (const item of cancelled.body.data) {
      expect(item.status).toBe(7);
    }
  });

  test('Space Editor (spaceRoleId: 3) can create manual donations but cannot review, schedule or delete', async () => {
    const f = httpFixture();
    // User 5 is a member of monastery 10 with spaceRoleId: 3 (Space Editor)
    f.tables.monasteryMember.push({
      userId: 5,
      monasterySpaceId: 10,
      role: 3,
      spaceRoleId: 3,
      isOwner: false,
    });
    f.grant(3, 'Donation.Create');

    // 1. Space Editor cannot review/accept donations
    const reviewRes = await request(f.app)
      .patch('/api/v1/donations/100/review')
      .set('x-test-user', '5')
      .send({ status: 3 });
    expect(reviewRes.status).toBe(403);
    expect(reviewRes.body.message).toContain('Donation.Review');

    // 2. Space Editor cannot delete donations
    const deleteRes = await request(f.app).delete('/api/v1/donations/100').set('x-test-user', '5');
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.message).toContain('Donation.Delete');

    // 3. Space Editor cannot schedule donations
    const scheduleRes = await request(f.app)
      .patch('/api/v1/donations/100/schedule')
      .set('x-test-user', '5')
      .send({ pickupTime: '2026-11-01T08:00:00Z' });
    expect(scheduleRes.status).toBe(403);
    expect(scheduleRes.body.message).toContain('Donation.Schedule');

    // 4. Space Editor CAN create manual donations because they have Space.Donation.Create
    const manualRes = await request(f.app)
      .post('/api/v1/donations/manual')
      .set('x-test-user', '5')
      .send({ monasterySpaceId: 10, donationType: 0, amount: 5000, donorName: 'Test' });
    expect(manualRes.status).toBe(201);
    expect(Number(manualRes.body.data.amount)).toBe(5000);

    // 5. Space Member (User 7: only Space.View, no Donation.Create) CANNOT create manual donations
    const memberManualRes = await request(f.app)
      .post('/api/v1/donations/manual')
      .set('x-test-user', '7')
      .send({ monasterySpaceId: 10, donationType: 0, amount: 5000, donorName: 'Test' });
    expect(memberManualRes.status).toBe(403);
    expect(memberManualRes.body.message).toContain('Donation.Create');
  });
});

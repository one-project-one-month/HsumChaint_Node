import { mock } from 'bun:test';
import { Prisma } from 'prisma-client';
import { AppError } from '@/utils/AppError';
import type {
  BatchDonationInput,
  CancelDonationInput,
  DonationFeedQueryInput,
  DonationQueryInput,
  ManualDonationInput,
  ManualRecurringInput,
  MonthlyQueryInput,
  RequestDonationInput,
  RequestRecurringInput,
  ReviewDonationInput,
  ScheduleDonationInput,
  UpdateDonationStatusInput,
} from '../donation.schema';
import {
  cancelDonationSeriesService,
  cancelDonationService,
  checkActorUser,
  checkSpacePermission,
  completeDonationService,
  createBatchDonationsService,
  createManualDonationService,
  createManualRecurringDonationService,
  deleteDonationService,
  getDonationByIdService,
  getDonationStatusesService,
  getDonationsFeedService,
  getDonationsService,
  getMonthlyDonationSummaryService,
  hasSystemPermission,
  isSystemAdmin,
  requestDonationService,
  requestRecurringDonationService,
  reviewDonationSeriesService,
  reviewDonationService,
  scheduleDonationService,
  updateDonationStatusDirectlyService,
} from '../donation.service';

type Row = Record<string, unknown>;
type Query = { where?: Row; data?: Row; orderBy?: Row | Row[]; skip?: number; take?: number };

function scalar(value: unknown) {
  return value instanceof Date ? value.getTime() : value;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === 'OR') return (expected as Row[]).some((clause) => matches(row, clause));
    const actual = row[key];
    if (expected === null || typeof expected !== 'object' || expected instanceof Date)
      return scalar(actual) === scalar(expected);
    const filter = expected as Row;
    if ('in' in filter) return (filter.in as unknown[]).includes(actual);
    if ('contains' in filter) {
      return typeof actual === 'string' && actual.includes(String(filter.contains));
    }
    if ('startsWith' in filter) {
      return typeof actual === 'string' && actual.startsWith(String(filter.startsWith));
    }
    if ('gte' in filter || 'lt' in filter || 'lte' in filter) {
      if (actual == null) return false;
      const value = scalar(actual) as number;
      return (
        (!('gte' in filter) || value >= (scalar(filter.gte) as number)) &&
        (!('lt' in filter) || value < (scalar(filter.lt) as number)) &&
        (!('lte' in filter) || value <= (scalar(filter.lte) as number))
      );
    }
    return actual != null && typeof actual === 'object' && matches(actual as Row, filter);
  });
}

let activeDb: Record<string, unknown> | null = null;
let activePush: ((...args: unknown[]) => Promise<void>) | null = null;
let activePushError: ((error: unknown) => void) | null = null;

mock.module('@/lib/prisma', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (!activeDb) throw new Error('No active test db');
        return activeDb[prop];
      },
    }
  ),
}));

mock.module('@/lib/firebase', () => ({
  sendPush: mock(async (...args: unknown[]) => {
    try {
      if (activePush) return await activePush(...args);
    } catch (err) {
      if (activePushError) activePushError(err);
      throw err;
    }
  }),
}));

export function donationFixture(withDonation = true) {
  const tables: Record<string, Row[]> = {
    user: [1, 2, 3, 4, 5, 6, 7].map((id) => ({
      id,
      name: `User ${id}`,
      roleId: id === 1 ? 2 : 3,
      isDeleted: id === 6,
      fcmToken: `token-${id}`,
      role: { isDeleted: false },
    })),
    monasterySpace: [
      { id: 10, isDeleted: false },
      { id: 11, isDeleted: false },
      { id: 12, isDeleted: true },
    ],
    monasteryMember: [
      { userId: 1, monasterySpaceId: 10, role: 1, spaceRoleId: 1, isOwner: true },
      { userId: 3, monasterySpaceId: 10, role: 20, spaceRoleId: 20, isOwner: false },
      { userId: 4, monasterySpaceId: 10, role: 21, spaceRoleId: 21, isOwner: false },
      { userId: 7, monasterySpaceId: 10, role: 7, spaceRoleId: 7, isOwner: false },
    ],
    rolePermission: [],
    spaceRolePermission: [],
    donorList: [],
    notification: [],
  };

  function grant(roleId: number, name: string) {
    tables.rolePermission.push({
      roleId,
      role: { isDeleted: false },
      permission: { name, isDeleted: false },
    });
    tables.spaceRolePermission.push({
      spaceRoleId: roleId,
      spaceRole: { isDeleted: false },
      spacePermission: { name, isDeleted: false },
      isDeleted: false,
    });
  }

  for (const name of ['View', 'Create', 'Review', 'Schedule', 'Cancel', 'Delete']) {
    grant(2, `Donation.${name}`);
  }
  for (const name of ['View', 'Create', 'Cancel']) {
    grant(3, `Donation.${name}`);
  }
  grant(20, 'Donation.Review');
  grant(21, 'Donation.Schedule');
  grant(7, 'Donation.View');

  let sequence = 100;
  function donation(values: Row = {}) {
    const row: Row = {
      id: sequence++,
      monasterySpaceId: 10,
      donorId: 2,
      donorName: 'User 2',
      donationType: 'Food',
      donationTypeValue: 1,
      customDonationType: null,
      note: null,
      amount: null,
      quantity: null,
      status: 'PendingReview',
      statusValue: 1,
      reviewerId: null,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      reviewedAt: null,
      pickupTime: null,
      dropoffTime: null,
      completedAt: null,
      ...values,
    };
    for (const key of ['amount', 'quantity']) {
      if (row[key] != null) row[key] = new Prisma.Decimal(String(row[key]));
    }
    tables.donorList.push(row);
    return row;
  }

  if (withDonation) donation();

  function enriched(name: string, row: Row): Row {
    if (name === 'user') {
      return { ...row, role: { isDeleted: false } };
    }
    if (name === 'monasteryMember') {
      const u = tables.user.find((x) => x.id === row.userId);
      const s = tables.monasterySpace.find((x) => x.id === row.monasterySpaceId);
      return {
        ...row,
        user: { isDeleted: Boolean(u?.isDeleted) },
        monasterySpace: { isDeleted: Boolean(s?.isDeleted) },
      };
    }
    if (name === 'donorList') {
      const s = tables.monasterySpace.find((x) => x.id === row.monasterySpaceId);
      return {
        ...row,
        monasterySpace: { isDeleted: Boolean(s?.isDeleted) },
      };
    }
    if (name === 'rolePermission') {
      return {
        ...row,
        role: { isDeleted: false },
        permission: row.permission ?? { name: '', isDeleted: false },
      };
    }
    if (name === 'spaceRolePermission') {
      return {
        ...row,
        spaceRole: { isDeleted: false },
        spacePermission: row.spacePermission ?? { name: '', isDeleted: false },
      };
    }
    return row;
  }

  const delegate = (name: string) => ({
    findFirst: mock(async ({ where }: Query = {}) => {
      const match = tables[name].find((row) => matches(enriched(name, row), where));
      return match ? { ...match } : null;
    }),
    findMany: mock(async ({ where, skip = 0, take }: Query = {}) => {
      const rows = tables[name]
        .filter((row) => matches(enriched(name, row), where))
        .map((row) => {
          return { ...row };
        });
      return rows.slice(skip, take === undefined ? undefined : skip + take);
    }),
    count: mock(
      async ({ where }: Query = {}) =>
        tables[name].filter((row) => matches(enriched(name, row), where)).length
    ),
    create: mock(async ({ data = {} }: Query) => {
      if (name === 'donorList') return donation(data);
      const row = { id: tables[name].length + 1, ...data };
      tables[name].push(row);
      return row;
    }),
    updateMany: mock(async ({ where, data = {} }: Query) => {
      let count = 0;
      tables[name] = tables[name].map((row) => {
        if (!matches(enriched(name, row), where)) return row;
        count++;
        return { ...row, ...data };
      });
      return { count };
    }),
    deleteMany: mock(async ({ where }: Query) => {
      const previous = tables[name].length;
      tables[name] = tables[name].filter((row) => !matches(enriched(name, row), where));
      return { count: previous - tables[name].length };
    }),
    findUniqueOrThrow: mock(async ({ where }: Query) => {
      const row = tables[name].find((row) => matches(row, where));
      if (!row) throw new Error('Missing row');
      return row;
    }),
  });

  const delegates = {
    user: delegate('user'),
    monasterySpace: delegate('monasterySpace'),
    monasteryMember: delegate('monasteryMember'),
    rolePermission: delegate('rolePermission'),
    spaceRolePermission: delegate('spaceRolePermission'),
    donorList: delegate('donorList'),
    notification: delegate('notification'),
  };

  const db = {
    ...delegates,
    $transaction: async (action: unknown) => {
      if (typeof action !== 'function') return Promise.all(action as Promise<unknown>[]);
      const snapshot = Object.fromEntries(
        Object.entries(tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))])
      );
      try {
        return await action(delegates);
      } catch (error) {
        Object.assign(tables, snapshot);
        throw error;
      }
    },
  };

  const push = mock(async (_token: unknown, _message: unknown, _data: unknown) => {});
  const pushError = mock((_error: unknown) => {});

  activeDb = db;
  activePush = push;
  activePushError = pushError;

  const service = {
    request: (userId: number, spaceId: number, data: unknown) =>
      requestDonationService(userId, {
        ...(data as Record<string, unknown>),
        monasterySpaceId: spaceId,
      } as unknown as RequestDonationInput),
    manual: (userId: number, spaceId: number, data: unknown) =>
      createManualDonationService(userId, {
        ...(data as Record<string, unknown>),
        monasterySpaceId: spaceId,
      } as unknown as ManualDonationInput & { monasterySpaceId: number }),
    batch: (userId: number, spaceId: number, data: unknown, title?: string) =>
      createBatchDonationsService(userId, {
        donations: Array.isArray(data)
          ? data
          : ((data as Record<string, unknown>).donations as BatchDonationInput['donations']),
        title: Array.isArray(data)
          ? title
          : ((data as Record<string, unknown>).title as string | undefined),
        monasterySpaceId: spaceId,
      }),
    recurring: (userId: number, spaceId: number, data: unknown, isManual = false) =>
      isManual
        ? createManualRecurringDonationService(userId, {
            ...(data as Record<string, unknown>),
            monasterySpaceId: spaceId,
          } as unknown as ManualRecurringInput & { monasterySpaceId: number })
        : requestRecurringDonationService(userId, {
            ...(data as Record<string, unknown>),
            monasterySpaceId: spaceId,
          } as unknown as RequestRecurringInput & { monasterySpaceId: number }),
    list: (userId: number, query: unknown) =>
      getDonationsService(userId, query as unknown as DonationQueryInput),
    feed: (userId: number, query: unknown) =>
      getDonationsFeedService(userId, query as unknown as DonationFeedQueryInput),
    statuses: () => getDonationStatusesService(),
    get: (userId: number, donationId: number, spaceId?: number) =>
      getDonationByIdService(userId, donationId, spaceId),
    monthly: (userId: number, query: unknown) =>
      getMonthlyDonationSummaryService(userId, query as unknown as MonthlyQueryInput),
    change: (
      userId: number,
      donationId: number,
      action: 'review' | 'schedule' | 'complete' | 'cancel' | 'delete',
      input: Record<string, unknown> = {},
      spaceId?: number
    ) => {
      if (action === 'review')
        return reviewDonationService(
          userId,
          donationId,
          input as unknown as ReviewDonationInput,
          spaceId
        );
      if (action === 'schedule')
        return scheduleDonationService(
          userId,
          donationId,
          input as unknown as ScheduleDonationInput,
          spaceId
        );
      if (action === 'complete') return completeDonationService(userId, donationId, spaceId);
      if (action === 'cancel')
        return cancelDonationService(
          userId,
          donationId,
          input as unknown as CancelDonationInput,
          spaceId
        );
      if (action === 'delete') return deleteDonationService(userId, donationId, spaceId);
      throw new Error(`Unknown action: ${action}`);
    },
    updateStatus: (userId: number, donationId: number, input: unknown, spaceId?: number) =>
      updateDonationStatusDirectlyService(
        userId,
        donationId,
        input as unknown as UpdateDonationStatusInput,
        spaceId
      ),
    reviewSeries: (
      userId: number,
      seriesId: string,
      input: { status: number; note?: string | null },
      spaceId?: number
    ) =>
      reviewDonationSeriesService(
        userId,
        seriesId,
        input as unknown as ReviewDonationInput,
        spaceId
      ),
    cancelSeries: (userId: number, seriesId: string, note?: string | null, spaceId?: number) =>
      cancelDonationSeriesService(userId, seriesId, { note }, spaceId),
    authorizeEndpoint: async (userId: number, permission: string, spaceId?: number) => {
      const user = await checkActorUser(userId);
      if (isSystemAdmin(user)) return;
      if (await hasSystemPermission(user.roleId, permission)) return;
      if (spaceId !== undefined) return checkSpacePermission(userId, spaceId, permission);
      throw new AppError(`Missing permission: ${permission}`, 403);
    },
  };

  return { tables, db, service, donation, grant, push, pushError };
}

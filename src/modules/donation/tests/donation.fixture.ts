import { mock } from 'bun:test';
import { Prisma } from 'prisma-client';
import { createDonationService } from '../donation.service';

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

export function donationFixture(withDonation = true) {
  const tables: Record<string, Row[]> = {
    user: [1, 2, 3, 4, 5, 6, 7].map((id) => ({
      id,
      name: `User ${id}`,
      roleId: id === 1 ? 1 : 2,
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
    donorList: [],
    notification: [],
  };

  function grant(roleId: number, name: string) {
    tables.rolePermission.push({
      roleId,
      role: { isDeleted: false },
      permission: { name, isDeleted: false },
    });
  }

  for (const name of ['View', 'Create', 'Review', 'Schedule', 'Cancel', 'Delete']) {
    grant(1, `Donation.${name}`);
  }
  for (const name of ['View', 'Create', 'Cancel']) {
    grant(2, `Donation.${name}`);
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
      statusValue: 2,
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

  function enriched(name: string, row: Row) {
    if (name === 'donorList' || name === 'monasteryMember') {
      return {
        ...row,
        monasterySpace: tables.monasterySpace.find((space) => space.id === row.monasterySpaceId),
        ...(name === 'monasteryMember'
          ? { user: tables.user.find((user) => user.id === row.userId) }
          : {}),
      };
    }
    return row;
  }

  const delegate = (name: string) => ({
    findFirst: mock(
      async ({ where }: Query = {}) =>
        tables[name].find((row) => matches(enriched(name, row), where)) ?? null
    ),
    findUnique: mock(
      async ({ where }: Query = {}) =>
        tables[name].find((row) => matches(enriched(name, row), where)) ?? null
    ),
    findMany: mock(async ({ where, orderBy, skip = 0, take }: Query = {}) => {
      const rows = tables[name].filter((row) => matches(enriched(name, row), where));
      const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
      rows.sort((a, b) => {
        for (const order of orders) {
          for (const [key, direction] of Object.entries(order)) {
            const left = scalar(a[key]) as number;
            const right = scalar(b[key]) as number;
            if (left !== right) return (left < right ? -1 : 1) * (direction === 'desc' ? -1 : 1);
          }
        }
        return 0;
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

  const push = mock(async (_token: string, _message: string, _data: Record<string, string>) => {});
  const pushError = mock((_error: unknown) => {});
  const service = createDonationService(
    db as unknown as Parameters<typeof createDonationService>[0],
    { sendPush: push, onPushError: pushError }
  );

  return { tables, db, service, donation, grant, push, pushError };
}

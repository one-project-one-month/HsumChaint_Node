import crypto from 'node:crypto';
import type { DonorList, Prisma, PrismaClient } from 'prisma-client';
import { sendPush } from '@/lib/firebase';
import { prisma as defaultPrisma } from '@/lib/prisma';
import { SPACE_ROLES } from '@/modules/space/space.permissions';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import type {
  BatchDonationInput,
  DonationInput,
  DonationQueryInput,
  ManualDonationInput,
  ManualRecurringInput,
  MonthlyQueryInput,
  RecurringInput,
  ReviewDonationInput,
  ScheduleDonationInput,
} from './donation.schema';
import {
  DONATION_NOTIFICATION_TYPE,
  DONATION_STATUS,
  DONATION_TYPE,
  type DonationDto,
  type DonationPermission,
  type PaginatedDonationsDto,
} from './donation.types';

export { DONATION_NOTIFICATION_TYPE };

export type Database = Pick<
  PrismaClient,
  '$transaction' | 'user' | 'monasterySpace' | 'monasteryMember' | 'rolePermission' | 'donorList'
> & {
  spaceRolePermission?: PrismaClient['spaceRolePermission'];
};

type TxWithSpace = {
  spaceRolePermission?: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<{ spaceRoleId: number }[]>;
  };
};

type Tx = Prisma.TransactionClient;

export type PushItem = {
  token: string;
  message: string;
  donationId: number;
};

export type Delivery = {
  sendPush?: (token: string, message: string, data: Record<string, string>) => Promise<void>;
  onPushError?: (error: unknown) => void;
};

export type ChangeAction = 'review' | 'schedule' | 'complete' | 'cancel' | 'delete';

export type ChangeInput = {
  status?: number;
  note?: string | null;
  pickupTime?: string | Date | null;
  dropoffTime?: string | Date | null;
};

// ============================================================================
// Data Mapping & Helpers
// ============================================================================

export function mapDonation(row: DonorList): DonationDto {
  const donationType =
    typeof row.donationTypeValue === 'number'
      ? row.donationTypeValue
      : typeof row.donationType === 'number'
        ? row.donationType
        : ((row as unknown as { donationTypeValue?: number }).donationTypeValue ??
          DONATION_TYPE[row.donationType as keyof typeof DONATION_TYPE] ??
          DONATION_TYPE.Other);

  const status =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS] ??
        DONATION_STATUS.Draft);

  return {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    donorId: row.donorId ?? null,
    donorName: row.donorName ?? null,
    donationType,
    customDonationType: row.customDonationType ?? null,
    note: row.note ?? null,
    amount: row.amount != null ? row.amount.toString() : null,
    quantity: row.quantity != null ? row.quantity.toString() : null,
    status,
    reviewerId: row.reviewerId ?? null,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt ?? null,
    pickupTime: row.pickupTime ?? null,
    dropoffTime: row.dropoffTime ?? null,
    completedAt: row.completedAt ?? null,
    seriesId:
      (row as unknown as { seriesId?: string | null }).seriesId ?? parseSeries(row.note).seriesId,
    seriesIndex:
      (row as unknown as { seriesIndex?: number | null }).seriesIndex ??
      parseSeries(row.note).seriesIndex,
    seriesTotal:
      (row as unknown as { seriesTotal?: number | null }).seriesTotal ??
      parseSeries(row.note).seriesTotal,
  };
}

export const SERIES_REGEX = /^\[Series:\s*([a-zA-Z0-9_-]+)\]\s*\((\d+)\/(\d+)\)/;

export function parseSeries(note?: string | null) {
  if (!note) return { seriesId: null, seriesIndex: null, seriesTotal: null };
  const match = note.match(SERIES_REGEX);
  if (!match) return { seriesId: null, seriesIndex: null, seriesTotal: null };
  return {
    seriesId: match[1],
    seriesIndex: Number(match[2]),
    seriesTotal: Number(match[3]),
  };
}

export function statusName(status: number): string {
  const match = Object.entries(DONATION_STATUS).find(([, value]) => value === status);
  return match ? match[0] : 'Unknown';
}

export function typeName(type: number): string {
  const match = Object.entries(DONATION_TYPE).find(([, value]) => value === type);
  return match ? match[0] : 'Other';
}

export function recurringDates(input: {
  startDate: string | Date;
  dayOfMonth: number;
  monthsCount: number;
  pickupTimeOfDay?: string | null;
  dropoffTimeOfDay?: string | null;
}): { pickupTime: Date | null; dropoffTime: Date | null }[] {
  const start = new Date(input.startDate);
  const time = (base: Date, timeStr?: string | null) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map((p) => Number(p));
    const [hours = 0, minutes = 0, seconds = 0] = parts;
    return new Date(base.getTime() + (hours * 3600 + minutes * 60 + seconds) * 1000);
  };

  return Array.from({ length: input.monthsCount }, (_, i) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const lastDay = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)
    ).getUTCDate();
    month.setUTCDate(Math.min(input.dayOfMonth, lastDay));
    return {
      pickupTime: time(month, input.pickupTimeOfDay),
      dropoffTime: time(month, input.dropoffTimeOfDay),
    };
  });
}

function memberRoleId(m: unknown): number {
  return (
    (m as { spaceRoleId?: number; role?: number }).spaceRoleId ??
    (m as { spaceRoleId?: number; role?: number }).role ??
    0
  );
}

// ============================================================================
// Permission & Membership Helpers (Module Scope)
// ============================================================================

export function isSystemAdmin(user: {
  roleId: number;
  role?: { name?: string | null } | null;
}): boolean {
  return (
    user.roleId === 4 ||
    (typeof user.role?.name === 'string' && user.role.name.trim().toLowerCase() === 'system admin')
  );
}

export async function hasSystemPermission(
  tx: Database | Tx,
  roleId: number,
  permission: DonationPermission
): Promise<boolean> {
  const match = await tx.rolePermission.count({
    where: {
      roleId,
      role: { isDeleted: false },
      permission: {
        name: { in: [permission, `Space.${permission}`] },
        isDeleted: false,
      },
    },
  });
  return match > 0;
}

export async function hasSpacePermission(
  tx: Database | Tx,
  membership: { spaceRoleId?: number; role?: number; isOwner?: boolean },
  permission: DonationPermission
): Promise<boolean> {
  if (membership.isOwner) return true;
  const roleId = memberRoleId(membership);
  if (roleId === SPACE_ROLES.SPACE_ADMIN) return true;

  if (permission === 'Donation.Create') {
    if (roleId === SPACE_ROLES.SPACE_MEMBER || roleId === SPACE_ROLES.SPACE_EDITOR) {
      return true;
    }
  }

  const txWithSpace = tx as unknown as TxWithSpace;
  if (typeof txWithSpace.spaceRolePermission?.count === 'function') {
    const match = await txWithSpace.spaceRolePermission.count({
      where: {
        spaceRoleId: roleId,
        isDeleted: false,
        spaceRole: { isDeleted: false },
        spacePermission: {
          name: { in: [permission, `Space.${permission}`] },
          isDeleted: false,
        },
      },
    });
    if (match > 0) return true;
  }

  return hasSystemPermission(tx, roleId, permission);
}

export async function hasPermission(
  tx: Database | Tx,
  roleId: number,
  permission: DonationPermission
): Promise<boolean> {
  return hasSystemPermission(tx, roleId, permission);
}

export async function checkActorUser(tx: Database | Tx, userId: number) {
  const user = await tx.user.findFirst({
    where: { id: userId, isDeleted: false, role: { isDeleted: false } },
    include: { role: true },
  });
  if (!user) throw new AppError('User not found or deleted', 403);
  return user;
}

export async function checkMonasterySpace(tx: Database | Tx, spaceId: number) {
  const found = await tx.monasterySpace.findFirst({
    where: { id: spaceId, isDeleted: false },
  });
  if (!found) throw new AppError('Monastery space not found', 404);
  return found;
}

export async function getMonasteryMember(tx: Database | Tx, userId: number, spaceId: number) {
  return tx.monasteryMember.findFirst({
    where: {
      userId,
      monasterySpaceId: spaceId,
      user: { isDeleted: false },
      monasterySpace: { isDeleted: false },
    },
  });
}

export async function checkSpacePermission(
  tx: Database | Tx,
  userId: number,
  spaceId: number,
  permission: DonationPermission
) {
  const user = await checkActorUser(tx, userId);
  if (isSystemAdmin(user)) return;
  const membership = await getMonasteryMember(tx, userId, spaceId);
  if (
    !membership ||
    (!membership.isOwner && !(await hasSpacePermission(tx, membership, permission)))
  ) {
    throw new AppError(`Missing space permission: ${permission}`, 403);
  }
}

export async function checkRequestAccess(tx: Database | Tx, userId: number, spaceId: number) {
  const user = await checkActorUser(tx, userId);
  await checkMonasterySpace(tx, spaceId);
  if (!(await hasPermission(tx, user.roleId, 'Donation.Create'))) {
    await checkSpacePermission(tx, userId, spaceId, 'Donation.Create');
  }
  return user;
}

export async function resolveDonor(
  tx: Database | Tx,
  input: { donorId?: number | null; donorName?: string | null }
): Promise<{ id: number | null; name: string }> {
  if (input.donorId != null) {
    const existing = await tx.user.findFirst({
      where: { id: input.donorId, isDeleted: false },
    });
    if (!existing) throw new AppError('Donor user not found', 404);
    return { id: existing.id, name: existing.name };
  }
  if (!input.donorName?.trim()) {
    throw new AppError('Donor name is required without a donor account', 400);
  }
  return { id: null, name: input.donorName.trim() };
}

export async function getVisibleScope(
  db: Database,
  userId: number,
  rawSpaceId?: number | string,
  rawDonorId?: number | string
): Promise<Prisma.DonorListWhereInput> {
  const user = await checkActorUser(db, userId);
  const admin = isSystemAdmin(user);
  const spaceId =
    rawSpaceId !== undefined && rawSpaceId !== null && !Number.isNaN(Number(rawSpaceId))
      ? Number(rawSpaceId)
      : undefined;
  const donorId =
    rawDonorId !== undefined && rawDonorId !== null && !Number.isNaN(Number(rawDonorId))
      ? Number(rawDonorId)
      : undefined;

  if (spaceId !== undefined) {
    if (!admin && !(await getMonasteryMember(db, userId, spaceId))) {
      throw new AppError('Monastery membership required', 403);
    }
    return { monasterySpaceId: spaceId, ...(donorId !== undefined ? { donorId } : {}) };
  }

  if (admin) {
    return {
      monasterySpace: { isDeleted: false },
      ...(donorId !== undefined ? { donorId } : {}),
    };
  }

  if (donorId !== undefined && donorId !== userId) {
    throw new AppError('Cannot view another donor history', 403);
  }

  if (!(await hasPermission(db, user.roleId, 'Donation.View'))) {
    throw new AppError('Missing permission: Donation.View', 403);
  }

  return { donorId: userId, monasterySpace: { isDeleted: false } };
}

// ============================================================================
// Notifications
// ============================================================================

export async function notifyUser(
  tx: Tx,
  pushes: PushItem[],
  userId: number | null,
  message: string,
  donationId: number
) {
  if (userId === null) return;
  const user = await tx.user.findFirst({ where: { id: userId, isDeleted: false } });
  if (!user) return;
  await tx.notification.create({
    data: { userId, type: DONATION_NOTIFICATION_TYPE, message },
  });
  if (user.fcmToken) {
    pushes.push({ token: user.fcmToken, message, donationId });
  }
}

export async function notifyMonasteryManagers(
  tx: Tx,
  pushes: PushItem[],
  spaceId: number,
  message: string,
  donationId: number
) {
  const members = await tx.monasteryMember.findMany({
    where: {
      monasterySpaceId: spaceId,
      user: { isDeleted: false },
      monasterySpace: { isDeleted: false },
    },
  });
  const memberRoleIds = members.map(memberRoleId);
  const reviewers = await tx.rolePermission.findMany({
    where: {
      roleId: { in: memberRoleIds },
      role: { isDeleted: false },
      permission: {
        isDeleted: false,
        name: { in: ['Donation.Review', 'Space.Donation.Review'] },
      },
    },
    select: { roleId: true },
  });
  const matchedRoleIds = reviewers.map((r) => r.roleId);

  const txWithSpace = tx as unknown as TxWithSpace;
  if (typeof txWithSpace.spaceRolePermission?.findMany === 'function') {
    const spaceReviewers = await txWithSpace.spaceRolePermission.findMany({
      where: {
        spaceRoleId: { in: memberRoleIds },
        isDeleted: false,
        spaceRole: { isDeleted: false },
        spacePermission: {
          isDeleted: false,
          name: { in: ['Donation.Review', 'Space.Donation.Review'] },
        },
      },
      select: { spaceRoleId: true },
    });
    matchedRoleIds.push(...spaceReviewers.map((r: { spaceRoleId: number }) => r.spaceRoleId));
  }

  const roles = new Set(matchedRoleIds);
  const users = new Set(
    members
      .filter(
        (m) => m.isOwner || m.spaceRoleId === SPACE_ROLES.SPACE_ADMIN || roles.has(memberRoleId(m))
      )
      .map((m) => m.userId)
  );
  for (const userId of users) {
    await notifyUser(tx, pushes, userId, message, donationId);
  }
}

export async function executeWithPushes<T>(
  db: Database,
  delivery: Delivery,
  action: (tx: Tx, pushes: PushItem[]) => Promise<T>
): Promise<T> {
  const pushes: PushItem[] = [];
  const result = await db.$transaction((tx) => action(tx, pushes), { timeout: 30000 });
  for (const item of pushes) {
    try {
      if (delivery.sendPush) {
        await delivery.sendPush(item.token, item.message, {
          donationId: String(item.donationId),
          type: 'Donation',
        });
      } else {
        await sendPush(
          item.token,
          item.message,
          {
            donationId: String(item.donationId),
            type: 'Donation',
          },
          'Donation Update'
        );
      }
    } catch (error) {
      delivery.onPushError?.(error);
      logger.warn(
        `Push notification failed for donation ${item.donationId}: ${(error as Error).message}`
      );
    }
  }
  return result;
}

// ============================================================================
// Core Exported Service Functions (Matching user.service.ts pattern)
// ============================================================================

export async function authorizeDonationEndpointService(
  userId: number,
  permission: DonationPermission,
  spaceId?: number,
  db: Database = defaultPrisma
): Promise<void> {
  const user = await checkActorUser(db, userId);
  if (isSystemAdmin(user)) return;
  if (await hasPermission(db, user.roleId, permission)) return;
  if (spaceId !== undefined) return checkSpacePermission(db, userId, spaceId, permission);
  throw new AppError(`Missing permission: ${permission}`, 403);
}

export async function requestDonationService(
  userId: number,
  spaceId: number,
  input: DonationInput,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto> {
  return executeWithPushes(db, delivery, async (tx, pushes) => {
    const donor = await checkRequestAccess(tx, userId, spaceId);
    const row = await tx.donorList.create({
      data: {
        monasterySpaceId: spaceId,
        donorId: donor.id,
        donorName: donor.name,
        donationType: typeName(input.donationType),
        donationTypeValue: input.donationType,
        customDonationType: input.customDonationType?.trim() || null,
        note: input.note?.trim() || null,
        amount: input.amount != null ? input.amount : null,
        quantity: input.quantity != null ? input.quantity : null,
        status: statusName(DONATION_STATUS.PendingReview),
        statusValue: DONATION_STATUS.PendingReview,
        pickupTime: input.pickupTime ? new Date(input.pickupTime) : null,
        dropoffTime: input.dropoffTime ? new Date(input.dropoffTime) : null,
      },
    });
    await notifyMonasteryManagers(
      tx,
      pushes,
      spaceId,
      'A new donation request is waiting for review.',
      row.id
    );
    return mapDonation(row);
  });
}

export async function createManualDonationService(
  userId: number,
  spaceId: number,
  input: ManualDonationInput,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto> {
  return executeWithPushes(db, delivery, async (tx, pushes) => {
    await checkMonasterySpace(tx, spaceId);
    await checkSpacePermission(tx, userId, spaceId, 'Donation.Create');

    const donor = await resolveDonor(tx, input);
    const isScheduled = Boolean(input.pickupTime || input.dropoffTime);
    const initialStatus = isScheduled ? DONATION_STATUS.Scheduled : DONATION_STATUS.Accepted;

    const row = await tx.donorList.create({
      data: {
        monasterySpaceId: spaceId,
        donorId: donor.id,
        donorName: donor.name,
        donationType: typeName(input.donationType),
        donationTypeValue: input.donationType,
        customDonationType: input.customDonationType?.trim() || null,
        note: input.note?.trim() || null,
        amount: input.amount != null ? input.amount : null,
        quantity: input.quantity != null ? input.quantity : null,
        status: statusName(initialStatus),
        statusValue: initialStatus,
        pickupTime: input.pickupTime ? new Date(input.pickupTime) : null,
        dropoffTime: input.dropoffTime ? new Date(input.dropoffTime) : null,
        reviewerId: userId,
        reviewedAt: new Date(),
      },
    });
    await notifyUser(
      tx,
      pushes,
      donor.id,
      'Your donation has been recorded by the monastery.',
      row.id
    );
    return mapDonation(row);
  });
}

export async function createBatchDonationsService(
  userId: number,
  spaceId: number,
  input: BatchDonationInput | ManualDonationInput[],
  title?: string,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto[]> {
  return executeWithPushes(db, delivery, async (tx) => {
    await checkMonasterySpace(tx, spaceId);
    await checkSpacePermission(tx, userId, spaceId, 'Donation.Create');

    const items: ManualDonationInput[] = Array.isArray(input) ? input : input.donations;
    const batchTitle: string | undefined = Array.isArray(input) ? title : input.title;

    const rows: DonorList[] = [];
    for (const item of items) {
      const donor = await resolveDonor(tx, item);
      const notePrefix = batchTitle?.trim() ? `[Batch: ${batchTitle.trim()}]` : '';
      const itemNote = item.note?.trim();
      const finalNote = notePrefix
        ? itemNote
          ? `${notePrefix} - ${itemNote}`
          : notePrefix
        : itemNote || null;
      const finalCustomType = item.customDonationType?.trim() || batchTitle?.trim() || null;

      const isScheduled = Boolean(item.pickupTime || item.dropoffTime);
      const initialStatus = isScheduled ? DONATION_STATUS.Scheduled : DONATION_STATUS.Accepted;

      const row = await tx.donorList.create({
        data: {
          monasterySpaceId: spaceId,
          donorId: donor.id,
          donorName: donor.name,
          donationType: typeName(item.donationType),
          donationTypeValue: item.donationType,
          customDonationType: finalCustomType,
          note: finalNote,
          amount: item.amount != null ? item.amount : null,
          quantity: item.quantity != null ? item.quantity : null,
          status: statusName(initialStatus),
          statusValue: initialStatus,
          pickupTime: item.pickupTime ? new Date(item.pickupTime) : null,
          dropoffTime: item.dropoffTime ? new Date(item.dropoffTime) : null,
          reviewerId: userId,
          reviewedAt: new Date(),
        },
      });
      rows.push(row);
    }
    return rows.map(mapDonation);
  });
}

export async function createRecurringDonationService(
  userId: number,
  spaceId: number,
  input: RecurringInput | ManualRecurringInput,
  isManual = false,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto[]> {
  return executeWithPushes(db, delivery, async (tx, pushes) => {
    const donor = isManual
      ? await (async () => {
          await checkActorUser(tx, userId);
          await checkMonasterySpace(tx, spaceId);
          await checkSpacePermission(tx, userId, spaceId, 'Donation.Create');
          return resolveDonor(tx, input as ManualRecurringInput);
        })()
      : await checkRequestAccess(tx, userId, spaceId);

    const slots = recurringDates(input);
    const seriesId = crypto.randomBytes(4).toString('hex');

    const initialStatus = isManual
      ? input.pickupTimeOfDay || input.dropoffTimeOfDay
        ? DONATION_STATUS.Scheduled
        : DONATION_STATUS.Accepted
      : DONATION_STATUS.PendingReview;

    const rows: DonorList[] = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const note = `[Series: ${seriesId}] (${i + 1}/${input.monthsCount})${input.note?.trim() ? ` - ${input.note.trim()}` : ''}`;
      const row = await tx.donorList.create({
        data: {
          monasterySpaceId: spaceId,
          donorId: donor.id,
          donorName: donor.name,
          donationType: typeName(input.donationType),
          donationTypeValue: input.donationType,
          customDonationType: input.customDonationType?.trim() || null,
          note,
          amount: input.amount != null ? input.amount : null,
          quantity: input.quantity != null ? input.quantity : null,
          status: statusName(initialStatus),
          statusValue: initialStatus,
          pickupTime: slot.pickupTime,
          dropoffTime: slot.dropoffTime,
          ...(isManual ? { reviewerId: userId, reviewedAt: new Date() } : {}),
        },
      });
      rows.push(row);
    }

    if (isManual) {
      await notifyUser(
        tx,
        pushes,
        donor.id,
        `A recurring donation series (${slots.length} months) was recorded for you.`,
        rows[0].id
      );
    } else {
      await notifyMonasteryManagers(
        tx,
        pushes,
        spaceId,
        `New recurring donation series (${slots.length} months) submitted for review.`,
        rows[0].id
      );
    }
    return rows.map(mapDonation);
  });
}

export async function getDonationsService(
  userId: number,
  query: DonationQueryInput,
  db: Database = defaultPrisma
): Promise<PaginatedDonationsDto> {
  const scope = await getVisibleScope(db, userId, query.monasterySpaceId, query.donorId);
  const where = {
    ...scope,
    ...(query.status !== undefined ? { statusValue: Number(query.status) } : {}),
    ...(query.fromDate || query.toDate
      ? {
          createdAt: {
            ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
            ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
          },
        }
      : {}),
  };

  const pageNumber = Number(query.pageNumber) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const skip = (pageNumber - 1) * pageSize;

  const [rows, totalCount] = await db.$transaction([
    db.donorList.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    db.donorList.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  return {
    items: rows.map(mapDonation),
    pagination: {
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      hasPreviousPage: pageNumber > 1,
      hasNextPage: pageNumber < totalPages,
    },
  };
}

export async function getDonationByIdService(
  userId: number,
  donationId: number,
  spaceId?: number,
  db: Database = defaultPrisma
): Promise<DonationDto> {
  await checkActorUser(db, userId);
  const row = await db.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);
  if (row.donorId !== userId && !(await getMonasteryMember(db, userId, row.monasterySpaceId))) {
    throw new AppError('Cannot view this donation', 403);
  }
  return mapDonation(row);
}

export async function getMonthlyDonationSummaryService(
  userId: number,
  query: MonthlyQueryInput,
  db: Database = defaultPrisma
): Promise<{
  year: number;
  month: number;
  totalDonationsCount: number;
  totalAmount: string;
  days: {
    day: number;
    date: string;
    donationsCount: number;
    donations: DonationDto[];
  }[];
}> {
  const year = Number(query.year);
  const month = Number(query.month);
  const spaceId =
    query.monasterySpaceId !== undefined && query.monasterySpaceId !== null
      ? Number(query.monasterySpaceId)
      : undefined;
  const scope = await getVisibleScope(db, userId, spaceId);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const range = { gte: start, lt: end };

  const rows = await db.donorList.findMany({
    where: {
      ...scope,
      ...(query.status !== undefined ? { statusValue: Number(query.status) } : {}),
      OR: [{ pickupTime: range }, { pickupTime: null, createdAt: range }],
    },
  });

  const ordered = rows.sort(
    (a, b) =>
      (a.pickupTime ?? a.createdAt).getTime() - (b.pickupTime ?? b.createdAt).getTime() ||
      a.id - b.id
  );

  const days = new Map<number, DonationDto[]>();
  let cents = 0n;
  for (const row of ordered) {
    const [whole = '0', fraction = ''] = (row.amount?.toFixed(2) ?? '0.00').split('.');
    cents += BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    const day = (row.pickupTime ?? row.createdAt).getUTCDate();
    days.set(day, [...(days.get(day) ?? []), mapDonation(row)]);
  }

  return {
    year: query.year,
    month: query.month,
    totalDonationsCount: rows.length,
    totalAmount: `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`,
    days: [...days].map(([day, donations]) => ({
      day,
      date: `${query.year}-${String(query.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      donationsCount: donations.length,
      donations,
    })),
  };
}

export async function changeDonationService(
  userId: number,
  donationId: number,
  action: ChangeAction,
  input: ChangeInput = {},
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto | boolean> {
  return executeWithPushes(db, delivery, async (tx, pushes) => {
    await checkActorUser(tx, userId);
    const row = await tx.donorList.findFirst({
      where: {
        id: donationId,
        ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
        monasterySpace: { isDeleted: false },
      },
    });
    if (!row) throw new AppError('Donation not found', 404);

    if (action !== 'cancel' || row.donorId !== userId) {
      await checkSpacePermission(
        tx,
        userId,
        row.monasterySpaceId,
        action === 'schedule' || action === 'complete'
          ? 'Donation.Schedule'
          : action === 'delete'
            ? 'Donation.Delete'
            : action === 'cancel'
              ? 'Donation.Cancel'
              : 'Donation.Review'
      );
    }

    const current =
      typeof row.status === 'number'
        ? row.status
        : ((row as unknown as { statusValue?: number }).statusValue ??
          DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

    if (
      (action === 'review' && [5, 7].includes(current)) ||
      (action === 'schedule' && [5, 6, 7].includes(current)) ||
      (action === 'complete' && [6, 7].includes(current)) ||
      ((action === 'cancel' || action === 'delete') && current === 5)
    ) {
      throw new AppError('Donation status does not allow this action', 409);
    }

    const guard = {
      id: row.id,
      monasterySpaceId: row.monasterySpaceId,
      statusValue: current,
      reviewedAt: row.reviewedAt,
      completedAt: row.completedAt,
      pickupTime: row.pickupTime,
      dropoffTime: row.dropoffTime,
    };

    if (action === 'delete') {
      if ((await tx.donorList.deleteMany({ where: guard })).count !== 1) {
        throw new AppError('Donation changed; reload before retrying', 409);
      }
      return true;
    }

    const now = new Date();
    let nextStatus: number;
    const update: Prisma.DonorListUncheckedUpdateManyInput = {};
    let message: string;

    if (action === 'review') {
      if (input.status !== DONATION_STATUS.Accepted && input.status !== DONATION_STATUS.Rejected) {
        throw new AppError('Review status must be Accepted (3) or Rejected (6)', 400);
      }
      nextStatus = input.status;
      update.reviewerId = userId;
      update.reviewedAt = now;
      if (input.note?.trim()) update.note = input.note;
      message = nextStatus === 3 ? 'Your donation was accepted.' : 'Your donation was rejected.';
    } else if (action === 'schedule') {
      if (!input.pickupTime && !input.dropoffTime) {
        throw new AppError('Pickup time or dropoff time is required', 400);
      }
      nextStatus = DONATION_STATUS.Scheduled;
      update.pickupTime = input.pickupTime ? new Date(input.pickupTime) : null;
      update.dropoffTime = input.dropoffTime ? new Date(input.dropoffTime) : null;
      if (input.note?.trim()) update.note = input.note;
      message = 'Your donation pickup/dropoff schedule has been updated.';
    } else if (action === 'complete') {
      nextStatus = DONATION_STATUS.Completed;
      update.completedAt = now;
      message = 'Your donation has been completed.';
    } else {
      nextStatus = DONATION_STATUS.Cancelled;
      if (input.note?.trim()) update.note = input.note;
      message = 'Your donation has been cancelled.';
    }

    update.status = statusName(nextStatus);
    update.statusValue = nextStatus;

    const res = await tx.donorList.updateMany({ where: guard, data: update });
    if (res.count !== 1) {
      throw new AppError('Donation changed; reload before retrying', 409);
    }

    const updated = await tx.donorList.findUniqueOrThrow({ where: { id: row.id } });
    await notifyUser(tx, pushes, row.donorId, message, row.id);
    return mapDonation(updated);
  });
}

export async function reviewDonationService(
  userId: number,
  donationId: number,
  input: ReviewDonationInput,
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto> {
  return changeDonationService(
    userId,
    donationId,
    'review',
    input,
    spaceId,
    db,
    delivery
  ) as Promise<DonationDto>;
}

export async function scheduleDonationService(
  userId: number,
  donationId: number,
  input: ScheduleDonationInput,
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto> {
  return changeDonationService(
    userId,
    donationId,
    'schedule',
    input,
    spaceId,
    db,
    delivery
  ) as Promise<DonationDto>;
}

export async function completeDonationService(
  userId: number,
  donationId: number,
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto> {
  return changeDonationService(
    userId,
    donationId,
    'complete',
    {},
    spaceId,
    db,
    delivery
  ) as Promise<DonationDto>;
}

export async function cancelDonationService(
  userId: number,
  donationId: number,
  note?: string | null,
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto> {
  return changeDonationService(
    userId,
    donationId,
    'cancel',
    { note },
    spaceId,
    db,
    delivery
  ) as Promise<DonationDto>;
}

export async function deleteDonationService(
  userId: number,
  donationId: number,
  spaceId?: number,
  db: Database = defaultPrisma
): Promise<boolean> {
  return changeDonationService(userId, donationId, 'delete', {}, spaceId, db) as Promise<boolean>;
}

export async function reviewDonationSeriesService(
  userId: number,
  seriesId: string,
  input: { status: number; note?: string | null },
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto[]> {
  return executeWithPushes(db, delivery, async (tx, pushes) => {
    const rows = await tx.donorList.findMany({
      where: {
        note: { startsWith: `[Series: ${seriesId}]` },
        ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
        monasterySpace: { isDeleted: false },
      },
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) throw new AppError('Donation series not found', 404);

    const first = rows[0];
    await checkSpacePermission(tx, userId, first.monasterySpaceId, 'Donation.Review');

    if (input.status !== DONATION_STATUS.Accepted && input.status !== DONATION_STATUS.Rejected) {
      throw new AppError('Review status must be Accepted (3) or Rejected (6)', 400);
    }

    const nextStatus = input.status;
    const now = new Date();
    const results: DonorList[] = [];

    for (const row of rows) {
      const current =
        typeof row.status === 'number'
          ? row.status
          : ((row as unknown as { statusValue?: number }).statusValue ??
            DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

      if (current !== DONATION_STATUS.PendingReview) continue;

      const seriesMatch = row.note?.match(SERIES_REGEX)?.[0];
      const updatedNote = seriesMatch
        ? input.note?.trim()
          ? `${seriesMatch} - ${input.note.trim()}`
          : row.note
        : input.note?.trim() || row.note;

      await tx.donorList.updateMany({
        where: { id: row.id },
        data: {
          status: statusName(nextStatus),
          statusValue: nextStatus,
          reviewerId: userId,
          reviewedAt: now,
          ...(updatedNote ? { note: updatedNote } : {}),
        },
      });
      const rowUpdated = await tx.donorList.findUniqueOrThrow({ where: { id: row.id } });
      results.push(rowUpdated);
    }

    const message =
      nextStatus === 3 ? 'Your donation was accepted.' : 'Your donation was rejected.';
    await notifyUser(tx, pushes, first.donorId, message, first.id);
    return results.map(mapDonation);
  });
}

export async function cancelDonationSeriesService(
  userId: number,
  seriesId: string,
  note?: string | null,
  spaceId?: number,
  db: Database = defaultPrisma,
  delivery: Delivery = {}
): Promise<DonationDto[]> {
  return executeWithPushes(db, delivery, async (tx, pushes) => {
    const rows = await tx.donorList.findMany({
      where: {
        note: { startsWith: `[Series: ${seriesId}]` },
        ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
        monasterySpace: { isDeleted: false },
      },
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) throw new AppError('Donation series not found', 404);

    const first = rows[0];
    const isDonor = first.donorId === userId;
    if (!isDonor) {
      await checkSpacePermission(tx, userId, first.monasterySpaceId, 'Donation.Cancel');
    }

    const results: DonorList[] = [];
    for (const row of rows) {
      const current =
        typeof row.status === 'number'
          ? row.status
          : ((row as unknown as { statusValue?: number }).statusValue ??
            DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

      if (current === DONATION_STATUS.Completed) continue;

      const seriesMatch = row.note?.match(SERIES_REGEX)?.[0];
      const updatedNote = seriesMatch
        ? note?.trim()
          ? `${seriesMatch} - [Cancelled] ${note.trim()}`
          : row.note
        : note?.trim() || row.note;

      await tx.donorList.updateMany({
        where: { id: row.id },
        data: {
          status: statusName(DONATION_STATUS.Cancelled),
          statusValue: DONATION_STATUS.Cancelled,
          ...(updatedNote ? { note: updatedNote } : {}),
        },
      });
      const rowUpdated = await tx.donorList.findUniqueOrThrow({ where: { id: row.id } });
      results.push(rowUpdated);
    }

    const message = 'Your donation has been cancelled.';
    await notifyUser(tx, pushes, first.donorId, message, first.id);
    return results.map(mapDonation);
  });
}

// ============================================================================
// Backward-Compatibility Factory & Singleton (for tests & existing callers)
// ============================================================================

export function createDonationService(db: Database = defaultPrisma, delivery: Delivery = {}) {
  return {
    request: (userId: number, spaceId: number, input: DonationInput) =>
      requestDonationService(userId, spaceId, input, db, delivery),
    manual: (userId: number, spaceId: number, input: ManualDonationInput) =>
      createManualDonationService(userId, spaceId, input, db, delivery),
    batch: (
      userId: number,
      spaceId: number,
      input: BatchDonationInput | ManualDonationInput[],
      title?: string
    ) => createBatchDonationsService(userId, spaceId, input, title, db, delivery),
    recurring: (
      userId: number,
      spaceId: number,
      input: RecurringInput | ManualRecurringInput,
      isManual = false
    ) => createRecurringDonationService(userId, spaceId, input, isManual, db, delivery),
    list: (userId: number, query: DonationQueryInput) => getDonationsService(userId, query, db),
    get: (userId: number, donationId: number, spaceId?: number) =>
      getDonationByIdService(userId, donationId, spaceId, db),
    monthly: (userId: number, query: MonthlyQueryInput) =>
      getMonthlyDonationSummaryService(userId, query, db),
    change: (
      userId: number,
      donationId: number,
      action: ChangeAction,
      input: ChangeInput = {},
      spaceId?: number
    ) => changeDonationService(userId, donationId, action, input, spaceId, db, delivery),
    reviewSeries: (
      userId: number,
      seriesId: string,
      input: { status: number; note?: string | null },
      spaceId?: number
    ) => reviewDonationSeriesService(userId, seriesId, input, spaceId, db, delivery),
    cancelSeries: (userId: number, seriesId: string, note?: string | null, spaceId?: number) =>
      cancelDonationSeriesService(userId, seriesId, note, spaceId, db, delivery),
    authorizeEndpoint: (userId: number, permission: DonationPermission, spaceId?: number) =>
      authorizeDonationEndpointService(userId, permission, spaceId, db),
  };
}

export const donationService = createDonationService();

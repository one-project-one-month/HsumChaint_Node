import crypto from 'node:crypto';
import type { DonorList, Prisma } from 'prisma-client';
import { sendPush } from '@/lib/firebase';
import { prisma } from '@/lib/prisma';
import { SPACE_ROLES } from '@/modules/space/space.permissions';
import { AppError } from '@/utils/AppError';
import { logger } from '@/utils/logger';
import type {
  BatchDonationInput,
  CancelDonationInput,
  DonationFeedQueryInput,
  DonationQueryInput,
  ManualDonationInput,
  ManualRecurringInput,
  MonthlyQueryInput,
  RecurringInput,
  RequestDonationInput,
  ReviewDonationInput,
  ScheduleDonationInput,
  UpdateDonationStatusInput,
} from './donation.schema';
import {
  type CursorPagedDonationsDto,
  DONATION_NOTIFICATION_TYPE,
  DONATION_STATUS,
  DONATION_STATUS_CATALOG,
  DONATION_TYPE,
  type DonationDto,
  type DonationStatusItemDto,
  type PaginatedDonationsDto,
} from './donation.types';

export { DONATION_NOTIFICATION_TYPE, DONATION_STATUS_CATALOG };

// ============================================================================
// Data Mapping & Helpers
// ============================================================================

export const SERIES_REGEX = /^\[Series:\s*([a-zA-Z0-9_-]+)\]\s*\((\d+)\/(\d+)\)/;

export const parseSeries = (note?: string | null) => {
  if (!note) return { seriesId: null, seriesIndex: null, seriesTotal: null };
  const match = note.match(SERIES_REGEX);
  if (!match) return { seriesId: null, seriesIndex: null, seriesTotal: null };
  return {
    seriesId: match[1],
    seriesIndex: Number(match[2]),
    seriesTotal: Number(match[3]),
  };
};

export const statusName = (status: number): string => {
  const match = Object.entries(DONATION_STATUS).find(([, value]) => value === status);
  return match ? match[0] : 'Unknown';
};

export const typeName = (type: number): string => {
  const match = Object.entries(DONATION_TYPE).find(([, value]) => value === type);
  return match ? match[0] : 'Other';
};

export const mapDonation = (row: DonorList): DonationDto => {
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
        DONATION_STATUS.PendingReview);

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
};

export const recurringDates = (input: {
  startDate: string | Date;
  dayOfMonth: number;
  monthsCount: number;
  pickupTimeOfDay?: string | null;
  dropoffTimeOfDay?: string | null;
}): { pickupTime: Date | null; dropoffTime: Date | null }[] => {
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
};

// ============================================================================
// Permission & Membership Helpers
// ============================================================================

import {
  authorizeDonationEndpoint,
  checkActorUser,
  checkSpacePermission,
  hasSpacePermission,
  hasSystemPermission,
  isSystemAdmin,
} from '@/middlewares/permissionMiddleware';

export {
  authorizeDonationEndpoint,
  checkActorUser,
  checkSpacePermission,
  hasSpacePermission,
  hasSystemPermission,
  isSystemAdmin,
};

export const checkMonasterySpace = async (spaceId: number) => {
  const found = await prisma.monasterySpace.findFirst({
    where: { id: spaceId, isDeleted: false },
  });
  if (!found) throw new AppError('Monastery space not found', 404);
  return found;
};

export const getMonasteryMember = async (userId: number, spaceId: number) => {
  return prisma.monasteryMember.findFirst({
    where: {
      userId,
      monasterySpaceId: spaceId,
      user: { isDeleted: false },
      monasterySpace: { isDeleted: false },
    },
  });
};

export const checkRequestAccess = async (userId: number, spaceId: number) => {
  const user = await checkActorUser(userId);
  await checkMonasterySpace(spaceId);
  const hasGlobalCreate = await hasSystemPermission(user.roleId, 'Donation.Create');
  if (!hasGlobalCreate) {
    await checkSpacePermission(userId, spaceId, 'Donation.Create');
  }
  return user;
};

export const resolveDonor = async (data: {
  donorId?: number | null;
  donorName?: string | null;
  donorPhoneNumber?: string | null;
  donorPhone?: string | null;
}): Promise<{ id: number | null; name: string }> => {
  if (data.donorId != null) {
    const existing = await prisma.user.findFirst({
      where: { id: data.donorId, isDeleted: false },
    });
    if (!existing) throw new AppError('Donor user not found', 404);
    return { id: existing.id, name: existing.name };
  }
  const phone = data.donorPhoneNumber || data.donorPhone;
  if (phone) {
    const userByPhone = await prisma.user.findFirst({
      where: { phone, isDeleted: false },
    });
    if (userByPhone) {
      return { id: userByPhone.id, name: data.donorName?.trim() || userByPhone.name };
    }
  }
  if (!data.donorName?.trim()) {
    throw new AppError('Donor name is required without a donor account', 400);
  }
  return { id: null, name: data.donorName.trim() };
};

export const getVisibleScope = async (
  userId: number,
  rawSpaceId?: number | string,
  rawDonorId?: number | string
): Promise<Prisma.DonorListWhereInput> => {
  const user = await checkActorUser(userId);
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
    if (!admin && !(await getMonasteryMember(userId, spaceId))) {
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

  const hasView = await hasSystemPermission(user.roleId, 'Donation.View');
  if (!hasView) {
    throw new AppError('Missing permission: Donation.View', 403);
  }

  return { donorId: userId, monasterySpace: { isDeleted: false } };
};

// ============================================================================
// Notifications
// ============================================================================

type PrismaTx = Prisma.TransactionClient | typeof prisma;

export const notifyUser = async (
  userId: number | null,
  message: string,
  donationId: number,
  client: PrismaTx = prisma
) => {
  if (userId === null) return;
  const user = await (client as typeof prisma).user.findFirst({
    where: { id: userId, isDeleted: false },
  });
  if (!user) return;
  await (client as typeof prisma).notification.create({
    data: { userId, type: DONATION_NOTIFICATION_TYPE, message },
  });
  if (user.fcmToken) {
    try {
      await sendPush(user.fcmToken, message, {
        donationId: String(donationId),
        type: 'Donation',
      });
    } catch (error) {
      logger.warn(
        `Push notification failed for donation ${donationId}: ${(error as Error).message}`
      );
    }
  }
};

export const notifyMonasteryManagers = async (
  spaceId: number,
  message: string,
  donationId: number,
  client: PrismaTx = prisma
) => {
  const members = await (client as typeof prisma).monasteryMember.findMany({
    where: {
      monasterySpaceId: spaceId,
      user: { isDeleted: false },
      monasterySpace: { isDeleted: false },
    },
  });
  const memberRoleIds = members.map(
    (m: { spaceRoleId?: number | null; role?: number | null }) => m.spaceRoleId ?? m.role ?? 0
  );
  const reviewers = await (client as typeof prisma).rolePermission.findMany({
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
  const matchedRoleIds = new Set(reviewers.map((r: { roleId: number }) => r.roleId));

  const managerUserIds = new Set(
    members
      .filter(
        (m: { isOwner?: boolean; spaceRoleId?: number | null; role?: number | null }) =>
          m.isOwner ||
          m.spaceRoleId === SPACE_ROLES.SPACE_ADMIN ||
          matchedRoleIds.has(m.spaceRoleId ?? m.role ?? 0)
      )
      .map((m: { userId: number }) => m.userId)
  );

  for (const targetUserId of managerUserIds) {
    await notifyUser(targetUserId as number, message, donationId, client);
  }
};

// ============================================================================
// Public Catalog Service
// ============================================================================

export const getDonationStatusesService = (): readonly DonationStatusItemDto[] => {
  return DONATION_STATUS_CATALOG;
};

// ============================================================================
// Donation Creation & Requests Services
// ============================================================================

export const requestDonationService = async (
  userId: number,
  data: RequestDonationInput
): Promise<DonationDto> => {
  const spaceId = data.monasterySpaceId;
  if (!spaceId) throw new AppError('Monastery space ID is required', 400);

  const donor = await checkRequestAccess(userId, spaceId);

  const createdRow = await prisma.$transaction(async (tx) => {
    const row = await tx.donorList.create({
      data: {
        monasterySpaceId: spaceId,
        donorId: donor.id,
        donorName: donor.name,
        donationType: typeName(data.donationType),
        donationTypeValue: data.donationType,
        customDonationType: data.customDonationType?.trim() || null,
        note: data.note?.trim() || null,
        amount: data.amount != null ? data.amount : null,
        quantity: data.quantity != null ? data.quantity : null,
        status: statusName(DONATION_STATUS.PendingReview),
        statusValue: DONATION_STATUS.PendingReview,
        pickupTime: data.pickupTime ? new Date(data.pickupTime) : null,
        dropoffTime: data.dropoffTime ? new Date(data.dropoffTime) : null,
      },
    });

    await notifyMonasteryManagers(
      spaceId,
      'A new donation request is waiting for review.',
      row.id,
      tx
    );

    return row;
  });

  return mapDonation(createdRow);
};

export const createManualDonationService = async (
  userId: number,
  data: ManualDonationInput & { monasterySpaceId: number }
): Promise<DonationDto> => {
  const spaceId = data.monasterySpaceId;
  await checkMonasterySpace(spaceId);
  await checkSpacePermission(userId, spaceId, 'Donation.Create');

  const donor = await resolveDonor(data);
  const isScheduled = Boolean(data.pickupTime || data.dropoffTime);
  const initialStatus = isScheduled ? DONATION_STATUS.Scheduled : DONATION_STATUS.Accepted;

  const createdRow = await prisma.$transaction(async (tx) => {
    const row = await tx.donorList.create({
      data: {
        monasterySpaceId: spaceId,
        donorId: donor.id,
        donorName: donor.name,
        donationType: typeName(data.donationType),
        donationTypeValue: data.donationType,
        customDonationType: data.customDonationType?.trim() || null,
        note: data.note?.trim() || null,
        amount: data.amount != null ? data.amount : null,
        quantity: data.quantity != null ? data.quantity : null,
        status: statusName(initialStatus),
        statusValue: initialStatus,
        pickupTime: data.pickupTime ? new Date(data.pickupTime) : null,
        dropoffTime: data.dropoffTime ? new Date(data.dropoffTime) : null,
        reviewerId: userId,
        reviewedAt: new Date(),
      },
    });

    await notifyUser(donor.id, 'Your donation has been recorded by the monastery.', row.id, tx);

    return row;
  });

  return mapDonation(createdRow);
};

export const createBatchDonationsService = async (
  userId: number,
  data: BatchDonationInput & { monasterySpaceId?: number }
): Promise<DonationDto[]> => {
  const spaceId = data.monasterySpaceId;
  if (!spaceId) throw new AppError('Monastery space ID is required', 400);

  await checkMonasterySpace(spaceId);
  await checkSpacePermission(userId, spaceId, 'Donation.Create');

  const rows: DonorList[] = [];
  await prisma.$transaction(async (tx) => {
    for (const item of data.donations) {
      const donor = await resolveDonor(item);
      const notePrefix = data.title?.trim() ? `[Batch: ${data.title.trim()}]` : '';
      const itemNote = item.note?.trim();
      const finalNote = notePrefix
        ? itemNote
          ? `${notePrefix} - ${itemNote}`
          : notePrefix
        : itemNote || null;
      const finalCustomType = item.customDonationType?.trim() || data.title?.trim() || null;

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
  });

  return rows.map(mapDonation);
};

export const requestRecurringDonationService = async (
  userId: number,
  data: RecurringInput & { monasterySpaceId: number }
): Promise<DonationDto[]> => {
  const spaceId = data.monasterySpaceId;
  const donor = await checkRequestAccess(userId, spaceId);

  const slots = recurringDates(data);
  const seriesId = crypto.randomBytes(4).toString('hex');

  const rows: DonorList[] = [];
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const note = `[Series: ${seriesId}] (${i + 1}/${data.monthsCount})${data.note?.trim() ? ` - ${data.note.trim()}` : ''}`;
      const row = await tx.donorList.create({
        data: {
          monasterySpaceId: spaceId,
          donorId: donor.id,
          donorName: donor.name,
          donationType: typeName(data.donationType),
          donationTypeValue: data.donationType,
          customDonationType: data.customDonationType?.trim() || null,
          note,
          amount: data.amount != null ? data.amount : null,
          quantity: data.quantity != null ? data.quantity : null,
          status: statusName(DONATION_STATUS.PendingReview),
          statusValue: DONATION_STATUS.PendingReview,
          pickupTime: slot.pickupTime,
          dropoffTime: slot.dropoffTime,
        },
      });
      rows.push(row);
    }

    if (rows.length > 0) {
      await notifyMonasteryManagers(
        spaceId,
        `New recurring donation series (${slots.length} months) submitted for review.`,
        rows[0].id,
        tx
      );
    }
  });

  return rows.map(mapDonation);
};

export const createManualRecurringDonationService = async (
  userId: number,
  data: ManualRecurringInput & { monasterySpaceId: number }
): Promise<DonationDto[]> => {
  const spaceId = data.monasterySpaceId;
  await checkActorUser(userId);
  await checkMonasterySpace(spaceId);
  await checkSpacePermission(userId, spaceId, 'Donation.Create');

  const donor = await resolveDonor(data);
  const slots = recurringDates(data);
  const seriesId = crypto.randomBytes(4).toString('hex');

  const initialStatus =
    data.pickupTimeOfDay || data.dropoffTimeOfDay
      ? DONATION_STATUS.Scheduled
      : DONATION_STATUS.Accepted;

  const rows: DonorList[] = [];
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const note = `[Series: ${seriesId}] (${i + 1}/${data.monthsCount})${data.note?.trim() ? ` - ${data.note.trim()}` : ''}`;
      const row = await tx.donorList.create({
        data: {
          monasterySpaceId: spaceId,
          donorId: donor.id,
          donorName: donor.name,
          donationType: typeName(data.donationType),
          donationTypeValue: data.donationType,
          customDonationType: data.customDonationType?.trim() || null,
          note,
          amount: data.amount != null ? data.amount : null,
          quantity: data.quantity != null ? data.quantity : null,
          status: statusName(initialStatus),
          statusValue: initialStatus,
          pickupTime: slot.pickupTime,
          dropoffTime: slot.dropoffTime,
          reviewerId: userId,
          reviewedAt: new Date(),
        },
      });
      rows.push(row);
    }

    if (rows.length > 0) {
      await notifyUser(
        donor.id,
        `A recurring donation series (${slots.length} months) was recorded for you.`,
        rows[0].id,
        tx
      );
    }
  });

  return rows.map(mapDonation);
};

// ============================================================================
// Query & Listing Services
// ============================================================================

export const getDonationsService = async (
  userId: number,
  data: DonationQueryInput
): Promise<PaginatedDonationsDto> => {
  const scope = await getVisibleScope(userId, data.monasterySpaceId, data.donorId);
  const where: Prisma.DonorListWhereInput = {
    ...scope,
    ...(data.status !== undefined ? { statusValue: Number(data.status) } : {}),
    ...(data.fromDate || data.toDate
      ? {
          createdAt: {
            ...(data.fromDate ? { gte: new Date(data.fromDate) } : {}),
            ...(data.toDate ? { lte: new Date(data.toDate) } : {}),
          },
        }
      : {}),
  };

  const pageNumber = Number(data.pageNumber) || 1;
  const pageSize = Number(data.pageSize) || 10;
  const skip = (pageNumber - 1) * pageSize;

  const [rows, totalCount] = await Promise.all([
    prisma.donorList.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip,
      take: pageSize,
    }),
    prisma.donorList.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
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
};

export const getDonationsFeedService = async (
  userId: number,
  data: DonationFeedQueryInput
): Promise<CursorPagedDonationsDto> => {
  const scope = await getVisibleScope(userId, data.monasterySpaceId, data.donorId);
  const pageSize = data.pageSize && Number(data.pageSize) > 0 ? Number(data.pageSize) : 15;

  const where: Prisma.DonorListWhereInput = {
    ...scope,
    ...(data.status !== undefined ? { statusValue: Number(data.status) } : {}),
    ...(data.fromDate || data.toDate
      ? {
          createdAt: {
            ...(data.fromDate ? { gte: new Date(data.fromDate) } : {}),
            ...(data.toDate ? { lte: new Date(data.toDate) } : {}),
          },
        }
      : {}),
    ...(data.lastId !== undefined && Number(data.lastId) > 0
      ? { id: { gt: Number(data.lastId) } }
      : {}),
  };

  const rows = await prisma.donorList.findMany({
    where,
    take: pageSize + 1,
    orderBy: { id: 'asc' },
  });

  const hasNextPage = rows.length > pageSize;
  const pagedItems = hasNextPage ? rows.slice(0, pageSize) : rows;
  const nextCursor =
    pagedItems.length > 0 && hasNextPage ? pagedItems[pagedItems.length - 1].id : null;

  return {
    items: pagedItems.map(mapDonation),
    pagination: {
      nextCursor,
      hasNextPage,
      pageSize,
    },
  };
};

export const getDonationByIdService = async (
  userId: number,
  donationId: number,
  spaceId?: number
): Promise<DonationDto> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);
  if (row.donorId !== userId && !(await getMonasteryMember(userId, row.monasterySpaceId))) {
    throw new AppError('Cannot view this donation', 403);
  }
  return mapDonation(row);
};

export const getMonthlyDonationSummaryService = async (
  userId: number,
  data: MonthlyQueryInput
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
}> => {
  const year = Number(data.year);
  const month = Number(data.month);
  const spaceId =
    data.monasterySpaceId !== undefined && data.monasterySpaceId !== null
      ? Number(data.monasterySpaceId)
      : undefined;
  const scope = await getVisibleScope(userId, spaceId);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const range = { gte: start, lt: end };

  const rows = await prisma.donorList.findMany({
    where: {
      ...scope,
      ...(data.status !== undefined ? { statusValue: Number(data.status) } : {}),
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
    year: data.year,
    month: data.month,
    totalDonationsCount: rows.length,
    totalAmount: `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`,
    days: [...days].map(([day, donations]) => ({
      day,
      date: `${data.year}-${String(data.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      donationsCount: donations.length,
      donations,
    })),
  };
};

// ============================================================================
// Single Donation Lifecycle Actions
// ============================================================================

export const reviewDonationService = async (
  userId: number,
  donationId: number,
  data: ReviewDonationInput,
  spaceId?: number
): Promise<DonationDto> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);

  await checkSpacePermission(userId, row.monasterySpaceId, 'Donation.Review');

  const current =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

  if (current === DONATION_STATUS.Completed || current === DONATION_STATUS.Cancelled) {
    throw new AppError('Donation status does not allow this action', 409);
  }

  if (data.status !== DONATION_STATUS.Accepted && data.status !== DONATION_STATUS.Rejected) {
    throw new AppError('Review status must be Accepted (2) or Rejected (3)', 400);
  }

  const now = new Date();
  const nextStatus = data.status;
  const updateData: Prisma.DonorListUncheckedUpdateInput = {
    status: statusName(nextStatus),
    statusValue: nextStatus,
    reviewerId: userId,
    reviewedAt: now,
  };
  if (data.note?.trim()) updateData.note = data.note.trim();

  const guard = {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    statusValue: current,
  };

  const res = await prisma.donorList.updateMany({ where: guard, data: updateData });
  if (res.count !== 1) {
    throw new AppError('Donation changed; reload before retrying', 409);
  }

  const updated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
  const message =
    nextStatus === DONATION_STATUS.Accepted
      ? 'Your donation was accepted.'
      : 'Your donation was rejected.';
  await notifyUser(row.donorId, message, row.id);

  return mapDonation(updated);
};

export const scheduleDonationService = async (
  userId: number,
  donationId: number,
  data: ScheduleDonationInput,
  spaceId?: number
): Promise<DonationDto> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);

  await checkSpacePermission(userId, row.monasterySpaceId, 'Donation.Schedule');

  const current =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

  if (
    current === DONATION_STATUS.Completed ||
    current === DONATION_STATUS.Rejected ||
    current === DONATION_STATUS.Cancelled
  ) {
    throw new AppError('Donation status does not allow this action', 409);
  }

  if (!data.pickupTime && !data.dropoffTime) {
    throw new AppError('Pickup time or dropoff time is required', 400);
  }

  const nextStatus = DONATION_STATUS.Scheduled;
  const updateData: Prisma.DonorListUncheckedUpdateInput = {
    status: statusName(nextStatus),
    statusValue: nextStatus,
    pickupTime: data.pickupTime ? new Date(data.pickupTime) : null,
    dropoffTime: data.dropoffTime ? new Date(data.dropoffTime) : null,
  };
  if (data.note?.trim()) updateData.note = data.note.trim();

  const guard = {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    statusValue: current,
  };

  const res = await prisma.donorList.updateMany({ where: guard, data: updateData });
  if (res.count !== 1) {
    throw new AppError('Donation changed; reload before retrying', 409);
  }

  const updated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
  await notifyUser(row.donorId, 'Your donation pickup/dropoff schedule has been updated.', row.id);

  return mapDonation(updated);
};

export const completeDonationService = async (
  userId: number,
  donationId: number,
  spaceId?: number
): Promise<DonationDto> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);

  await checkSpacePermission(userId, row.monasterySpaceId, 'Donation.Schedule');

  const current =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

  if (current === DONATION_STATUS.Rejected || current === DONATION_STATUS.Cancelled) {
    throw new AppError('Donation status does not allow this action', 409);
  }

  const now = new Date();
  const nextStatus = DONATION_STATUS.Completed;
  const updateData: Prisma.DonorListUncheckedUpdateInput = {
    status: statusName(nextStatus),
    statusValue: nextStatus,
    completedAt: now,
  };

  const guard = {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    statusValue: current,
  };

  const res = await prisma.donorList.updateMany({ where: guard, data: updateData });
  if (res.count !== 1) {
    throw new AppError('Donation changed; reload before retrying', 409);
  }

  const updated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
  await notifyUser(row.donorId, 'Your donation has been completed.', row.id);

  return mapDonation(updated);
};

export const cancelDonationService = async (
  userId: number,
  donationId: number,
  data: CancelDonationInput = {},
  spaceId?: number
): Promise<DonationDto> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);

  if (row.donorId !== userId) {
    await checkSpacePermission(userId, row.monasterySpaceId, 'Donation.Cancel');
  } else {
    const user = await checkActorUser(userId);
    if (!isSystemAdmin(user) && !(await hasSystemPermission(user.roleId, 'Donation.Cancel'))) {
      throw new AppError('Missing space permission: Donation.Cancel', 403);
    }
  }

  const current =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

  if (current === DONATION_STATUS.Completed) {
    throw new AppError('Donation status does not allow this action', 409);
  }

  const nextStatus = DONATION_STATUS.Cancelled;
  const updateData: Prisma.DonorListUncheckedUpdateInput = {
    status: statusName(nextStatus),
    statusValue: nextStatus,
  };
  if (data.note?.trim()) updateData.note = data.note.trim();

  const guard = {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    statusValue: current,
  };

  const res = await prisma.donorList.updateMany({ where: guard, data: updateData });
  if (res.count !== 1) {
    throw new AppError('Donation changed; reload before retrying', 409);
  }

  const updated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
  await notifyUser(row.donorId, 'Your donation has been cancelled.', row.id);

  return mapDonation(updated);
};

export const deleteDonationService = async (
  userId: number,
  donationId: number,
  spaceId?: number
): Promise<boolean> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);

  await checkSpacePermission(userId, row.monasterySpaceId, 'Donation.Delete');

  const current =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

  if (current === DONATION_STATUS.Completed) {
    throw new AppError('Donation status does not allow this action', 409);
  }

  const guard = {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    statusValue: current,
  };

  const res = await prisma.donorList.deleteMany({ where: guard });
  if (res.count !== 1) {
    throw new AppError('Donation changed; reload before retrying', 409);
  }

  return true;
};

export const updateDonationStatusDirectlyService = async (
  userId: number,
  donationId: number,
  data: UpdateDonationStatusInput,
  spaceId?: number
): Promise<DonationDto> => {
  await checkActorUser(userId);
  const row = await prisma.donorList.findFirst({
    where: {
      id: donationId,
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
  });
  if (!row) throw new AppError('Donation not found', 404);

  await checkSpacePermission(userId, row.monasterySpaceId, 'Donation.Review');

  const current =
    typeof row.status === 'number'
      ? row.status
      : ((row as unknown as { statusValue?: number }).statusValue ??
        DONATION_STATUS[row.status as keyof typeof DONATION_STATUS]);

  if (current === DONATION_STATUS.Completed) {
    throw new AppError('Completed donation cannot be modified', 409);
  }

  const now = new Date();
  const nextStatus = data.status;
  const updateData: Prisma.DonorListUncheckedUpdateInput = {
    status: statusName(nextStatus),
    statusValue: nextStatus,
  };

  if (data.note?.trim()) updateData.note = data.note.trim();
  if (nextStatus === DONATION_STATUS.Accepted || nextStatus === DONATION_STATUS.Rejected) {
    updateData.reviewerId = userId;
    updateData.reviewedAt = now;
  } else if (nextStatus === DONATION_STATUS.Completed) {
    updateData.completedAt = now;
  }

  const guard = {
    id: row.id,
    monasterySpaceId: row.monasterySpaceId,
    statusValue: current,
  };

  const res = await prisma.donorList.updateMany({ where: guard, data: updateData });
  if (res.count !== 1) {
    throw new AppError('Donation changed; reload before retrying', 409);
  }

  const updated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
  const message = `Your donation status has been updated to ${statusName(nextStatus)}.`;
  await notifyUser(row.donorId, message, row.id);

  return mapDonation(updated);
};

// ============================================================================
// Recurring Donation Series Services
// ============================================================================

export const reviewDonationSeriesService = async (
  userId: number,
  seriesId: string,
  data: ReviewDonationInput,
  spaceId?: number
): Promise<DonationDto[]> => {
  const rows = await prisma.donorList.findMany({
    where: {
      note: { startsWith: `[Series: ${seriesId}]` },
      ...(spaceId !== undefined ? { monasterySpaceId: spaceId } : {}),
      monasterySpace: { isDeleted: false },
    },
    orderBy: { id: 'asc' },
  });
  if (rows.length === 0) throw new AppError('Donation series not found', 404);

  const first = rows[0];
  await checkSpacePermission(userId, first.monasterySpaceId, 'Donation.Review');

  if (data.status !== DONATION_STATUS.Accepted && data.status !== DONATION_STATUS.Rejected) {
    throw new AppError('Review status must be Accepted (2) or Rejected (3)', 400);
  }

  const nextStatus = data.status;
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
      ? data.note?.trim()
        ? `${seriesMatch} - ${data.note.trim()}`
        : row.note
      : data.note?.trim() || row.note;

    await prisma.donorList.updateMany({
      where: { id: row.id },
      data: {
        status: statusName(nextStatus),
        statusValue: nextStatus,
        reviewerId: userId,
        reviewedAt: now,
        ...(updatedNote ? { note: updatedNote } : {}),
      },
    });
    const rowUpdated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
    results.push(rowUpdated);
  }

  const message =
    nextStatus === DONATION_STATUS.Accepted
      ? 'Your donation was accepted.'
      : 'Your donation was rejected.';
  await notifyUser(first.donorId, message, first.id);

  return results.map(mapDonation);
};

export const cancelDonationSeriesService = async (
  userId: number,
  seriesId: string,
  data: CancelDonationInput = {},
  spaceId?: number
): Promise<DonationDto[]> => {
  const rows = await prisma.donorList.findMany({
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
    await checkSpacePermission(userId, first.monasterySpaceId, 'Donation.Cancel');
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
      ? data.note?.trim()
        ? `${seriesMatch} - [Cancelled] ${data.note.trim()}`
        : row.note
      : data.note?.trim() || row.note;

    await prisma.donorList.updateMany({
      where: { id: row.id },
      data: {
        status: statusName(DONATION_STATUS.Cancelled),
        statusValue: DONATION_STATUS.Cancelled,
        ...(updatedNote ? { note: updatedNote } : {}),
      },
    });
    const rowUpdated = await prisma.donorList.findUniqueOrThrow({ where: { id: row.id } });
    results.push(rowUpdated);
  }

  const message = 'Your donation has been cancelled.';
  await notifyUser(first.donorId, message, first.id);

  return results.map(mapDonation);
};

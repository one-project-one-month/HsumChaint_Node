import { sendPush } from '@/lib/firebase';
import { prisma } from '@/lib/prisma';
import {
  DAY,
  dateStart,
  donationDate,
  localDate,
  localTime,
} from '@/modules/donation/calendar.time';
import { logger } from '@/utils/logger';

// Invitation already uses 1. These values are reserved for this module.
export const REMINDER_TYPES = { donation: 2, pickup: 3, dropoff: 4 } as const;

async function notify(
  userId: number,
  type: number,
  message: string,
  now: Date,
  donationId?: number
) {
  // Serializable transactions make the existing notification row the deduplication marker.
  const created = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, isDeleted: false },
        select: { fcmToken: true },
      });
      if (!user) return null;
      const existing = await tx.notification.findFirst({
        where: {
          userId,
          type,
          message,
          createdAt: {
            gte: dateStart(localDate(now)),
            lt: new Date(dateStart(localDate(now)).getTime() + DAY),
          },
        },
      });
      if (existing) return null;
      await tx.notification.create({ data: { userId, type, message, createdAt: now } });
      return user;
    },
    { isolationLevel: 'Serializable' }
  );
  if (created?.fcmToken) {
    try {
      await sendPush(created.fcmToken, message, {
        type: String(type),
        ...(donationId ? { donationId: String(donationId) } : {}),
      });
    } catch (error) {
      logger.error({ error, userId }, 'Reminder push failed; notification retained');
    }
  }
}

export async function runReminders(now = new Date()) {
  const settings = await prisma.userSetting.findMany({
    where: {
      user: { isDeleted: false },
      OR: [{ pickupNotificationTime: { not: null } }, { dropoffNotificationTime: { not: null } }],
    },
  });
  for (const setting of settings) {
    for (const [kind, time] of [
      ['pickup', setting.pickupNotificationTime],
      ['dropoff', setting.dropoffNotificationTime],
    ] as const) {
      if (time && localTime(time) <= localTime(now)) {
        await notify(
          setting.userId,
          REMINDER_TYPES[kind],
          `${localDate(now)}: Time to go for ${kind}.`,
          now
        );
      }
    }
  }
  const tomorrow = new Date(dateStart(localDate(now)).getTime() + DAY);
  const end = new Date(tomorrow.getTime() + 2 * DAY);
  const rows = await prisma.donorList.findMany({
    where: {
      status: { in: ['Accepted', 'Scheduled'] },
      monasterySpace: { isDeleted: false },
      OR: [
        { pickupTime: { gte: tomorrow, lt: end } },
        { pickupTime: null, dropoffTime: { gte: tomorrow, lt: end } },
      ],
    },
    include: {
      monasterySpace: {
        include: {
          members: {
            where: {
              OR: [{ isOwner: true }, { spaceRoleId: { in: [1, 2] } }],
              user: { isDeleted: false },
            },
          },
        },
      },
    },
  });
  for (const row of rows) {
    const date = localDate(donationDate(row));
    const days = Math.round(
      (dateStart(date).getTime() - dateStart(localDate(now)).getTime()) / DAY
    );
    const recipients = new Set([
      ...(row.donorId === null ? [] : [row.donorId]),
      ...row.monasterySpace.members.map((member) => member.userId),
    ]);
    for (const userId of recipients) {
      await notify(
        userId,
        REMINDER_TYPES.donation,
        `Donation #${row.id} on ${date} is in ${days} day(s).`,
        now,
        row.id
      );
    }
  }
}

export function startDonationReminders() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runReminders();
    } catch (error) {
      logger.error({ error }, 'Donation reminder job failed');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

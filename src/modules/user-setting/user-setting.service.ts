import { prisma } from '@/lib/prisma';
import type { SettingInput, UpdateUserSettingBodyInput } from './user-setting.schema';

export const encodeTime = (time: string) => new Date(`1970-01-01T${time}:00+06:30`);

export async function saveSetting(userId: number, input: SettingInput = {}) {
  const data = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === null ? null : encodeTime(value)])
  );
  const row = await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return {
    id: row.id,
    userId: row.userId,
    ...Object.fromEntries(
      Object.keys({
        pickupTime: 0,
        dropoffTime: 0,
        pickupNotificationTime: 0,
        dropoffNotificationTime: 0,
      }).map((key) => {
        const value = row[key as keyof SettingInput];
        return [
          key,
          value ? new Date(value.getTime() + 390 * 60_000).toISOString().slice(11, 16) : null,
        ];
      })
    ),
  };
}

export const getUserSettingService = async (userId: number) => {
  return saveSetting(userId);
};

export const updateUserSettingService = async (
  userId: number,
  input: UpdateUserSettingBodyInput
) => {
  return saveSetting(userId, input);
};

import { z } from 'zod';

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

export const settingBody = z.strictObject({
  pickupTime: time.optional(),
  dropoffTime: time.optional(),
  pickupNotificationTime: time.optional(),
  dropoffNotificationTime: time.optional(),
});

export const updateUserSettingSchema = z.object({
  body: settingBody,
});

export type SettingInput = z.infer<typeof settingBody>;
export type UpdateUserSettingBodyInput = z.infer<typeof updateUserSettingSchema>['body'];

import { z } from 'zod';

export const NOTIFICATION_TYPE = {
  Invitation: 1,
  DonationReminder: 2,
  PickupWarning: 3,
  DropoffWarning: 4,
  Donation: 5,
  DonationAccepted: 5,
} as const;

export type NotificationTypeName = keyof typeof NOTIFICATION_TYPE;
export type NotificationTypeCode = (typeof NOTIFICATION_TYPE)[NotificationTypeName];

export const NOTIFICATION_TYPE_NAME_MAP: Record<string, number> = {
  Invitation: 1,
  DonationReminder: 2,
  PickupWarning: 3,
  DropoffWarning: 4,
  Donation: 5,
  DonationAccepted: 5,
  DonationRejected: 5,
  DonationScheduled: 5,
  DonationCompleted: 5,
  DonationCancelled: 5,
};

export const resolveNotificationType = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = Number(val);
    if (!Number.isNaN(num) && val.trim() !== '') return num;
    if (val in NOTIFICATION_TYPE_NAME_MAP) return NOTIFICATION_TYPE_NAME_MAP[val];
  }
  return NOTIFICATION_TYPE.DonationReminder;
};

export const createNotificationSchema = z.object({
  body: z
    .object({
      userId: z.coerce.number().int().positive().optional(),
      type: z.union([z.string(), z.number()]).optional(),
      notificationType: z.union([z.string(), z.number()]).optional(),
      message: z
        .string()
        .trim()
        .min(1, 'Message is required')
        .max(1000, 'Message cannot exceed 1000 characters'),
      title: z.string().trim().max(255).optional(),
      fcmToken: z.string().trim().optional(),
    })
    .transform((data) => {
      const type = resolveNotificationType(data.notificationType ?? data.type);
      return {
        ...data,
        type,
      };
    }),
});

export const getNotificationsQueryInputSchema = z
  .object({
    pageNumber: z.coerce.number().int().min(1).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    isRead: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((val) => (typeof val === 'boolean' ? val : val === 'true'))
      .optional(),
    type: z.coerce.number().int().optional(),
    notificationType: z.union([z.string(), z.number()]).optional(),
  })
  .transform((data) => {
    const pageNumber = data.pageNumber ?? data.page ?? 1;
    const pageSize = data.pageSize ?? data.limit ?? 10;
    const type =
      data.type ??
      (data.notificationType !== undefined
        ? resolveNotificationType(data.notificationType)
        : undefined);
    return {
      ...data,
      pageNumber,
      pageSize,
      page: pageNumber,
      limit: pageSize,
      type,
    };
  });

export const getNotificationsSchema = z.object({
  query: getNotificationsQueryInputSchema,
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, 'ID must be a number')
      .transform(Number)
      .refine((val) => !Number.isNaN(val) && val > 0, 'ID must be a valid positive number'),
  }),
});

export const markNotificationAsReadSchema = z.object({
  body: z.object({
    notificationId: z.coerce.number().int().positive('Notification ID must be a positive number'),
    userId: z.coerce.number().int().positive('User ID must be a positive number').optional(),
  }),
});

export const deleteNotificationSchema = z.object({
  body: z.object({
    notificationId: z.coerce.number().int().positive('Notification ID must be a positive number'),
    userId: z.coerce.number().int().positive('User ID must be a positive number').optional(),
  }),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>['body'];
export type GetNotificationsQueryInput = z.infer<typeof getNotificationsSchema>['query'];
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>['params'];
export type MarkNotificationAsReadInput = z.infer<typeof markNotificationAsReadSchema>['body'];
export type DeleteNotificationInput = z.infer<typeof deleteNotificationSchema>['body'];

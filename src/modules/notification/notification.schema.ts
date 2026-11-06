import { z } from 'zod';
import { PaginationQuerySchema } from '@/helper/paginationSchema';

export const NOTIFICATION_TYPE = {
  Invitation: 1,
  DonationReminder: 2,
  PickupWarning: 3,
  DropoffWarning: 4,
  Donation: 5,
} as const;

export type NotificationTypeName = keyof typeof NOTIFICATION_TYPE;
export type NotificationTypeCode = (typeof NOTIFICATION_TYPE)[NotificationTypeName];

export const createNotificationSchema = z.object({
  body: z.object({
    userId: z.coerce.number().int().positive().optional(),
    type: z.coerce.number().int().optional().default(NOTIFICATION_TYPE.DonationReminder),
    message: z
      .string()
      .trim()
      .min(1, 'Message is required')
      .max(1000, 'Message cannot exceed 1000 characters'),
    title: z.string().trim().max(255).optional(),
  }),
});

export const getNotificationsSchema = z.object({
  query: PaginationQuerySchema.extend({
    isRead: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((val) => (typeof val === 'boolean' ? val : val === 'true'))
      .optional(),
    type: z.coerce.number().int().optional(),
  }),
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
  params: notificationIdParamSchema.shape.params,
  body: z
    .object({
      isRead: z.boolean().optional().default(true),
    })
    .optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>['body'];
export type GetNotificationsQueryInput = z.infer<typeof getNotificationsSchema>['query'];
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>['params'];
export type MarkNotificationAsReadInput = z.infer<typeof markNotificationAsReadSchema>['body'];

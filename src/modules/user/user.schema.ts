import { z } from 'zod';
import { passwordSchema, phoneSchema } from '../auth/auth.schema';

export const UserSchema = z.object({
  id: z.number().describe('The user ID'),
  phone: z.string().describe('The user phone number'),
  name: z.string().describe('The user name'),
  email: z.string().email().nullable().describe('The user email address'),
  roleId: z.number().describe('The user role ID'),
  createdAt: z.date().describe('The user creation date'),
});

export const CreateUserSchema = z.object({
  phone: z.string().describe('The user phone number'),
  name: z.string().describe('The user name'),
  email: z.string().email().optional().describe('The user email address'),
  password: z.string().describe('The user password'),
  roleId: z.number().describe('The user role ID'),
});

const normalizePhoneSearch = z
  .string()
  .trim()
  .transform((value) => {
    // remove non-digits
    const cleaned = value.replace(/\D/g, '');
    // normalize Myanmar formats
    if (cleaned.startsWith('959')) return `09${cleaned.slice(3)}`;
    if (cleaned.startsWith('09')) return cleaned;
    return cleaned;
  })
  .optional();

export const getAllUsersSchema = z.object({
  query: z
    .object({
      pageNumber: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().optional(),
      pageSize: z.coerce.number().int().positive().max(100).optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      search: z.string().trim().optional(),
      name: z.string().trim().optional(),
      email: z.string().trim().toLowerCase().optional(),
      phoneNumber: normalizePhoneSearch,
      phone: normalizePhoneSearch,
      contactPhoneNumber: normalizePhoneSearch,
      contactPhone: normalizePhoneSearch,
      roleId: z.coerce.number().int().positive().optional(),
      monasteryName: z.string().optional(),
      monasteryAddress: z.string().optional(),
    })
    .transform((q) => {
      const page = q.page ?? q.pageNumber ?? 1;
      const limit = q.limit ?? q.pageSize ?? 10;
      return {
        ...q,
        page,
        limit,
        pageNumber: page,
        pageSize: limit,
        name: q.name ?? q.search,
        phone: q.phone ?? q.phoneNumber,
        contactPhone: q.contactPhone ?? q.contactPhoneNumber,
      };
    }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z
      .string()
      .regex(/^\d+$/, 'ID must be a number')
      .transform(Number)
      .refine((val) => !Number.isNaN(val), 'ID must be a valid number'),
  }),
});

export const updateUserSchema = z.object({
  params: z
    .object({
      id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number).optional(),
    })
    .optional(),
  body: z
    .object({
      id: z.coerce.number().int().positive().optional(),
      name: z.string().trim().min(3, 'Name must be at least 3 characters').optional(),
      phoneNumber: phoneSchema.optional(),
      phone: phoneSchema.optional(),
      email: z.string().trim().toLowerCase().email('Invalid email').optional(),
      avatar: z.string().optional(),
      contactPhoneNumber: phoneSchema.optional(),
      contactPhone: phoneSchema.optional(),
      roleId: z.coerce.number().int().positive().optional(),
      monasteryName: z.string().min(3, 'Monastery name must be at least 3 characters').optional(),
      monasteryAddress: z
        .string()
        .min(3, 'Monastery Address must be at least 3 characters')
        .optional(),
      oldPassword: z.string().optional(),
      newPassword: passwordSchema.optional(),
    })
    .refine(
      (data) => {
        if (data.newPassword && !data.oldPassword) return false;
        return true;
      },
      {
        message: 'Your old password is required to change new password',
        path: ['oldPassword'],
      }
    )
    .transform((b) => ({
      ...b,
      phone: b.phone ?? b.phoneNumber,
      phoneNumber: b.phoneNumber ?? b.phone,
      contactPhone: b.contactPhone ?? b.contactPhoneNumber,
      contactPhoneNumber: b.contactPhoneNumber ?? b.contactPhone,
    })),
});

export const userSubResourcePaginationSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  query: z
    .object({
      pageNumber: z.coerce.number().int().positive().optional().default(1),
      pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .transform((q) => {
      const pageNumber = q.page ?? q.pageNumber;
      const pageSize = q.limit ?? q.pageSize;
      return {
        pageNumber,
        pageSize,
      };
    }),
});

export const userFeedPaginationSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  query: z
    .object({
      lastId: z.coerce.number().int().positive().optional(),
      LastId: z.coerce.number().int().positive().optional(),
      pageSize: z.coerce.number().int().positive().max(100).optional().default(15),
      PageSize: z.coerce.number().int().positive().max(100).optional(),
    })
    .transform((q) => ({
      lastId: q.lastId ?? q.LastId,
      pageSize: q.PageSize ?? q.pageSize,
    })),
});

export const updateMonkProfileSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    monasteryName: z.string().trim().min(2, 'Monastery name must be at least 2 characters'),
    monasteryAddress: z.string().trim().min(3, 'Monastery address must be at least 3 characters'),
  }),
});

export const updateUserSettingsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
  }),
  body: z.object({
    pickupNotificationTime: z.string().nullable().optional(),
    dropoffNotificationTime: z.string().nullable().optional(),
    pickupTime: z.string().nullable().optional(),
    dropoffTime: z.string().nullable().optional(),
  }),
});

export type getAllUsersInput = z.infer<typeof getAllUsersSchema>['query'];
export type idParamsInput = z.infer<typeof idParamSchema>['params'];
export type updateUserBodyInput = z.infer<typeof updateUserSchema>['body'];
export type userSubResourcePaginationInput = z.infer<
  typeof userSubResourcePaginationSchema
>['query'];
export type userFeedPaginationInput = z.infer<typeof userFeedPaginationSchema>['query'];
export type updateMonkProfileBodyInput = z.infer<typeof updateMonkProfileSchema>['body'];
export type updateUserSettingsBodyInput = z.infer<typeof updateUserSettingsSchema>['body'];

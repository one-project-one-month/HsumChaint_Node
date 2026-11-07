import { z } from 'zod';

// handles 09, 959, and +959
const myanmarPhoneRegex = /^(09|\+?959)\d{7,9}$/;
export const phoneSchema = z
  .string('Phone number is required')
  .trim()
  .regex(myanmarPhoneRegex, 'Invalid phone number')
  .transform((value) => {
    if (value.startsWith('+959')) return `09${value.slice(4)}`;
    if (value.startsWith('959')) return `09${value.slice(3)}`;
    return value;
  });

export const passwordSchema = z
  .string('password is required')
  .min(6, 'password must be at least 6 characters');

const normalizePhoneFields = (data: unknown) => {
  if (data && typeof data === 'object') {
    const obj = { ...(data as Record<string, unknown>) };
    if (!obj.phone && typeof obj.phoneNumber === 'string') {
      obj.phone = obj.phoneNumber;
    }
    if (!obj.phone && typeof obj.identifier === 'string') {
      obj.phone = obj.identifier;
    }
    if (!obj.contactPhone && typeof obj.contactPhoneNumber === 'string') {
      obj.contactPhone = obj.contactPhoneNumber;
    }
    return obj;
  }
  return data;
};

export const registerSchema = z.object({
  body: z
    .preprocess(
      normalizePhoneFields,
      z.object({
        phone: phoneSchema,
        phoneNumber: z.string().optional(),
        name: z.string('name is required').trim().min(3, 'Name must be at least 3 characters'),
        email: z.string().trim().toLowerCase().email('Invalid email').optional(),
        contactPhone: phoneSchema.optional(),
        contactPhoneNumber: z.string().optional(),
        avatar: z.string().optional(),
        password: passwordSchema,
        // System roles: 1: Monk, 2: Donor
        roleId: z.coerce.number().int().positive(),
        monasteryName: z.string().optional(),
        monasteryAddress: z.string().optional(),
        fcmToken: z.string().optional(),
      })
    )
    .superRefine((data, ctx) => {
      // Role ID 1 is Monk in current system state
      if (data.roleId === 1) {
        if (!data.monasteryName || data.monasteryName.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Monastery name is required',
            path: ['monasteryName'],
          });
        }
        if (!data.monasteryAddress || data.monasteryAddress.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Monastery address is required',
            path: ['monasteryAddress'],
          });
        }
      }

      // Role ID 2 is Donor: Donors cannot add monastery name or address
      if (data.roleId === 2) {
        if (
          (data.monasteryName && data.monasteryName.trim() !== '') ||
          (data.monasteryAddress && data.monasteryAddress.trim() !== '')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Donors cannot have monastery name or monastery address',
            path: ['monasteryName'],
          });
        }
      }

      // Any role other than 1 or 2 (Public registration only allows Monk: 1 or Donor: 2)
      if (data.roleId !== 1 && data.roleId !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: data.roleId === 3 ? 'Forbidden' : 'Invalid role',
          path: ['roleId'],
        });
      }
    }),
});

export const loginSchema = z.object({
  body: z.preprocess(
    normalizePhoneFields,
    z.object({
      phone: phoneSchema,
      phoneNumber: z.string().optional(),
      identifier: z.string().optional(),
      password: passwordSchema,
    })
  ),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    userId: z.coerce.number({ error: 'userId is required' }),
    refreshToken: z
      .string({ error: 'refreshToken is required' })
      .min(1, 'refreshToken is required'),
  }),
});

export const logoutSchema = z
  .object({
    body: z.object({
      refreshToken: z.string().optional(),
      userId: z.coerce.number().optional(),
    }),
    cookies: z.object({
      refreshToken: z.string().optional(),
    }),
  })
  .refine((data) => data.body.refreshToken || data.cookies.refreshToken, {
    message: 'Refresh token is required',
    path: ['refreshToken'],
  });

export const forgotPasswordSchema = z.object({
  body: z.preprocess(
    normalizePhoneFields,
    z.object({
      phone: phoneSchema,
      phoneNumber: z.string().optional(),
    })
  ),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1),
    password: passwordSchema,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type LogoutInput = z.infer<typeof logoutSchema>['body'];
export type forgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type resetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];

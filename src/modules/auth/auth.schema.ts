import { z } from 'zod';
//handles 09, 959, and +959
const myanmarPhoneRegex = /^(09|\+?959)\d{7,9}$/;
const phoneSchema = z
  .string('Phone number is required')
  .trim()
  .regex(myanmarPhoneRegex, 'Invalid phone number')
  .transform((value) => {
    if (value.startsWith('+959')) return `09${value.slice(4)}`;
    if (value.startsWith('959')) return `09${value.slice(3)}`;
    return value;
  });
const passwordSchema = z
  .string('password is required')
  .min(6, 'password must be at least 6 characters');
export const registerSchema = z.object({
  body: z
    .object({
      phone: phoneSchema,
      username: z
        .string('username is required')
        .trim()
        .min(3, 'Username must be at least 3 characters'),
      email: z.string().trim().toLowerCase().email('Invalid email').optional(),
      contactPhone: phoneSchema.optional(),
      password: passwordSchema,
      userType: z.enum(['Monk', 'Donor']),
      monasteryName: z.string().optional(),
      monasteryAddress: z.string().optional(),
      fcmToken: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.userType === 'Monk') {
        //add custom issue to monasteryName
        if (!data.monasteryName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Monastery name is required',
            path: ['monasteryName'],
          });
        }
        //add custom issue to monasteryAddress
        if (!data.monasteryAddress) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Monastery address is required',
            path: ['monasteryAddress'],
          });
        }
      }
    }),
});
export const loginSchema = z.object({
  body: z
    .object({
      phone: phoneSchema,
      password: passwordSchema,
    })
    .strict(),
});
export const refreshTokenSchema = z
  .object({
    body: z.object({
      refreshToken: z.string().optional(),
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
  body: z.object({
    phone: phoneSchema,
  }),
});
export const resetPasswordSchema = z.object({
  body: z.object({
    resetToken: z.string().min(1),
    password: passwordSchema,
  }),
});
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type forgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type resetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];

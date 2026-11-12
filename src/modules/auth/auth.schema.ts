import { z } from 'zod';

// Handles Myanmar phone numbers: 09, 959, and +959
export const myanmarPhoneRegex = /^(09|\+?959)\d{7,9}$/;

export const phoneSchema = z
  .string({ error: 'Phone number is required' })
  .trim()
  .regex(myanmarPhoneRegex, 'Invalid phone number')
  .transform((val) => {
    if (val.startsWith('+959')) return `09${val.slice(4)}`;
    if (val.startsWith('959')) return `09${val.slice(3)}`;
    return val;
  });

export const passwordSchema = z
  .string({ error: 'password is required' })
  .min(6, 'password must be at least 6 characters');

// ==========================================
// 1.1 Request Registration OTP Schema
// ==========================================
export const requestRegistrationOtpSchema = z.object({
  body: z.object({
    destination: z.string().trim().toLowerCase().email('Invalid email address'),
  }),
});

// ==========================================
// 1. Register User Schema (with Atomic Verification & Auto-Login)
// ==========================================
export const registerSchema = z.object({
  body: z
    .object({
      name: z
        .string({ error: 'name is required' })
        .trim()
        .min(3, 'Name must be at least 3 characters'),
      phoneNumber: phoneSchema.optional(),
      email: z.string().trim().toLowerCase().email('Invalid email').optional(),
      contactPhoneNumber: phoneSchema.optional(),
      avatar: z.string().optional(),
      password: passwordSchema,
      // Roles in .NET C# spec: 1: Admin, 2: Monk, 3: Regular User (Donor)
      roleId: z.coerce.number().int().positive(),
      monasteryName: z.string().optional(),
      monasteryAddress: z.string().optional(),
      fcmToken: z.string().optional(),
      otp: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      // Must provide at least one identifier
      if (!data.phoneNumber && !data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Either phone number or email is required',
          path: ['phoneNumber'],
        });
      }

      // Role ID 2 is Monk: requires monastery details
      if (data.roleId === 2) {
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

      // Role ID 3 is Regular User (Donor): Donors cannot have monastery name or address
      if (data.roleId === 3) {
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

      // Role ID 1 is Admin: Protected role
      if (data.roleId !== 2 && data.roleId !== 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: data.roleId === 1 ? 'Forbidden' : 'Invalid role',
          path: ['roleId'],
        });
      }
    }),
});

// ==========================================
// 2. Login Schema (supports identifier, email, or phone)
// ==========================================
export const loginSchema = z.object({
  body: z
    .object({
      identifier: z.string().trim().optional(),
      phoneNumber: phoneSchema.optional(),
      password: passwordSchema,
    })
    .superRefine((data, ctx) => {
      const id = data.identifier || data.phoneNumber;
      if (!id || id.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Identifier or phone number is required',
          path: ['identifier'],
        });
      }
    }),
});

// ==========================================
// 3. Refresh Token Schema
// ==========================================
export const refreshTokenSchema = z.object({
  body: z.object({
    userId: z.coerce.number({ error: 'userId is required' }),
    refreshToken: z
      .string({ error: 'refreshToken is required' })
      .min(1, 'refreshToken is required'),
  }),
});

// ==========================================
// Logout Schema
// ==========================================
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

// ==========================================
// 3.1 Forgot Password Schema
// ==========================================
export const forgotPasswordSchema = z.object({
  body: z
    .object({
      destination: z.string().trim().optional(),
      phoneNumber: phoneSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const dest = data.destination || data.phoneNumber;
      if (!dest || dest.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Destination or phone number is required',
          path: ['destination'],
        });
      }
    }),
});

// ==========================================
// 3.2 Reset Password Schema
// ==========================================
export const resetPasswordSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().optional(),
      otp: z.string().trim().optional(),
      newPassword: passwordSchema.optional(),
      resetToken: z.string().optional(),
      password: passwordSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (data.email && data.otp) {
        if (!data.newPassword) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'newPassword is required',
            path: ['newPassword'],
          });
        }
      } else if (data.resetToken) {
        if (!data.password) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'password is required',
            path: ['password'],
          });
        }
      } else {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Either (email, otp, newPassword) or (resetToken, password) is required',
          path: ['email'],
        });
      }
    }),
});

// ==========================================
// 3.3 Request Change Password OTP Schema
// ==========================================
export const requestChangePasswordOtpSchema = z.object({
  body: z.object({}).optional(),
});

// ==========================================
// 3.4 Change Password Schema
// ==========================================
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    otp: z.string().trim().min(6, 'OTP must be 6 digits'),
  }),
});

// ==========================================
// 3.5 Standalone OTP Schemas
// ==========================================
export const requestOtpSchema = z.object({
  body: z.object({
    destination: z.string().trim().min(1, 'destination is required'),
    channel: z.enum(['EMAIL', 'PHONE']).default('EMAIL'),
    purpose: z.enum(['VERIFY_EMAIL', 'VERIFY_PHONE', 'LOGIN', 'RESET_PASSWORD', 'CHANGE_PASSWORD']),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    destination: z.string().trim().min(1, 'destination is required'),
    channel: z.enum(['EMAIL', 'PHONE']).default('EMAIL'),
    purpose: z.enum(['VERIFY_EMAIL', 'VERIFY_PHONE', 'LOGIN', 'RESET_PASSWORD', 'CHANGE_PASSWORD']),
    code: z.string().trim().min(6, 'code must be 6 digits'),
  }),
});

// ==========================================
// Inferred Types
// ==========================================
export type RequestRegistrationOtpInput = z.infer<typeof requestRegistrationOtpSchema>['body'];
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type LogoutInput = z.infer<typeof logoutSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type RequestOtpInput = z.infer<typeof requestOtpSchema>['body'];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>['body'];

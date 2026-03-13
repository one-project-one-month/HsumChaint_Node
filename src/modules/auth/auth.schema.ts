import { z } from 'zod';
//handles 09, 959, and +959
const myanmarPhoneRegex = /^(09|\+?959)\d{7,9}$/;
export const registerSchema = z.object({
  body: z.object({
    phone: z
      .string('Phone number is required')
      .trim()
      .regex(myanmarPhoneRegex, 'Invalid phone number')
      .transform((value) => {
        if (value.startsWith('+959')) return '09' + value.slice(4);
        if (value.startsWith('959')) return '09' + value.slice(3);
        return value;
      }),
    username: z
      .string('username is required')
      .trim()
      .min(3, 'Username must be at least 3 characters'),
    email: z.string().trim().toLowerCase().email('Invalid email').optional(),
    password: z.string('password is required').min(6, 'password must be at least 6 characters'),
    userType: z.enum(['Monk', 'Donor']),
    fcmToken: z.string().optional(),
  }),
});
export type RegisterInput = z.infer<typeof registerSchema>['body'];

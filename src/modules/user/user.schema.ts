import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number().describe('The user ID'),
  email: z.email().describe('The user email address'),
  name: z.string().optional().describe('The user name'),
});

export const CreateUserSchema = z.object({
  email: z.email().describe('The user email address'),
  name: z.string().optional().describe('The user name'),
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;

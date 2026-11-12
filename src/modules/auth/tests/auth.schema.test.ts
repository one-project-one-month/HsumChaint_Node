import { describe, expect, it } from 'bun:test';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from '../auth.schema';

describe('public registration roles (.NET C# spec: 1=Admin, 2=Monk, 3=Donor)', () => {
  const body = { name: 'Test User', phoneNumber: '09123456789', password: 'Password123!' };

  it('accepts donors (roleId: 3)', () => {
    expect(registerSchema.safeParse({ body: { ...body, roleId: 3 } }).success).toBe(true);
  });

  it('accepts monks with monastery information (roleId: 2)', () => {
    const monkPayload = {
      name: 'U Thuzana',
      phoneNumber: '09100000001',
      password: 'Password123!',
      roleId: 2,
      monasteryName: 'Mahasi Yeiktha',
      monasteryAddress: 'Bahan, Yangon',
      contactPhoneNumber: '09100000001',
    };
    const result = registerSchema.safeParse({ body: monkPayload });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.phoneNumber).toBe('09100000001');
      expect(result.data.body.contactPhoneNumber).toBe('09100000001');
    }
  });

  it('rejects monk with roleId: 2 missing monastery information', () => {
    expect(registerSchema.safeParse({ body: { ...body, roleId: 2 } }).success).toBe(false);
  });

  it('rejects arbitrary, non-integer, and admin role IDs (roleId: 1)', () => {
    for (const roleId of [0, 1, 4, -1, 1.5, 99]) {
      expect(registerSchema.safeParse({ body: { ...body, roleId } }).success).toBe(false);
    }
  });

  it('normalizes phoneNumber in loginSchema', () => {
    const parsed = loginSchema.safeParse({
      body: { phoneNumber: '+959123456789', password: 'Password123!' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body.phoneNumber).toBe('09123456789');
    }
  });

  it('accepts userId and refreshToken in refreshTokenSchema', () => {
    const parsed = refreshTokenSchema.safeParse({
      body: { userId: 2, refreshToken: 'sample-token' },
      cookies: {},
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body.userId).toBe(2);
      expect(parsed.data.body.refreshToken).toBe('sample-token');
    }
  });

  it('normalizes phoneNumber in forgotPasswordSchema', () => {
    const parsed = forgotPasswordSchema.safeParse({
      body: { phoneNumber: '959123456789' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body.phoneNumber).toBe('09123456789');
    }
  });
});

it('retains required-field messages for refresh requests with Zod v4', () => {
  for (const field of ['userId', 'refreshToken']) {
    const body: Record<string, unknown> = { userId: 2, refreshToken: 'sample-token' };
    delete body[field];
    const parsed = refreshTokenSchema.safeParse({ body });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(`${field} is required`);
    }
  }
});

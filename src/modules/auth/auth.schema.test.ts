import { describe, expect, it } from 'bun:test';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from './auth.schema';

describe('public registration roles (current system state: 1=Monk, 2=Donor, 3=Admin)', () => {
  const body = { name: 'Test User', phone: '09123456789', password: 'Password123!' };

  it('accepts donors (roleId: 2)', () => {
    expect(registerSchema.safeParse({ body: { ...body, roleId: 2 } }).success).toBe(true);
  });

  it('accepts monks with monastery information (roleId: 1)', () => {
    const result = registerSchema.safeParse({
      body: {
        name: 'U Thuzana',
        phoneNumber: '09100000001',
        password: 'Password123!',
        roleId: 1,
        monasteryName: 'Mahasi Yeiktha',
        monasteryAddress: 'Bahan, Yangon',
        contactPhoneNumber: '09100000001',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.phone).toBe('09100000001');
      expect(result.data.body.contactPhone).toBe('09100000001');
    }
  });

  it('rejects monk with roleId: 1 missing monastery information', () => {
    expect(registerSchema.safeParse({ body: { ...body, roleId: 1 } }).success).toBe(false);
  });

  it('rejects arbitrary, non-integer, and admin role IDs (roleId: 3)', () => {
    for (const roleId of [0, 3, 4, -1, 1.5, 99]) {
      expect(registerSchema.safeParse({ body: { ...body, roleId } }).success).toBe(false);
    }
  });

  it('normalizes phoneNumber in loginSchema', () => {
    const parsed = loginSchema.safeParse({
      body: { phoneNumber: '+959123456789', password: 'Password123!' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body.phone).toBe('09123456789');
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
      expect(parsed.data.body.phone).toBe('09123456789');
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { env } from '@/config/env';
import { resetEmailTransporter, sendOtpEmail } from '../email.service';

describe('Email Service (Nodemailer)', () => {
  const originalEnv = {
    NODE_ENV: env.NODE_ENV,
    SMTP_HOST: env.SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT,
    SMTP_SECURE: env.SMTP_SECURE,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
    SMTP_FROM: env.SMTP_FROM,
  };

  let createTransportSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    resetEmailTransporter();
    env.NODE_ENV = 'development';
    env.SMTP_HOST = 'smtp.gmail.com';
    env.SMTP_PORT = 587;
    env.SMTP_SECURE = false;
    env.SMTP_USER = 'sender@gmail.com';
    env.SMTP_PASS = 'app-password-1234';
    env.SMTP_FROM = 'HsumChaint <sender@gmail.com>';
  });

  afterEach(() => {
    createTransportSpy?.mockRestore();
    createTransportSpy = null;
    resetEmailTransporter();
    Object.assign(env, originalEnv);
  });

  it('skips SMTP transport when NODE_ENV is test', async () => {
    env.NODE_ENV = 'test';
    const sendMail = mock(async () => ({ messageId: 'msg-1' }));
    createTransportSpy = spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
    } as never);

    await sendOtpEmail({
      to: 'recipient@gmail.com',
      otp: '123456',
      purpose: 'VERIFY_EMAIL',
    });

    expect(createTransportSpy).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('skips SMTP transport when SMTP credentials are missing', async () => {
    env.SMTP_PASS = undefined;
    const sendMail = mock(async () => ({ messageId: 'msg-2' }));
    createTransportSpy = spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
    } as never);

    await sendOtpEmail({
      to: 'recipient@gmail.com',
      otp: '123456',
      purpose: 'VERIFY_EMAIL',
    });

    expect(createTransportSpy).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('creates Nodemailer transporter and sends OTP email with HTML and text', async () => {
    const sendMail = mock(async (_options: SendMailOptions) => ({ messageId: 'msg-123' }));
    createTransportSpy = spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
    } as never);

    await sendOtpEmail({
      to: 'donor@gmail.com',
      otp: '482910',
      purpose: 'RESET_PASSWORD',
      expiryMinutes: 5,
    });

    expect(createTransportSpy).toHaveBeenCalledTimes(1);
    expect(createTransportSpy).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'sender@gmail.com',
        pass: 'app-password-1234',
      },
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mailOptions = sendMail.mock.calls[0]?.[0];
    expect(mailOptions).toBeDefined();
    expect(mailOptions?.from).toBe('HsumChaint <sender@gmail.com>');
    expect(mailOptions?.to).toBe('donor@gmail.com');
    expect(mailOptions?.subject).toBe('Reset your HsumChaint password');
    expect(String(mailOptions?.text)).toContain('482910');
    expect(String(mailOptions?.html)).toContain('482910');

    // Second send reuses the cached transporter
    await sendOtpEmail({
      to: 'donor2@gmail.com',
      otp: '999111',
      purpose: 'VERIFY_EMAIL',
    });
    expect(createTransportSpy).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('rethrows errors from transporter.sendMail', async () => {
    const sendMail = mock(async () => {
      throw new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
    });
    createTransportSpy = spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail,
    } as never);

    await expect(
      sendOtpEmail({
        to: 'donor@gmail.com',
        otp: '482910',
        purpose: 'VERIFY_EMAIL',
      })
    ).rejects.toThrow('Invalid login');
  });
});

import nodemailer, {
  type SendMailOptions,
  type SMTPSentMessageInfo,
  type SMTPTransportOptions,
  type Transporter,
} from 'nodemailer';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

export const OTP_SUBJECT_MAP: Record<string, string> = {
  VERIFY_EMAIL: 'Verify your HsumChaint email',
  RESET_PASSWORD: 'Reset your HsumChaint password',
  CHANGE_PASSWORD: 'Verify change of your HsumChaint password',
  LOGIN: 'Your HsumChaint login code',
};

const OTP_COPY_MAP: Record<string, { heading: string; description: string }> = {
  VERIFY_EMAIL: {
    heading: 'Email Verification',
    description: 'Enter the verification code below to verify your email address for HsumChaint.',
  },
  RESET_PASSWORD: {
    heading: 'Reset Your Password',
    description: 'Enter the verification code below to reset your HsumChaint account password.',
  },
  CHANGE_PASSWORD: {
    heading: 'Confirm Password Change',
    description: 'Enter the verification code below to confirm changing your HsumChaint password.',
  },
  LOGIN: {
    heading: 'OTP Verification',
    description:
      'Enter the one-time verification code below to sign in to your HsumChaint account.',
  },
};

export const getOtpEmailSubject = (purpose: string): string => {
  return OTP_SUBJECT_MAP[purpose] ?? 'Your HsumChaint Verification Code';
};

export const renderOtpEmailHtml = (params: {
  otp: string;
  expiryMinutes?: number;
  purpose?: string;
}): string => {
  const expiryMinutes = params.expiryMinutes ?? 5;
  const currentYear = new Date().getFullYear();
  const copy = (params.purpose ? OTP_COPY_MAP[params.purpose] : undefined) ?? {
    heading: 'OTP Verification',
    description: 'Enter the one-time verification code below to complete your request.',
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HsumChaint Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E1B18;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FAF7F2;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #EFE2CB;box-shadow:0 8px 24px rgba(154,100,24,0.08);">
          <tr>
            <td style="height:4px;background-color:#E59A36;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="background-color:#FFF7E8;background:linear-gradient(180deg,#FBE5BE 0%,#FFF8EC 62%,#FFFFFF 100%);padding:28px 32px 16px 32px;">
              <div style="display:inline-block;background-color:#E59A36;color:#FFFFFF;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:6px 16px;border-radius:999px;margin-bottom:14px;">
                HsumChaint
              </div>
              <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1E1B18;line-height:1.3;">
                ${copy.heading}
              </h1>
              <p style="margin:0;font-size:13px;color:#736555;line-height:1.5;">
                Making meal donations simple and meaningful.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 32px 28px 32px;text-align:center;">
              <p style="margin:0 0 22px 0;font-size:14px;color:#4E443A;line-height:1.6;">
                ${copy.description}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px auto;">
                <tr>
                  <td align="center" style="background-color:#FFFBF3;border:1.5px solid #ECC17A;border-radius:12px;padding:20px 16px 16px 16px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#B36E16;margin-bottom:10px;">
                      Verification Code
                    </div>
                    <div style="margin-bottom:10px;">
                      <span style="display:inline-block;background-color:#FFFFFF;border:1px solid #F2DEC0;border-radius:8px;padding:10px 20px;font-family:'SFMono-Regular',Consolas,'Liberation Mono','Courier New',monospace;font-size:32px;font-weight:800;letter-spacing:8px;text-indent:8px;color:#B86B11;line-height:1.2;user-select:all;-webkit-user-select:all;">${params.otp}</span>
                    </div>
                    <div style="font-size:11px;color:#938472;line-height:1.4;">
                      Double-click or press &amp; hold the code to copy
                    </div>
                  </td>
                </tr>
              </table>
              <div style="display:inline-block;background-color:#FFF5E4;border:1px solid #F3DFBE;border-radius:999px;padding:5px 14px;font-size:12px;font-weight:600;color:#8F5812;margin-bottom:16px;">
                Expires in ${expiryMinutes} minutes
              </div>
              <p style="margin:0;font-size:12px;color:#847768;line-height:1.6;">
                For your security, never share this code with anyone. If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#FCF9F3;border-top:1px solid #F2E7D3;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9A8B7A;line-height:1.5;">
                &copy; ${currentYear} HsumChaint. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

export interface SendOtpEmailParams {
  to: string;
  otp: string;
  purpose: string;
  expiryMinutes?: number;
}

let cachedTransporter: Transporter<SMTPSentMessageInfo, SMTPTransportOptions> | null = null;

/**
 * Resets the cached SMTP transporter (primarily for testing).
 */
export const resetEmailTransporter = (): void => {
  cachedTransporter = null;
};

/**
 * Returns a cached Nodemailer SMTP transporter when SMTP credentials are configured.
 */
export const getEmailTransporter = (): Transporter<
  SMTPSentMessageInfo,
  SMTPTransportOptions
> | null => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return cachedTransporter;
};

export const sendOtpEmail = async (params: SendOtpEmailParams): Promise<void> => {
  const expiryMinutes = params.expiryMinutes ?? 5;
  const subject = getOtpEmailSubject(params.purpose);
  const html = renderOtpEmailHtml({
    otp: params.otp,
    expiryMinutes,
    purpose: params.purpose,
  });

  if (env.NODE_ENV !== 'production') {
    logger.info(
      `[Email Service] Sending OTP email to: ${params.to} | Subject: "${subject}" | OTP: ${params.otp}`
    );
  }

  if (env.NODE_ENV === 'test') {
    return;
  }

  const transporter = getEmailTransporter();
  if (!transporter) {
    logger.warn('[Email Service] SMTP credentials not configured; skipped external email send.');
    return;
  }

  const mailOptions: SendMailOptions = {
    from: env.SMTP_FROM || env.SMTP_USER,
    to: params.to,
    subject,
    text: `Your HsumChaint verification code is: ${params.otp}. It expires in ${expiryMinutes} minutes.`,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[Email Service] Dispatched via SMTP to ${params.to} (${info.messageId})`);
  } catch (error) {
    logger.error({ error, to: params.to }, '[Email Service] Failed to send OTP email via SMTP');
    throw error;
  }
};

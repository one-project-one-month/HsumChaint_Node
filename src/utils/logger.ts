import { env } from '@/config/env';
import pino from 'pino';

const isProduction = env.NODE_ENV === 'production';

function canUsePinoPretty(): boolean {
  try {
    Bun.resolveSync('pino-pretty', import.meta.dir);
    return true;
  } catch {
    return false;
  }
}

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  base: undefined, // Remove pid and hostname from every log line
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(!isProduction &&
    canUsePinoPretty() && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: true,
          messageFormat: '{msg}',
          levelFirst: true,
        },
      },
    }),
});

import pino from 'pino';
import { env } from '@/config/env';

const isProduction = env.NODE_ENV === 'production';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  base: undefined, // Remove pid and hostname from every log line
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(!isProduction && {
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

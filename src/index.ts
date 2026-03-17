import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './utils/logger';

const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down...`);

  server.close(async () => {
    await prisma.$disconnect();
    redis.close();
    logger.info('✅ Server closed');
    process.exit(0);
  });

  // Force exit if timeout
  setTimeout(() => {
    logger.error('❌ Force shutdown');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled errors
process.on('unhandledRejection', (err) => {
  logger.error(err as any, 'Unhandled Rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error(err as any, 'Uncaught Exception');
  shutdown('uncaughtException');
});

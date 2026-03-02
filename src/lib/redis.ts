import { redis as redisFromBun, RedisClient } from 'bun';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

export const redis = env.REDIS_URL ? new RedisClient(env.REDIS_URL) : redisFromBun;

const messageSuffix = env.REDIS_URL ? ` with ${env.REDIS_URL}` : ' (default)';
logger.info(`Redis client initialized${messageSuffix}`);

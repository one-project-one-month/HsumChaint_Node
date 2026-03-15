import 'dotenv/config';
import { env } from '@/config/env';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from 'prisma-client';

const adapter = new PrismaMariaDb({
  host: env.MYSQL_HOST,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

export { prisma };

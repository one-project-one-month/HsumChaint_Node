import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
async function userSeeder() {
  logger.info('Seeding users');
  const password = await Bun.password.hash('password123');
  for (let i = 0; i < 5; i++) {
    const phone = `0912345678${i}`;
    await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        username: `testUser${i}`,
        password,
        email: `test${i}@gmail.com`,
        userType: i % 2 === 0 ? 'Monk' : 'Donor',
      },
    });
  }
  logger.info('Seeding finished');
}
userSeeder()
.then(async () => {
  await prisma.$disconnect();
}).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

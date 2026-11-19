import { hash } from 'argon2';

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Тестовые пользователи для локальной разработки. Пароли известны только в dev-окружении. */
const DEV_USERS = [
  {
    email: 'dispatcher@swarmhouse.local',
    name: 'dispatcher',
    password: '123456',
  },
  {
    email: 'employee@swarmhouse.local',
    name: 'user',
    password: '123456',
  },
] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL не задан');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    for (const user of DEV_USERS) {
      const passwordHash = await hash(user.password);
      await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, passwordHash },
        create: { email: user.email, name: user.name, passwordHash },
      });
    }
    console.log(`Сид выполнен: ${DEV_USERS.length} пользователя`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../../src/generated/prisma/client';
import { assertTestDatabaseUrl } from './assert-test-database-url';

let client: PrismaClient | undefined;

/** Opens the test client on the checked TEST_DATABASE_URL. Importing this file does not connect. */
export function getTestPrisma(): PrismaClient {
  if (client) {
    return client;
  }

  const connectionString = assertTestDatabaseUrl(
    process.env.TEST_DATABASE_URL,
    process.env.DATABASE_URL,
  );
  client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  return client;
}

/** Closes the test pool when one was opened. */
export async function disconnectTestPrisma(): Promise<void> {
  if (!client) {
    return;
  }
  await client.$disconnect();
  client = undefined;
}

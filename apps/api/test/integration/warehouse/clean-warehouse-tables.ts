import { getTestPrisma } from '../support/test-database';

/** Deletes warehouse rows in foreign-key order. It connects only when called. */
export async function cleanWarehouseTables(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRaw`DELETE FROM "warehouse_maps"`;
  await prisma.$executeRaw`DELETE FROM "warehouses"`;
}

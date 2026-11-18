import { Prisma, type PrismaClient } from '../../../../../generated/prisma/client';
import type { PrismaService } from '../../../../../prisma/prisma.service';
import type {
  TransactionContext,
  UnitOfWork,
} from '../../../application/ports/system/unit-of-work';
import { PrismaWarehouseMapRepository } from '../repositories/prisma-warehouse-map.repository';
import { PrismaWarehouseRepository } from '../repositories/prisma-warehouse.repository';

/**
 * The one Prisma operation this unit of work needs.
 * `PrismaService` and the test `PrismaClient` both have it.
 * The application port stays `UnitOfWork`.
 */
export type TransactionRunner = Pick<PrismaClient, '$transaction'>;

type AssertAssignable<T extends Target, Target> = T;
type _PrismaClientRunsTransactions = AssertAssignable<PrismaClient, TransactionRunner>;
type _PrismaServiceRunsTransactions = AssertAssignable<PrismaService, TransactionRunner>;

/** One interactive Read Committed transaction. It does not retry or interpret the result. */
export class WarehouseUnitOfWork implements UnitOfWork {
  constructor(private readonly db: TransactionRunner) {}

  execute<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.db.$transaction(
      (tx) =>
        work({
          warehouses: new PrismaWarehouseRepository(tx),
          maps: new PrismaWarehouseMapRepository(tx),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}

import type { PrismaClient } from '../../generated/prisma/client';
import type { LoggerPort } from '../application/logger.port';
import { AsyncLocalTransaction } from './async-local-transaction';
import type { PrismaDb } from './prisma-db';

export class PrismaTransaction extends AsyncLocalTransaction<PrismaDb> {
  constructor(
    private readonly prisma: PrismaClient,
    logger: LoggerPort,
  ) {
    super(logger);
  }

  get db(): PrismaDb {
    return this.current?.client ?? this.prisma;
  }

  protected begin<T>(work: (client: PrismaDb) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work, { isolationLevel: 'ReadCommitted' });
  }
}

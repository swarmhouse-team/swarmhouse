import { describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '../../generated/prisma/client';
import { createRecordingLogger } from '../testing/create-recording-logger';
import type { PrismaDb } from './prisma-db';
import { PrismaTransaction } from './prisma-transaction';

function setup(commitError?: Error) {
  const { logger, logs } = createRecordingLogger();
  const tx = {} as PrismaDb;
  const steps: string[] = [];
  const prisma = {
    $transaction: vi.fn(async (work: (client: PrismaDb) => Promise<unknown>) => {
      const result = await work(tx);
      if (commitError) throw commitError;
      steps.push('commit');
      return result;
    }),
  };
  const transaction = new PrismaTransaction(prisma as unknown as PrismaClient, logger);
  return { prisma, transaction, tx, steps, logs };
}

describe('PrismaTransaction', () => {
  it('joins nested work and awaits callbacks in registration order outside the committed transaction', async () => {
    const { prisma, transaction, tx, steps } = setup();
    const clients: PrismaDb[] = [];
    expect(transaction.db).toBe(prisma);
    const result = await transaction.run(async () => {
      expect(transaction.db).toBe(tx);
      transaction.afterCommit(async () => {
        await Promise.resolve();
        steps.push('first');
        clients.push(transaction.db);
      });
      const nested = await transaction.run(async () => {
        expect(transaction.db).toBe(tx);
        transaction.afterCommit(() => {
          steps.push('nested');
          clients.push(transaction.db);
        });
        return 42;
      });
      transaction.afterCommit(() => {
        steps.push('last');
      });
      expect(steps).toEqual([]);
      return nested;
    });
    expect(result).toBe(42);
    expect(prisma.$transaction.mock.calls).toEqual([
      [expect.any(Function), { isolationLevel: 'ReadCommitted' }],
    ]);
    expect(steps).toEqual(['commit', 'first', 'nested', 'last']);
    expect(clients).toEqual([prisma, prisma]);
    expect(transaction.db).toBe(prisma);
  });

  it.each(['work', 'commit'])('discards callbacks when %s fails', async (stage) => {
    const error = new Error(stage);
    const { transaction, prisma } = setup(stage === 'commit' ? error : undefined);
    const callback = vi.fn();
    await expect(
      transaction.run(async () => {
        transaction.afterCommit(callback);
        await transaction.run(async () => {
          transaction.afterCommit(callback);
          if (stage === 'work') throw error;
        });
      }),
    ).rejects.toBe(error);
    expect(callback).not.toHaveBeenCalled();
    expect(transaction.db).toBe(prisma);
  });

  it('rejects db and run in a task that resumes after its transaction rolled back', async () => {
    const { transaction, prisma } = setup();
    const rollback = new Error('roll back');
    const nestedWork = vi.fn(async () => {});
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let lateTask!: Promise<void>;

    await expect(
      transaction.run(async () => {
        lateTask = gate.then(async () => {
          expect(() => transaction.db).toThrow('Transaction context is closed');
          await expect(transaction.run(nestedWork)).rejects.toThrow(
            'Transaction context is closed',
          );
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    release();
    await lateTask;
    expect(nestedWork).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.db).toBe(prisma);
  });

  it('logs a callback failure once and continues with the committed result', async () => {
    const { transaction, logs } = setup();
    const next = vi.fn();
    const result = await transaction.run(async () => {
      transaction.afterCommit(async () => {
        throw new TypeError('private detail');
      });
      transaction.afterCommit(next);
      return 17;
    });
    expect(result).toBe(17);
    expect(next).toHaveBeenCalledTimes(1);
    expect(logs).toEqual([
      {
        level: 'error',
        event: 'transaction.after_commit_failed',
        context: { errorClass: 'TypeError' },
      },
    ]);
  });

  it('rejects registration outside run', () => {
    const { transaction } = setup();
    expect(() => transaction.afterCommit(vi.fn())).toThrow('active transaction');
  });
});

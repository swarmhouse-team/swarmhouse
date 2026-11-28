import { AsyncLocalStorage } from 'node:async_hooks';

import type { LoggerPort } from '../application/logger.port';
import { Transaction, type AfterCommitCallback } from '../application/transaction';

interface TransactionScope<Client> {
  client: Client;
  callbacks: AfterCommitCallback[];
  active: boolean;
}

export abstract class AsyncLocalTransaction<Client> extends Transaction {
  private readonly storage = new AsyncLocalStorage<TransactionScope<Client>>();

  constructor(private readonly logger: LoggerPort) {
    super();
  }

  protected abstract begin<T>(work: (client: Client) => Promise<T>): Promise<T>;

  protected get current() {
    const scope = this.storage.getStore();
    if (scope && !scope.active) {
      throw new Error('Transaction context is closed');
    }
    return scope;
  }

  get isActive(): boolean {
    return this.current !== undefined;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.current) return work();

    const callbacks: AfterCommitCallback[] = [];
    const result = await this.begin((client) => {
      const scope = { client, callbacks, active: true };
      return this.storage.run(scope, async () => {
        try {
          return await work();
        } finally {
          // Async resources created by work can outlive the transaction.
          scope.active = false;
        }
      });
    });

    for (const callback of callbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger.error('transaction.after_commit_failed', {
          errorClass: error instanceof Error && error.name ? error.name : 'UnknownError',
        });
      }
    }
    return result;
  }

  afterCommit(callback: AfterCommitCallback): void {
    const scope = this.current;
    if (!scope) throw new Error('afterCommit requires an active transaction');
    scope.callbacks.push(callback);
  }
}

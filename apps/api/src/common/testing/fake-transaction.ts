import type { LoggerPort } from '../application/logger.port';
import { AsyncLocalTransaction } from '../infrastructure/async-local-transaction';

export class FakeTransaction extends AsyncLocalTransaction<void> {
  constructor(
    logger: LoggerPort,
    private readonly commit?: () => Promise<void>,
  ) {
    super(logger);
  }

  protected async begin<T>(work: () => Promise<T>): Promise<T> {
    const result = await work();
    await this.commit?.();
    return result;
  }
}

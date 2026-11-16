import type { WarehouseMapRepository } from '../repositories/warehouse-map.repository';
import type { WarehouseRepository } from '../repositories/warehouse.repository';

/**
 * Repositories for a single `UnitOfWork.execute` callback.
 * They share that transaction and must not be stored or used after the callback returns.
 */
export interface TransactionContext {
  readonly warehouses: WarehouseRepository;
  readonly maps: WarehouseMapRepository;
}

/**
 * Transaction boundary for application commands.
 *
 * The callback and its `tx` repositories share one transaction.
 * A fulfilled callback starts a commit attempt.
 * `execute` returns the callback result only after that commit succeeds.
 * A callback exception rolls the work back and rejects `execute` with that error.
 * The returned value is not interpreted: returning `conflict` or `not_found`
 * does not request a rollback. The use case throws the matching application
 * error inside the callback when that result must abort the operation.
 * An error while finishing the transaction rejects `execute`. If the connection
 * fails during commit, the caller may not know whether the commit landed.
 * `MapVersionConflictError` is not a late commit failure.
 * Nested `execute` calls are not supported.
 * There is no public `begin`, `commit`, or `rollback`.
 * This does not replace the `expectedVersion` check in `WarehouseMapRepository.save`.
 * `saved` inside the callback still does not mean the commit succeeded.
 */
export interface UnitOfWork {
  execute<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

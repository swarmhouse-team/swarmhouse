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
 * The `tx` repositories work in one transaction.
 * A fulfilled callback leads to a commit attempt.
 * `execute` returns the callback result only after that commit succeeds.
 * A callback error rolls the work back and rejects `execute`.
 * A commit error also rejects `execute`: the callback result must not reach the caller.
 * Nested `execute` calls are not supported.
 * This variant has no public `begin`, `commit`, or `rollback`.
 * It does not replace the `expectedVersion` check in `WarehouseMapRepository.save`.
 * `saved` inside the callback still does not mean the commit succeeded.
 * If the map changes before commit, `execute` rejects with `MapVersionConflictError`.
 * If it disappears, `execute` rejects with `WarehouseMapNotFoundError`.
 * In either case none of the transaction's writes are applied.
 */
export interface UnitOfWork {
  execute<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

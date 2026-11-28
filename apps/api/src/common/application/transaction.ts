export type AfterCommitCallback = () => void | Promise<void>;

/** Nested work joins the outer transaction. Callbacks run in order after its commit. */
export abstract class Transaction {
  abstract readonly isActive: boolean;
  abstract run<T>(work: () => Promise<T>): Promise<T>;
  abstract afterCommit(callback: AfterCommitCallback): void;
}

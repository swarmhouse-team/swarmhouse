import type { IdGenerator } from '../application/id-generator';

/** Returns the given ids in order. The next call after the last id throws. */
export function scriptedIds(ids: readonly string[]): IdGenerator {
  const queue = [...ids];
  return {
    next() {
      const id = queue.shift();
      if (id === undefined) {
        throw new Error('No more ids');
      }
      return id;
    },
  };
}

/** Returns the same id on every call. `onNext` runs before the id is returned. */
export function fixedId(id: string, onNext?: () => void): IdGenerator {
  return {
    next() {
      onNext?.();
      return id;
    },
  };
}

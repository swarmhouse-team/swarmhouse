/**
 * JSON value stored in the cache.
 * The root is never `null`: a null `get` result means a miss or an expired entry.
 * Nested nulls inside objects and arrays are allowed.
 */
export type CacheJson =
  string | number | boolean | null | CacheJson[] | { [key: string]: CacheJson };

export type CacheValue = Exclude<CacheJson, null>;

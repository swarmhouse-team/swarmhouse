/** How long a warehouse details entry may stay stale. */
export const WAREHOUSE_DETAILS_TTL_MS = 30_000;

/** How long the unscoped warehouse list may stay stale. */
export const WAREHOUSE_LIST_TTL_MS = 30_000;

/** Logical key. The cache adapter adds its own namespace prefix. */
export const WAREHOUSE_LIST_CACHE_KEY = 'warehouse:list:v1:all';

/** `warehouseId` is the lowercase id already stored for the warehouse. */
export function warehouseDetailsCacheKey(warehouseId: string): string {
  return `warehouse:details:v1:${warehouseId}`;
}

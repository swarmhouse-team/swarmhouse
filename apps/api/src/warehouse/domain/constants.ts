/** Text form of a UUID: 8-4-4-4-12 hex groups, any version, any letter case. */
export const UUID_TEXT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Canonical lowercase nil UUID. Not an identity of a real entity. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Canonical lowercase max UUID. Not an identity of a real entity. */
export const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

/** Stage assumption: name length is counted after trim. */
export const MAX_NAME_LENGTH = 100;

/** Stage assumption: new warehouse maps use a fixed grid size. */
export const WAREHOUSE_MAP_WIDTH = 20;
export const WAREHOUSE_MAP_HEIGHT = 20;

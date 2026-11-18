# Proposal

## Why

The warehouse editor is already implemented, and later tasks are supposed to go through OpenSpec. This change records the accepted behavior so the next task starts from a spec instead of from the code alone.

## What Changes

- Specify warehouse create, list, read, rename, and delete. Access checks are not part of this stage.
- Specify the fixed 20×20 map: obstacles, robots, and stations without a station type, one operation per edit, and an optimistic version.
- Specify the `/warehouse` socket: subscribe only to an existing warehouse, and publish a change after the edit is committed.
- A stored map that breaks a domain rule is an internal error. The client is told to read the map again on a version conflict.

## Capabilities

### New Capabilities

- `warehouse`: warehouse records and their public metadata
- `warehouse-map`: reading and editing one warehouse map
- `warehouse-realtime`: live warehouse and map events

### Modified Capabilities

## Impact

- HTTP: `warehouses` and `maps` controllers, shared Zod contracts in `@robots/shared`.
- Socket.IO namespace `/warehouse`.
- Warehouse module under `apps/api/src/modules/warehouse`. No new runtime behavior in this change.

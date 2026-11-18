# Design

## Context

See proposal.md for why this change exists. The behavior is already implemented in `apps/api/src/modules/warehouse` and the shared contracts. This design records the decisions that later tasks must keep.

## Goals / Non-Goals

**Goals:**

- Keep the warehouse module as the only Nest module for this behavior, with providers that are not re-exported.
- Keep request validation and domain checks aligned where a client sends the value, and keep stored JSON from silently repairing a map.
- Keep one-operation optimistic editing.

**Non-Goals:**

- Owner and observer checks. The HTTP and socket descriptions say access is not checked yet.
- Simulation, tasks, and the AI assistant.
- Changing the map size or adding a station type.

## Decisions

### One module, shared infrastructure outside it

Warehouse use cases, the map aggregate, HTTP, and the socket stay in `modules/warehouse`. Clock, id generation, logging, the application and domain error bases, the thrown-error mapper, the Prisma transaction client, cache read, and post-commit publish live under `src/common` and `src/cache`. The module does not export those providers for other modules to import.

Alternative: leave the shared ports inside the warehouse module. That was rejected because the next modules would copy them.

### The domain still checks ids and names

Request schemas trim names and require a UUID. Stored map JSON does not trim names, and the UUID schema accepts the nil and max UUIDs. `WarehouseMap.restore` rebuilds the aggregate and does not trim or move a bad cell. The application turns a failed restore into an internal error with a reason that is logged and not returned to the client.

`Name` and the id value object stay. Deleting them would make a corrupt stored string a valid warehouse.

Alternative: trust the request schema and drop the value objects. That misses the stored-JSON path and the nil UUID.

### Stations have no type

A station is a named cell. The operation contract is one shared `EditWarehouseMapOperation` with no station-type field.

### Version check stays per operation

`expectedVersion` is compared with the stored version. A no-op does not increment it and does not publish. A changing save checks the version again in the write. The client receives a fixed conflict message and reads the map again. The expected and actual versions stay internal.

Alternative: drop collaborative editing because the original task did not ask for it. It stays, because removing it now would change a behavior that is already in the API. New unagreed behavior still needs its own task.

### Realtime follows the committed write

Subscribe loads the warehouse through the same read as HTTP. There is no cache-bypass existence check. Map, rename, and delete events are published after the unit of work commits. A failed publish is logged and does not roll back the write.

## Risks / Trade-offs

- [Any caller can edit a warehouse] → Access control is a later requirement, not a silent addition to this spec.
- [A corrupt stored map becomes an internal error] → The client cannot repair it from the response. That is intentional: the system does not guess a trimmed name or a different grid.
- [One backend instance owns a warehouse's live state] → The current editor persists the map and publishes on the local socket. Splitting a warehouse across instances is outside this change.

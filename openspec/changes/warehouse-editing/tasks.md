# Tasks

The behavior below is already implemented. The boxes record that this change specifies it rather than asking for new code.

## 1. Warehouse records

- [x] 1.1 Create, list, read, rename, and delete a warehouse without an access check, and verify `src/modules/warehouse` covers the missing-warehouse and name cases
- [x] 1.2 Create the empty version-0 map with the warehouse and verify the create response includes the map id and version 0

## 2. Map edits

- [x] 2.1 Accept one obstacle, robot, or station operation and reject a station type, and verify the shared warehouse contract tests
- [x] 2.2 Enforce occupancy, bounds, and unique names and ids as domain errors without client details, and verify the edit-map use case tests
- [x] 2.3 Keep the optimistic version, the public stale-map conflict, and no-op moves, and verify a conflicting edit does not change the stored version
- [x] 2.4 Restore a stored map on the aggregate and return an internal error for a bad grid or an untrimmed stored name, and verify the restore tests

## 3. Realtime

- [x] 3.1 Subscribe through the warehouse read, cap a socket at 20 subscriptions, and verify the gateway tests for a missing warehouse and `TOO_MANY_REQUESTS`
- [x] 3.2 Publish map, rename, and delete events only after a committed change, and verify a no-op does not publish

## Workflow follow-up

- Archive this change after the PR is merged so the delta becomes `openspec/specs/`.

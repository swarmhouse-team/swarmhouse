# Spec Delta

## Purpose

Pushes warehouse and map changes to subscribers on the warehouse socket after the write is committed.

## ADDED Requirements

### Requirement: Subscribe to an existing warehouse

The system SHALL let a socket subscribe and unsubscribe by warehouse id on the `/warehouse` namespace. The client SHALL NOT choose the room. A repeated subscribe SHALL join once. A warehouse id SHALL be matched case-insensitively. A missing warehouse SHALL be reported as `WAREHOUSE_NOT_FOUND`. One socket SHALL hold at most 20 subscriptions, including a join that is still in flight.

#### Scenario: Existing warehouse

- **WHEN** a socket subscribes with the id of a stored warehouse
- **THEN** the acknowledgement is successful and a later event for that warehouse is delivered to that socket

#### Scenario: Repeated subscribe

- **WHEN** a socket subscribes twice to the same warehouse
- **THEN** both acknowledgements succeed and the socket still has one subscription to that warehouse

#### Scenario: Missing warehouse

- **WHEN** a socket subscribes to a warehouse that does not exist
- **THEN** the acknowledgement fails with `WAREHOUSE_NOT_FOUND` and the socket is not subscribed

#### Scenario: Subscription limit

- **WHEN** a socket that already holds 20 subscriptions subscribes to another warehouse
- **THEN** the acknowledgement fails with `TOO_MANY_REQUESTS` and the extra warehouse is not joined

### Requirement: Edit the map over the socket

The system SHALL accept one map operation on `warehouse.map.edit` with the same body rules as the HTTP map edit. The acknowledgement SHALL return the same success body or the same client error as that HTTP command.

#### Scenario: Successful edit

- **WHEN** a socket edits a map with the current version and a valid operation
- **THEN** the acknowledgement contains `changed` and the map, and the stored version advances when the operation changed the map

#### Scenario: Stale edit

- **WHEN** a socket edits a map with a version that does not match the stored version
- **THEN** the acknowledgement fails with `MAP_VERSION_CONFLICT` and the public stale-map message

### Requirement: Publish after commit

After a committed rename, the system SHALL emit `warehouse.updated` with the warehouse id. After a committed delete, it SHALL emit `warehouse.deleted` with the warehouse id. After a committed map change, it SHALL emit `warehouse.map.changed` with the warehouse id, map id, new version, the applied operation, and `createdId` when one was created. A no-op rename or map move SHALL NOT emit an event. Object ids in the published operation SHALL be lowercase.

#### Scenario: Map change

- **WHEN** a map edit changes the map and the write commits
- **THEN** subscribers of that warehouse receive `warehouse.map.changed` for the new version and do not receive it before the write commits

#### Scenario: No-op move

- **WHEN** a map edit moves an object onto its current cell
- **THEN** subscribers receive no `warehouse.map.changed` event

#### Scenario: Delete

- **WHEN** a warehouse delete commits
- **THEN** subscribers of that warehouse receive `warehouse.deleted` for its id

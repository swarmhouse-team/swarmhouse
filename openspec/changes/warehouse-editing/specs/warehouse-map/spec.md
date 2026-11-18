# Spec Delta

## Purpose

Defines the fixed warehouse grid and the one-operation edit so robots, stations, and obstacles stay consistent for the dispatcher.

## ADDED Requirements

### Requirement: Fixed empty map

A new warehouse map SHALL be a 20 by 20 grid at version 0 with no obstacles, robots, or stations. Reading the map SHALL return that grid, the warehouse id, the map id, and the current version.

#### Scenario: Map created with the warehouse

- **WHEN** a client reads the map of a warehouse that was just created
- **THEN** the response has width 20, height 20, version 0, and empty obstacles, robots, and stations

#### Scenario: Missing map

- **WHEN** a client reads or edits a map that does not exist
- **THEN** the system responds with `MAP_NOT_FOUND`

### Requirement: One map operation

The system SHALL apply exactly one operation: add, move, or remove an obstacle, or place, move, or remove a robot or a station. A station SHALL have a name and a cell and SHALL NOT have a type. Placing a robot or a station SHALL return the created id. The response SHALL include `changed` and the map after the command.

#### Scenario: Place a station

- **WHEN** a client places a station named `Receiving` on an empty in-bounds cell with the current version
- **THEN** the response has `changed` true, a `createdId`, and that station on the returned map

#### Scenario: Station type is not a field

- **WHEN** a client sends a place-station operation that includes a station type
- **THEN** the system rejects the request and leaves the map unchanged

### Requirement: Map cell rules

The system SHALL keep at most one object on a cell, SHALL keep every object inside the 20 by 20 grid, and SHALL reject a duplicate robot name, a duplicate station name, or a duplicate object id. A rejected operation SHALL respond as an unprocessable domain error with its code and message and SHALL NOT include internal details.

#### Scenario: Occupied cell

- **WHEN** a client adds an obstacle on a cell that already holds an object
- **THEN** the system responds with `CELL_OCCUPIED` and the stored map is unchanged

#### Scenario: Cell outside the grid

- **WHEN** a client places an object at a cell outside 0..19
- **THEN** the system rejects the operation and the stored map is unchanged

#### Scenario: Duplicate robot name

- **WHEN** a client places a robot whose name matches a robot already on the map
- **THEN** the system responds with `DUPLICATE_ROBOT_NAME` and does not add the robot

### Requirement: Optimistic map version

The system SHALL apply a changing operation only when `expectedVersion` equals the stored version, and SHALL then increment the version by one. A move onto the object's current cell SHALL be a no-op: `changed` is false and the version stays the same. A conflict response SHALL use `MAP_VERSION_CONFLICT` and the message `The map version is stale. Read the map again and repeat the command.` It SHALL NOT include the expected or actual version.

#### Scenario: Matching version

- **WHEN** a client adds an obstacle with the version returned by the last read
- **THEN** the stored version becomes that version plus one and the obstacle is on the map

#### Scenario: Stale version

- **WHEN** a client sends an operation with a version other than the stored version
- **THEN** the system responds with `MAP_VERSION_CONFLICT` and the public stale-map message, and the map is unchanged

#### Scenario: Move to the same cell

- **WHEN** a client moves a robot to the cell it already occupies and the version matches
- **THEN** the response has `changed` false and the same version

### Requirement: Corrupt stored map

The system SHALL NOT repair a stored map whose grid is not 20 by 20, whose robot or station name is not already trimmed, or whose content breaks a map rule. Reading or editing that map SHALL respond as an internal error and SHALL NOT return the corruption reason or the map id in the client body.

#### Scenario: Untrimmed stored name

- **WHEN** a client reads a map whose stored robot name has leading or trailing spaces
- **THEN** the system responds with an internal error and the stored name is unchanged

#### Scenario: Wrong stored grid size

- **WHEN** a client edits a map whose stored width or height is not 20
- **THEN** the system responds with an internal error and does not apply the operation

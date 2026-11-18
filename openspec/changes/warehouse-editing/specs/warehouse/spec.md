# Spec Delta

## Purpose

Records a warehouse and its public metadata so a later task can add owners and observers without redefining the record.

## ADDED Requirements

### Requirement: Create a warehouse

The system SHALL create a warehouse from a trimmed name of 1 to 100 characters and SHALL create an empty map at version 0 with it. The response SHALL include the warehouse id, the stored name, the map id, and version 0.

#### Scenario: Valid name

- **WHEN** a client creates a warehouse with the name `North dock`
- **THEN** the warehouse is stored as `North dock` and the response contains a new warehouse id, a new map id, and version 0

#### Scenario: Empty or oversized name

- **WHEN** a client creates a warehouse with a name that is empty after trim or longer than 100 characters
- **THEN** the system rejects the request and does not create a warehouse

#### Scenario: Unknown field

- **WHEN** a client creates a warehouse with a field other than `name`
- **THEN** the system rejects the request and does not create a warehouse

### Requirement: List warehouses

The system SHALL return every stored warehouse without map content and without pagination. `total` SHALL equal the number of returned items. A missing timestamp SHALL be `null`.

#### Scenario: Several warehouses

- **WHEN** a client lists warehouses and two warehouses are stored
- **THEN** the response contains both records, no map cells, and `total` 2

### Requirement: Read warehouse metadata

The system SHALL return one warehouse's id, name, and timestamps without the map.

#### Scenario: Existing warehouse

- **WHEN** a client reads a warehouse that exists
- **THEN** the response contains that warehouse's metadata and no map cells

#### Scenario: Missing warehouse

- **WHEN** a client reads, renames, or deletes a warehouse that does not exist
- **THEN** the system responds with `WAREHOUSE_NOT_FOUND`

### Requirement: Rename a warehouse

The system SHALL rename a warehouse with the same name rules as creation and SHALL NOT change its map. The response SHALL contain the warehouse id and the name stored after the command.

#### Scenario: New name

- **WHEN** a client renames an existing warehouse to a different valid name
- **THEN** later reads return the new name and the map version is unchanged

#### Scenario: Same name

- **WHEN** a client renames a warehouse to the name it already has
- **THEN** the response returns that name and no rename event is published

### Requirement: Delete a warehouse

The system SHALL delete the warehouse and every map that belongs to it. A successful delete SHALL have no response body.

#### Scenario: Existing warehouse

- **WHEN** a client deletes a warehouse that exists
- **THEN** later reads of that warehouse and its map report that they are missing

### Requirement: Open access at this stage

The system SHALL accept warehouse commands from any client that can reach the API. It SHALL NOT require an owner or observer role.

#### Scenario: Unauthenticated caller

- **WHEN** a client that presents no user calls a warehouse endpoint with an otherwise valid request
- **THEN** the system applies the command instead of rejecting it for missing access

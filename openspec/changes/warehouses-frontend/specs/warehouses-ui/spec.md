# Spec Delta

## Purpose

The web client provides a localized, accessible page for browsing and managing warehouses with mock data until backend integration is introduced.

## ADDED Requirements

### Requirement: Warehouses page

The web client SHALL expose the warehouses page under the current locale and SHALL render its heading, description, create action, filters, search, and warehouse grid from localized messages.

#### Scenario: Russian page

- **WHEN** a user opens `/ru/warehouses`
- **THEN** the warehouses interface and its accessibility labels are displayed in Russian

#### Scenario: English page

- **WHEN** a user opens `/en/warehouses`
- **THEN** the warehouses interface and its accessibility labels are displayed in English

### Requirement: Representative mock warehouses

The page SHALL use an in-memory collection that contains owner and observer warehouses and covers running, paused, and not-started simulation statuses.

#### Scenario: Page is opened

- **WHEN** the warehouses page is rendered before API integration
- **THEN** warehouse cards are populated from the mock collection without making a warehouse API request

### Requirement: Warehouse filters

The page SHALL provide All, Mine, and Shared with me filters. Mine SHALL contain owner warehouses, and Shared with me SHALL contain observer warehouses. Each filter SHALL display a count calculated from the full collection.

#### Scenario: Owner filter

- **WHEN** a user selects Mine
- **THEN** only warehouses where the current user is the owner are displayed

#### Scenario: Observer filter

- **WHEN** a user selects Shared with me
- **THEN** only warehouses where the current user is an observer are displayed

#### Scenario: Filter count

- **WHEN** a search query hides some warehouses
- **THEN** the filter counters continue to describe the full collection for each role filter

### Requirement: Warehouse search

The page SHALL filter the active warehouse subset by a case-insensitive name substring on the client.

#### Scenario: Matching query

- **WHEN** a user enters part of a warehouse name with different letter casing
- **THEN** every warehouse in the active role filter whose name contains the query is displayed

#### Scenario: No matching warehouse

- **WHEN** no warehouse in the active role filter matches the query
- **THEN** the page displays the localized no-results state

### Requirement: Empty warehouse collection

The page SHALL distinguish an empty collection from an unsuccessful search.

#### Scenario: No warehouses exist

- **WHEN** the full warehouse collection is empty
- **THEN** the page displays the localized no-warehouses state and a way to create the first warehouse

### Requirement: Warehouse card

Each warehouse card SHALL display a map placeholder, name, map dimensions, robot count, station count, simulation status, and current-user role.

#### Scenario: Running owner warehouse

- **WHEN** a warehouse has owner role and running simulation status
- **THEN** its card displays the owner badge and the localized running status with the success indicator

#### Scenario: Long warehouse name

- **WHEN** the warehouse name does not fit in the card
- **THEN** the name is truncated with an ellipsis and spacing remains between the name and the card edge

### Requirement: Owner card actions

The settings and delete actions SHALL be available only for owner warehouses. Their trigger SHALL remain accessible by keyboard and touch.

#### Scenario: Hover-capable device

- **WHEN** a pointer device supports hover and an owner card is not hovered or focused
- **THEN** the actions trigger may be visually hidden and SHALL appear on hover, focus, or while its menu is open

#### Scenario: Touch device

- **WHEN** the device does not support hover
- **THEN** the owner card actions trigger is visible without requiring hover

#### Scenario: Observer warehouse

- **WHEN** a warehouse has observer role
- **THEN** the owner actions trigger is not rendered

### Requirement: New warehouse entry points

The page header create action and the final new-warehouse card SHALL open the same create dialog.

#### Scenario: Create action is selected

- **WHEN** a user selects either create entry point
- **THEN** the new-warehouse dialog opens with a name field, cancel action, and create action

### Requirement: Warehouse creation

The create form SHALL validate the name with the shared warehouse-name schema and localized validation resolver. Successful submission SHALL add a warehouse to local page state and close the dialog.

#### Scenario: Invalid name

- **WHEN** a user submits a name outside the shared length constraints
- **THEN** a localized validation message is displayed and no warehouse is created

#### Scenario: Valid name

- **WHEN** a user submits a valid warehouse name
- **THEN** an owner warehouse is added to the mock collection and the create dialog closes

### Requirement: Warehouse settings navigation

The settings dialog SHALL provide General, Size, and Users navigation. General and Users SHALL be interactive, while Size SHALL be visible but unavailable.

#### Scenario: Users tab

- **WHEN** a user selects Users
- **THEN** the participant-management content is displayed and the tab exposes its active accessible state

#### Scenario: Size tab

- **WHEN** a user encounters the Size tab
- **THEN** it is disabled and communicates that the section is not implemented

### Requirement: General warehouse settings

General settings SHALL show warehouse creation date, map dimensions, and simulation status. The warehouse name SHALL use the shared validation constraints, and Save SHALL remain disabled until the valid value changes.

#### Scenario: Unchanged name

- **WHEN** the settings dialog opens and the user has not changed the name
- **THEN** Save is disabled

#### Scenario: Valid changed name

- **WHEN** the owner enters a different valid name and selects Save
- **THEN** the local warehouse name is updated and the dialog closes

#### Scenario: Cancel changes

- **WHEN** the owner changes the name and selects Cancel
- **THEN** the original name is restored and the dialog closes

### Requirement: Warehouse participants

The Users tab SHALL display participant identity, email or invitation state, role, and available removal action. Invitations SHALL create pending observers without sending real email.

#### Scenario: Invite a new email

- **WHEN** the owner submits a valid email that is not already in the participant list
- **THEN** a pending observer is added immediately and no real email is sent

#### Scenario: Duplicate invitation

- **WHEN** the submitted email already belongs to an active or pending participant
- **THEN** a localized form error is displayed and another participant is not added

#### Scenario: Current user

- **WHEN** the participant row represents the current user
- **THEN** its role cannot be changed and its removal action is not displayed

#### Scenario: Other participant

- **WHEN** the owner changes another active participant's role or removes that participant
- **THEN** the change is applied immediately to local warehouse state

### Requirement: Warehouse deletion

The delete dialog SHALL warn about the affected warehouse data and SHALL enable its destructive action only when the entered confirmation exactly matches the warehouse name, including letter case.

#### Scenario: Confirmation does not match

- **WHEN** the entered text differs from the warehouse name
- **THEN** Delete warehouse remains disabled

#### Scenario: Exact confirmation

- **WHEN** the entered text exactly equals the warehouse name and the owner confirms deletion
- **THEN** the warehouse is removed from local page state and the dialog closes

### Requirement: Dialog viewport behavior

Management dialogs SHALL fit within the viewport. Dialog headers and footers SHALL remain visible while overflowing body content scrolls vertically.

#### Scenario: Short viewport

- **WHEN** the settings content is taller than the available viewport
- **THEN** `DialogBody` scrolls without clipping the header, close action, or footer actions

### Requirement: UI-kit localization boundary

The shared UI kit SHALL provide English default strings and SHALL accept application-provided localized strings without depending on the application's internationalization library.

#### Scenario: Application provider is present

- **WHEN** a shared dialog is rendered inside the localized web application
- **THEN** its close accessibility label uses the active application locale

#### Scenario: Application provider is absent

- **WHEN** a shared UI component is rendered without an application translation provider
- **THEN** it uses the UI kit's English default string

### Requirement: Frontend quality gates

The warehouses frontend SHALL satisfy the repository lint, FSD lint, typecheck, automated test, and production-build checks.

#### Scenario: Continuous integration

- **WHEN** repository checks run for this change
- **THEN** the warehouses frontend introduces no lint, FSD, type, test, or build failures

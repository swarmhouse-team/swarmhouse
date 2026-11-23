# Tasks

The behavior below is already implemented. The checked boxes record the frontend behavior covered by this OpenSpec change.

## 1. Warehouse page and data

- [x] 1.1 Add representative warehouse mocks for owner and observer roles and running, paused, and not-started simulations
- [x] 1.2 Compose the localized warehouses page with its title, subtitle, create action, and list widget
- [x] 1.3 Add the no-warehouses and no-search-results states

## 2. Browse and filter warehouses

- [x] 2.1 Add All, Mine, and Shared with me filters with collection counters
- [x] 2.2 Add case-insensitive client-side search by warehouse name and cover filtering behavior with tests
- [x] 2.3 Add warehouse and new-warehouse cards with localized summaries, role badges, simulation statuses, and map placeholders

## 3. Warehouse actions

- [x] 3.1 Add the create dialog with localized Zod validation and local mock creation
- [x] 3.2 Add general settings with warehouse information, name validation, dirty-state save behavior, and cancellation
- [x] 3.3 Add participant invitation, role changes, immediate removal, pending invitations, and current-user restrictions
- [x] 3.4 Add the destructive confirmation dialog that requires the exact warehouse name

## 4. Shared UI and localization

- [x] 4.1 Use shared UI-kit components and add missing reusable variants and primitives
- [x] 4.2 Add semantic success, warning, and alert theme tokens
- [x] 4.3 Add a UI-kit text context with English defaults and provide localized values from the web application
- [x] 4.4 Provide Russian and English messages for all warehouses-page content and accessibility labels

## 5. Responsive behavior and quality

- [x] 5.1 Keep card actions visible on touch devices and hover-revealed on hover-capable devices
- [x] 5.2 Constrain management dialogs to the viewport and scroll `DialogBody` while keeping headers and footers visible
- [x] 5.3 Truncate long warehouse names and preserve spacing at the card edge
- [x] 5.4 Keep lint, FSD lint, typecheck, tests, and the production build passing

## Workflow follow-up

- Archive this change after the PR is merged so the delta becomes part of `openspec/specs/`.

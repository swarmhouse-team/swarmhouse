# Proposal

## Why

The warehouses frontend is already implemented, while the related backend warehouse behavior has its own OpenSpec change. This change records the accepted web behavior so future API integration and warehouse-editor work can rely on an explicit specification instead of the current UI code alone.

## What Changes

- Add a localized warehouses page backed by representative mock data for owner and observer roles and all simulation statuses.
- Add client-side role filters, counters, name search, empty states, warehouse cards, and a new-warehouse card.
- Add create, settings, participant-management, and delete dialogs with translated validation and accessible controls.
- Add reusable UI-kit primitives needed by the page, including warehouse-facing dialog sections, tabs, icons, avatars, semantic status colors, and UI-kit text localization.
- Specify responsive behavior for touch-device card actions, scrollable settings content, and truncated warehouse names.

## Capabilities

### New Capabilities

- `warehouses-ui`: browsing and managing mock warehouses in the web client

### Modified Capabilities

## Impact

- Web route: `/[locale]/warehouses`.
- FSD slices under `pages/warehouses`, `widgets/warehouse-list`, `entities/warehouse`, and warehouse feature slices.
- Shared UI components and theme tokens in `packages/ui`.
- Russian and English application dictionaries.
- No backend endpoints or persisted data are changed by this specification.

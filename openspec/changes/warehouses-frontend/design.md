# Design

## Context

The warehouses page is the web entry point for viewing warehouses and opening the warehouse-management dialogs. The backend warehouse work exists separately, but this frontend stage intentionally uses mocks so the product flow and reusable UI primitives can be reviewed before API integration.

## Goals / Non-Goals

**Goals:**

- Keep the page organized by FSD: page composition, list widget, warehouse entity, and independent create, settings, and delete features.
- Represent owner and observer warehouses and every supported simulation status in mock data.
- Keep filtering and search deterministic and local to the browser.
- Reuse `@robots/ui` components and semantic theme tokens instead of feature-specific primitives or raw colors.
- Keep visible text, accessibility labels, validation messages, and UI-kit strings localized.
- Make card actions and management dialogs usable with a keyboard, on touch devices, and in short viewports.

**Non-Goals:**

- Loading or mutating warehouses through the backend API.
- Persisting mock changes after a page reload.
- Sending a real invitation email.
- Implementing the warehouse map widget or map editor.
- Implementing the warehouse-size settings tab.
- Adding Storybook stories in this change; they are handled separately by the team.

## Decisions

### Mocks extend the backend-facing warehouse shape

The warehouse entity keeps mock-only presentation fields next to the mock data: map dimensions, robot and station counts, simulation status, members, and creation date. This avoids changing the backend contract solely to render the current card and settings prototypes.

The dataset contains several warehouses with both roles and all simulation statuses so every page state can be exercised without network access.

### Filtering remains a pure client-side operation

The active role filter and normalized name query are applied to the in-memory list. Filter counters describe the full mock collection and do not change with the search query. Search uses case-insensitive substring matching.

This stage does not introduce query parameters or server-side filtering because the page has no API data source yet.

### Feature dialogs own their forms and temporary state

Create and rename forms use `react-hook-form`, shared Zod contracts, and the localized `useZodResolver`. Shared minimum and maximum warehouse-name constants are used by the schema, input attributes, counters, and hints.

Participant role changes and removals are applied immediately to the local warehouse state. Invitations create a pending observer member without sending email. Deletion remains blocked until the exact case-sensitive warehouse name is entered.

### The UI kit stays independent from application i18n

The UI kit exposes a text context with English defaults. The web application adapts its `next-intl` messages to that context. This allows accessibility strings such as the dialog close label to be translated without making `packages/ui` depend on `next-intl`.

Reusable `Tabs`, `DialogHeader`, `DialogBody`, and `DialogFooter` components provide common structure. Feature code uses shared `Button`, `Text`, `Heading`, `Select`, `Icon`, and `Avatar` variants instead of overriding their base sizes with unrelated utility classes.

### Responsive behavior is part of the component contract

The card action button is visible by default and becomes hover-revealed only on devices that support hover. A long warehouse name is constrained with a shrinkable container and ellipsis, with space kept between the text and the card edge.

`DialogContent` is constrained to the viewport. Headers and footers do not shrink; `DialogBody` owns vertical scrolling. The settings layout gives its tab content `min-height: 0` so the body can scroll instead of being clipped.

## Risks / Trade-offs

- [Mock mutations are lost on reload] → Persistence is intentionally deferred to API integration.
- [Mock fields may differ from the final API response] → They are isolated in the warehouse mock type and can later be mapped from multiple backend resources.
- [The size tab is visible but unavailable] → It communicates planned navigation without implying implemented behavior.
- [The responsive dialog has several nested flex and grid containers] → Shared dialog primitives define the scrolling boundary, and the feature supplies the required shrinkable containers.

# Frontend_2 TanStack + TypeScript Migration Design

## Problem
Current `frontend` is JS + mixed patterns. `frontend_2` already has TanStack Start + TS baseline but no product parity. Need migrate to `frontend_2` with full parity, TanStack Router + Query, TS strict, and usable/accessibile UI with shadcn-based system.

## Scope
In scope:
- Full feature parity with current frontend (shop + auth/profile + admin)
- Stack: TanStack Router, TanStack Query, TypeScript strict
- SPA-first rollout
- UI keeps near-identical brand/look in v1, with incremental UX/a11y upgrades
- Parallel-run migration, then cutover switch

Out of scope:
- Full visual rebrand
- SSR-first architecture
- New product features unrelated to parity/migration

## Current Context
- `frontend_2` already uses TanStack Start starter structure (`src/routes`, root shell, theme tokens).
- `frontend` already contains business flows and recent auth integration logic.
- API contracts already validated against gateway + UserService/ProductService.

## Chosen Approach
Use **vertical-slice migration** (recommended):
1. App shell + routing foundation
2. Auth/profile slice
3. Catalog/product-detail slice
4. Admin slice
5. UX/a11y hardening
6. Parity UAT + production switch

Why:
- Keeps each slice deployable/testable
- Lower risk than big-bang rewrite
- Faster signal on parity gaps

## Architecture

### Runtime/stack
- `frontend_2` as new runtime app
- TanStack Router for route tree + guards
- TanStack Query for all server-state
- Axios as transport only
- TypeScript strict for all new migrated code

### Module boundaries
- `src/features/auth/*`
- `src/features/catalog/*`
- `src/features/admin/*`
- `src/components/ui/*` (shadcn components)
- `src/lib/api/*` (client + error normalization)
- `src/lib/query/*` (query key factories, query options, client defaults)

Each slice owns:
- UI components
- Route-level loaders/guards
- Query/mutation hooks
- DTO mapping logic

## Routing and Access Control
- TanStack file routes for page mapping.
- Route guards at router layer:
  - unauthenticated access to protected route -> `/signin`
  - non-admin access to admin route -> `/`
- Redirect rules:
  - post-signin admin -> `/admin`
  - post-signin non-admin -> `/`

## Data Flow and TanStack Query Standards
- Query keys use array factory pattern, hierarchical and serializable.
- Include all dependencies in keys (ids, params, filters).
- Typed query option factories per endpoint.
- Mutations must update cache via targeted invalidation / `setQueryData`.
- Pending/error UI bound to mutation/query state (`isPending`, `isError`).
- Intent-based prefetch for product detail navigation.
- Cache defaults:
  - shared `QueryClient` defaults
  - stale/gc tuned by volatility (catalog vs profile).

## UI/UX + shadcn Design Rules

### Visual direction
- Keep existing brand vibe and visual familiarity for v1.
- Improve structure clarity and consistency (layout rhythm, spacing, states).

### Component strategy
- Use shadcn primitives as base (`Button`, `Input`, `Form`, `Card`, `Dialog`, `DropdownMenu`, `Table`).
- Compose feature components above primitives; avoid ad-hoc raw controls.
- Central token-driven theme values; avoid random per-screen colors.

### Accessibility/usability baseline
- Keyboard navigable interactions
- Visible focus ring
- Labels for all form fields
- Error text near field + aria announcement
- Touch targets >= 44px
- Color contrast compliant
- No color-only status meaning
- Predictable navigation and back behavior
- Loading/empty/error states for all data screens

## Migration Plan (Vertical Slices)
1. **Foundation slice**
   - Theme tokens + shadcn setup + route skeleton + typed API/query scaffolding
2. **Auth/profile slice**
   - signin/signup/profile/change-password + guards + role redirect
3. **Catalog slice**
   - home, all-products, product detail, filters/sort/search, related products
4. **Admin slice**
   - admin dashboard/product management parity + role protection
5. **Polish slice**
   - accessibility pass, responsive pass, perf pass
6. **Cutover slice**
   - parity checklist signoff, env/deploy switch to `frontend_2`

## Rollout Strategy
- Keep both frontends running during migration.
- Enable side-by-side QA.
- Cutover by environment/deployment switch after parity + quality gates pass.
- Legacy `frontend` remains rollback path until stabilization window ends.

## Error Handling
- Single API error normalization layer in `lib/api/errors.ts`.
- Surface actionable messages (auth, validation, network).
- No silent failures in query/mutation flows.
- Keep unauthorized/forbidden handling consistent across all slices.

## Testing and Verification
- Static: `tsc --noEmit`, lint, build
- Functional:
  - Auth flows and role redirects
  - Protected admin access behavior
  - Catalog filtering/sorting/search/parity
  - Admin CRUD parity
- UX/a11y:
  - keyboard-only pass
  - focus visibility
  - contrast checks
  - responsive checkpoints (mobile/tablet/desktop)

## Success Criteria
- `frontend_2` has full functional parity with current `frontend`.
- All migrated server-state flows use TanStack Query patterns.
- TypeScript strict passes for migrated code.
- Core UX/a11y checks pass and no blocking regressions.
- Deployment switched to `frontend_2` with rollback plan available.


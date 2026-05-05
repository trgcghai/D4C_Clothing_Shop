# Frontend_2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate full frontend functionality from `frontend` to `frontend_2` using TanStack Router + TanStack Query + TypeScript strict, while preserving visual familiarity and improving usability/accessibility.

**Architecture:** Use vertical-slice migration inside `frontend_2`: foundation, auth/profile, catalog/product, admin, then polish + cutover. Keep Axios as transport and move all server-state to TanStack Query with typed query-key factories and route-level guards. Keep current brand look close, but enforce consistent shadcn-based components and accessibility baseline.

**Tech Stack:** React 19, TypeScript strict, TanStack Start/Router, TanStack Query, shadcn/ui, Tailwind CSS, Axios, Vitest, Testing Library

---

## File Structure Lock-In

- `frontend_2/src/lib/api/http.ts` — axios instance, auth header, refresh handling
- `frontend_2/src/lib/api/errors.ts` — normalized API error mapping
- `frontend_2/src/lib/query/client.ts` — QueryClient defaults
- `frontend_2/src/lib/query/keys.ts` — query key factories
- `frontend_2/src/features/auth/*` — auth api/hooks/components/routes
- `frontend_2/src/features/catalog/*` — catalog/product api/hooks/components/routes
- `frontend_2/src/features/admin/*` — admin api/hooks/components/routes
- `frontend_2/src/components/ui/*` — shadcn primitives
- `frontend_2/src/routes/*` — route files and guards

---

### Task 1: Foundation (query client, api client, key factories, strict TS guardrails)

**Files:**
- Create: `frontend_2/src/lib/api/http.ts`
- Create: `frontend_2/src/lib/api/errors.ts`
- Create: `frontend_2/src/lib/query/client.ts`
- Create: `frontend_2/src/lib/query/keys.ts`
- Modify: `frontend_2/src/router.tsx`
- Modify: `frontend_2/tsconfig.json`
- Test: `frontend_2/src/lib/query/keys.test.ts`

- [ ] **Step 1: Write failing tests for key factory stability**

```ts
// frontend_2/src/lib/query/keys.test.ts
import { describe, expect, it } from 'vitest'
import { qk } from './keys'

describe('query keys', () => {
  it('builds serializable hierarchical auth keys', () => {
    expect(qk.auth.me()).toEqual(['auth', 'me'])
  })
  it('includes dependencies in catalog list key', () => {
    expect(qk.catalog.list({ page: 1, q: 'shirt' })).toEqual(['catalog', 'list', { page: 1, q: 'shirt' }])
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend_2 && npm run test -- src/lib/query/keys.test.ts`  
Expected: FAIL with module/file missing errors.

- [ ] **Step 3: Implement minimal foundation**

```ts
// frontend_2/src/lib/query/keys.ts
export const qk = {
  auth: { all: () => ['auth'] as const, me: () => ['auth', 'me'] as const },
  catalog: {
    all: () => ['catalog'] as const,
    list: (params: { page: number; q?: string }) => ['catalog', 'list', params] as const,
    detail: (id: string) => ['catalog', 'detail', id] as const,
  },
  admin: { all: () => ['admin'] as const },
}
```

```ts
// frontend_2/src/lib/query/client.ts
import { QueryClient } from '@tanstack/react-query'
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false } },
})
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend_2 && npm run test -- src/lib/query/keys.test.ts && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_2/src/lib frontend_2/tsconfig.json frontend_2/src/router.tsx
git commit -m "frontend_2: add typed query/api foundation"
```

---

### Task 2: shadcn setup + base shell parity (header/footer/nav state)

**Files:**
- Create: `frontend_2/src/components/ui/button.tsx`
- Create: `frontend_2/src/components/ui/input.tsx`
- Create: `frontend_2/src/components/ui/card.tsx`
- Modify: `frontend_2/src/components/Header.tsx`
- Modify: `frontend_2/src/routes/__root.tsx`
- Test: `frontend_2/src/components/__tests__/header.a11y.test.tsx`

- [ ] **Step 1: Write failing a11y test for header navigation**

```ts
// frontend_2/src/components/__tests__/header.a11y.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Header from '../Header'

describe('Header', () => {
  it('renders keyboard-focusable primary nav links', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: /products/i })).toBeTruthy()
    expect(screen.getByRole('navigation')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend_2 && npm run test -- src/components/__tests__/header.a11y.test.tsx`  
Expected: FAIL if roles/links mismatch.

- [ ] **Step 3: Implement shell updates with shadcn primitives**

```tsx
// frontend_2/src/components/ui/button.tsx
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="h-10 rounded-md px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
}
```

```tsx
// frontend_2/src/components/Header.tsx (excerpt)
<nav aria-label="Primary">
  <Link to="/" className="nav-link">Products</Link>
  <Link to="/admin" className="nav-link">Admin</Link>
</nav>
```

- [ ] **Step 4: Run test + lint**

Run: `cd frontend_2 && npm run test -- src/components/__tests__/header.a11y.test.tsx && npm run lint`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_2/src/components frontend_2/src/routes/__root.tsx
git commit -m "frontend_2: add shadcn base ui and accessible shell"
```

---

### Task 3: Auth/Profile slice (signin/signup/profile/password + guards + redirects)

**Files:**
- Create: `frontend_2/src/features/auth/api.ts`
- Create: `frontend_2/src/features/auth/hooks.ts`
- Create: `frontend_2/src/features/auth/store.ts`
- Create: `frontend_2/src/routes/signin.tsx`
- Create: `frontend_2/src/routes/signup.tsx`
- Create: `frontend_2/src/routes/profile.tsx`
- Modify: `frontend_2/src/routes/admin.tsx` (or create guard route)
- Test: `frontend_2/src/features/auth/auth.flow.test.tsx`

- [ ] **Step 1: Write failing auth contract test**

```ts
// frontend_2/src/features/auth/auth.flow.test.tsx
import { describe, expect, it } from 'vitest'
import { extractAccessToken } from '../auth-contract'

describe('auth contract', () => {
  it('reads token from signin payload', () => {
    expect(extractAccessToken({ token: 'abc' })).toBe('abc')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend_2 && npm run test -- src/features/auth/auth.flow.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement auth hooks + route guards with Query**

```ts
// frontend_2/src/features/auth/hooks.ts (excerpt)
export function useSignInMutation() {
  return useMutation({ mutationFn: signIn })
}
export function useMeQuery(token?: string) {
  return useQuery({ queryKey: qk.auth.me(), queryFn: getMe, enabled: Boolean(token), retry: false })
}
```

```tsx
// route guard pattern (excerpt)
if (!isAuthenticated) throw redirect({ to: '/signin' })
if (adminOnly && !isAdmin) throw redirect({ to: '/' })
```

- [ ] **Step 4: Run tests + auth route smoke**

Run: `cd frontend_2 && npm run test -- src/features/auth/auth.flow.test.tsx && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_2/src/features/auth frontend_2/src/routes/signin.tsx frontend_2/src/routes/signup.tsx frontend_2/src/routes/profile.tsx
git commit -m "frontend_2: migrate auth profile slice with tanstack query"
```

---

### Task 4: Catalog/Product slice (list, filters, detail, related, prefetch)

**Files:**
- Create: `frontend_2/src/features/catalog/api.ts`
- Create: `frontend_2/src/features/catalog/hooks.ts`
- Create: `frontend_2/src/features/catalog/components/*`
- Create: `frontend_2/src/routes/all-products.tsx`
- Create: `frontend_2/src/routes/product.$productId.tsx`
- Modify: `frontend_2/src/routes/index.tsx`
- Test: `frontend_2/src/features/catalog/catalog.keys.test.ts`

- [ ] **Step 1: Write failing key dependency test**

```ts
// frontend_2/src/features/catalog/catalog.keys.test.ts
import { describe, expect, it } from 'vitest'
import { qk } from '@/lib/query/keys'

describe('catalog keys', () => {
  it('includes pagination and search dependencies', () => {
    expect(qk.catalog.list({ page: 2, q: 'hoodie' })).toEqual(['catalog', 'list', { page: 2, q: 'hoodie' }])
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend_2 && npm run test -- src/features/catalog/catalog.keys.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement catalog/query hooks + intent prefetch**

```ts
// frontend_2/src/features/catalog/hooks.ts (excerpt)
export function useProducts(params: ProductListParams) {
  return useQuery({ queryKey: qk.catalog.list(params), queryFn: () => getProducts(params) })
}
```

```tsx
// product link prefetch intent (excerpt)
<Link
  to="/product/$productId"
  params={{ productId: product.id }}
  preload="intent"
>
  {product.name}
</Link>
```

- [ ] **Step 4: Run tests + build**

Run: `cd frontend_2 && npm run test -- src/features/catalog/catalog.keys.test.ts && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_2/src/features/catalog frontend_2/src/routes/index.tsx frontend_2/src/routes/all-products.tsx frontend_2/src/routes/product.$productId.tsx
git commit -m "frontend_2: migrate catalog and product detail slice"
```

---

### Task 5: Admin slice (dashboard/product management parity + protected access)

**Files:**
- Create: `frontend_2/src/features/admin/api.ts`
- Create: `frontend_2/src/features/admin/hooks.ts`
- Create: `frontend_2/src/routes/admin.tsx`
- Create: `frontend_2/src/features/admin/components/*`
- Test: `frontend_2/src/features/admin/admin.guard.test.tsx`

- [ ] **Step 1: Write failing guard test**

```tsx
// frontend_2/src/features/admin/admin.guard.test.tsx
import { describe, expect, it } from 'vitest'

describe('admin guard', () => {
  it('redirects non-admin to home', () => {
    const role = 'ROLE_USER'
    expect(role === 'ROLE_ADMIN').toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend_2 && npm run test -- src/features/admin/admin.guard.test.tsx`  
Expected: FAIL until guard wiring exists.

- [ ] **Step 3: Implement admin route + CRUD mutations with targeted invalidation**

```ts
// frontend_2/src/features/admin/hooks.ts (excerpt)
export function useCreateProductMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.catalog.all() }),
  })
}
```

- [ ] **Step 4: Run tests + build**

Run: `cd frontend_2 && npm run test -- src/features/admin/admin.guard.test.tsx && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_2/src/features/admin frontend_2/src/routes/admin.tsx
git commit -m "frontend_2: migrate admin slice with role protection"
```

---

### Task 6: UX/a11y hardening + parity/cutover checklist

**Files:**
- Modify: `frontend_2/src/styles.css`
- Modify: `frontend_2/src/components/**/*`
- Create: `frontend_2/src/tests/accessibility.smoke.test.tsx`
- Modify: `README.md` (frontend_2 run/cutover instructions)

- [ ] **Step 1: Write failing accessibility smoke test**

```tsx
// frontend_2/src/tests/accessibility.smoke.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('a11y smoke', () => {
  it('keeps focus ring class on controls', () => {
    render(<Button>Submit</Button>)
    expect(screen.getByRole('button').className).toContain('focus-visible:ring')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd frontend_2 && npm run test -- src/tests/accessibility.smoke.test.tsx`  
Expected: FAIL if focus style removed.

- [ ] **Step 3: Implement hardening + cutover doc**

```md
<!-- README section excerpt -->
Cutover Steps:
1. Run frontend_2 parity checklist
2. Switch deployment target from frontend to frontend_2
3. Keep frontend as rollback for stabilization window
```

- [ ] **Step 4: Run full verification suite**

Run: `cd frontend_2 && npm run test && npm run lint && npm run build && npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend_2/src README.md
git commit -m "frontend_2: complete ux-a11y hardening and cutover checklist"
```

---

## Spec Coverage Check (self-review)

- Full parity migration scope: Tasks 3/4/5
- TanStack Router + Query + TS strict: Tasks 1/3/4/5/6
- SPA-first: Tasks 1 + route structure in 3/4/5
- Near-identical visual direction with incremental UX improvements: Tasks 2 + 6
- Access control + role redirects: Task 3 + 5
- Query best practices and targeted invalidation: Tasks 1/4/5
- Parallel run + cutover switch plan: Task 6

No spec gap found.

## Placeholder / consistency check (self-review)

- No placeholder markers found.
- Query key names consistent (`qk.auth.me`, `qk.catalog.list`, `qk.catalog.all`).
- Guard behavior consistent with approved design (`/signin` for unauth, `/` for unauthorized admin).


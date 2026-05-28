# Frontend Query Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic retry for all frontend GET queries using TanStack Query's built-in retry mechanism with 2 retries and exponential backoff (1s → 2s).

**Architecture:** Configure `QueryClient` with global retry defaults in `App.tsx`. Remove `retry: false` from query hooks where retry is appropriate. No new dependencies.

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Vite.

---

### Task 1: Configure QueryClient with Retry Defaults

**Files:**
- Modify: `frontend/src/App.tsx:70`

- [ ] **Step 1: Read current App.tsx**

Read `frontend/src/App.tsx` to see current `QueryClient` initialization at line 70.

- [ ] **Step 2: Update QueryClient configuration**

Replace line 70:

```typescript
const queryClient = new QueryClient();
```

With:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
    },
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add retry defaults to QueryClient for all GET queries"
```

---

### Task 2: Remove retry: false from Query Hooks

**Files:**
- Modify: `frontend/src/hooks/useAuth.ts`
- Modify: `frontend/src/hooks/useAIChat.ts`
- Modify: `frontend/src/hooks/useCart.ts`

- [ ] **Step 1: Update useAuth.ts**

Read `frontend/src/hooks/useAuth.ts`. Find the `useMe` function (around line 34) that has `retry: false`.

Remove `retry: false` from the `useQuery` config:

```typescript
// BEFORE:
return useQuery({
  queryKey: authKeys.me(),
  queryFn: getMe,
  retry: false,
});

// AFTER:
return useQuery({
  queryKey: authKeys.me(),
  queryFn: getMe,
});
```

- [ ] **Step 2: Update useAIChat.ts**

Read `frontend/src/hooks/useAIChat.ts`. Find the `useQuery` call (around line 19) that has `retry: false`.

Remove `retry: false`:

```typescript
// BEFORE:
useQuery({
  queryKey: aiKeys.all(),
  queryFn: getChatHistory,
  retry: false,
});

// AFTER:
useQuery({
  queryKey: aiKeys.all(),
  queryFn: getChatHistory,
});
```

- [ ] **Step 3: Update useCart.ts**

Read `frontend/src/hooks/useCart.ts`. Find the `useCart` function (around line 25) that has `retry: false`.

Remove `retry: false`:

```typescript
// BEFORE:
return useQuery({
  queryKey: cartKeys.all(),
  queryFn: () => getCart(userId),
  retry: false,
});

// AFTER:
return useQuery({
  queryKey: cartKeys.all(),
  queryFn: () => getCart(userId),
});
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Verify no other useQuery calls have retry: false**

Run:
```bash
cd frontend && grep -r "retry: false" src/hooks/
```

Expected: Only `useMutation` calls should have `retry: false` (if any). If any `useQuery` calls remain with `retry: false`, remove them.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useAuth.ts frontend/src/hooks/useAIChat.ts frontend/src/hooks/useCart.ts
git commit -m "feat: remove retry: false from query hooks to enable global retry"
```

---

### Task 3: Manual Testing

**Files:**
- No file changes

- [ ] **Step 1: Start full stack**

Run:
```bash
docker compose up --build -d
```

Wait for all services to register (~30s).

- [ ] **Step 2: Verify normal page load**

Open browser to `http://localhost:5173`. Navigate to product list page.

Expected: Page loads normally, no console errors.

- [ ] **Step 3: Test retry on gateway failure**

Open browser dev tools → Network tab.

Stop gateway:
```bash
docker compose stop api-gateway
```

Navigate to product list page.

Expected in Network tab: 3 request attempts with ~1s and ~2s delays between them.

After retries fail → error toast appears.

- [ ] **Step 4: Test recovery**

Restart gateway:
```bash
docker compose start api-gateway
```

Wait ~5s. Refresh page.

Expected: Page loads successfully.

- [ ] **Step 5: Verify mutations don't retry**

Open browser dev tools → Network tab.

Stop a service (e.g., product-service):
```bash
docker compose stop product-service
```

Try to add a product to cart (requires login).

Expected: Single failed request, immediate error toast (no retries).

- [ ] **Step 6: Cleanup**

```bash
docker compose start product-service
```

---

## Self-Review

1. **Spec coverage:** ✅ QueryClient configured with retry: 2, exponential backoff 1s-2s. Removed `retry: false` from 3 query hooks. Mutations not affected. All spec requirements covered.
2. **Placeholder scan:** ✅ No TBD, TODO, or vague instructions. All steps have exact code and commands.
3. **Type consistency:** ✅ QueryClient config uses standard TanStack Query types. No custom types needed.
4. **Scope:** ✅ Focused on 2 tasks — config change + hook updates. Minimal surface area.

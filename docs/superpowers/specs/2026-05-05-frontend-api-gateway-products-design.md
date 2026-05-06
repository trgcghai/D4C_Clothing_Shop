# Frontend Wiring Design: API Gateway + Axios + TanStack Query (Products Phase)

Date: 2026-05-05
Scope: frontend product flows only. No backend API creation.

## 1) Goal
Move frontend product data access from direct service calls (`fetch` with legacy base URL) to API Gateway through a shared `axios` client and TanStack Query for server-state handling.

Target base URL:
- `VITE_API_BASE_URL=http://localhost:8080/api`

Out of scope:
- Creating new API endpoints
- Changing gateway routing rules
- Wiring auth/users flows in this phase

## 2) Current State
Frontend currently performs direct `fetch` calls and embeds fallback API URL in multiple files. Product-related reads and writes are spread across pages/components/hooks.

Gateway already exposes relevant paths:
- `/api/products/**`
- `/api/users/**`
- `/api/auth/**`

This phase uses only existing product endpoints via `/api/products`.

## 3) Existing Endpoints To Reuse (No New API)
- `GET /products`
- `GET /products/:id`
- `GET /products/:id/related`
- `POST /products`
- `PUT /products/:id`
- `DELETE /products/:id`

All requests route through gateway base `/api`.

## 4) Proposed Architecture
### 4.1 Network Layer
Create shared axios client in `frontend/src/lib/http.js`:
- `baseURL` from `import.meta.env.VITE_API_BASE_URL`
- fallback: `http://localhost:8080/api`
- default JSON headers
- request timeout

Single client centralizes URL management and request defaults.

### 4.2 Query Layer
Create QueryClient in `frontend/src/lib/queryClient.js` and wrap app in `QueryClientProvider` in `frontend/src/main.jsx`.

Use stable query keys:
- `['products', params]`
- `['product', productId]`
- `['relatedProducts', productId]`

Mutation invalidation policy:
- create/update/delete invalidates product list and product detail keys.

### 4.3 API Module
Create `frontend/src/api/products.js` with typed-by-convention functions:
- `getProducts(params)`
- `getProductById(id)`
- `getRelatedProducts(id)`
- `createProduct(payload)`
- `updateProduct(id, payload)`
- `deleteProduct(id)`

All functions use shared axios instance and return normalized response data.

### 4.4 React Hooks
Refactor/add hooks in `frontend/src/hooks`:
- `useProductsQuery(params)`
- `useProductQuery(id)`
- `useRelatedProductsQuery(id)`
- `useCreateProductMutation()`
- `useUpdateProductMutation()`
- `useDeleteProductMutation()`

Hooks own cache keys and invalidation behavior. UI components stop doing raw network calls.

## 5) Frontend Integration Plan (Products Only)
Update product-related callers to consume query/mutation hooks:
- `frontend/src/hooks/useProducts.js`
- `frontend/src/pages/product.jsx`
- `frontend/src/pages/admin.jsx`
- `frontend/src/components/addProducts.jsx`
- `frontend/src/components/editProductForm.jsx`
- `frontend/src/components/deleteProductPanel.jsx`

Replace direct `fetch` usage with query/mutation patterns while preserving existing UI behavior.

## 6) Data Flow
1. UI calls query hook.
2. Hook calls API module function.
3. API module uses shared axios client -> gateway `/api`.
4. TanStack Query caches response by query key.
5. Mutations run via API module and invalidate affected keys.
6. UI auto-refreshes from cache re-fetch.

## 7) Error/Loading Behavior
- Use TanStack Query states: `isLoading`, `isError`, `error`, `isFetching`.
- Keep existing skeleton/loading UX where present.
- Avoid silent failures; surface mutation errors to existing toast/alert patterns.

## 8) Environment & Config
Frontend env variable:
- `VITE_API_BASE_URL=http://localhost:8080/api`

If missing, fallback keeps local dev functional. All hardcoded old service URLs should be removed from product flow files.

## 9) Testing Strategy
Given current repo status:
- No formal frontend test suite requirement in this phase.
- Validate manually:
  - Product list load + pagination/filter path still works
  - Product detail + related products load
  - Admin create/update/delete product success path
  - Error paths (gateway down / 4xx/5xx) show non-silent feedback

Optional lightweight verification:
- `npm run lint` in `frontend/`
- Dev run smoke check through gateway URL.

## 10) Risks & Mitigations
- Risk: stale UI after mutations.
  - Mitigation: explicit query invalidation for list/detail keys.
- Risk: param object instability causing cache misses.
  - Mitigation: keep params shape consistent; avoid ad-hoc key fragments.
- Risk: mixed old/new networking remains.
  - Mitigation: remove/replace all product `fetch` call sites in scoped files.

## 11) Success Criteria
- Product pages/components no longer call `fetch` directly.
- Product API traffic uses gateway base URL (`/api` via `VITE_API_BASE_URL`).
- Create/update/delete trigger correct list/detail refresh.
- Existing visible behavior remains functionally equivalent.

## 12) Decomposition & Next Phase
This spec intentionally scopes to one bounded slice (products). Auth/users migration can be separate spec/plan after this lands.

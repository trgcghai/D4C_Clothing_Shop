# Frontend_2 Cleanup, UI Migration, API Proxy & Docker Design

## Problem

`frontend_2` has three categories of unfinished work:
1. Test/demo files and dependencies clutter the codebase
2. Several components use raw HTML instead of shadcn/ui primitives
3. API calls go to localhost:3000 (the frontend itself) instead of the API gateway at localhost:8080
4. No Docker configuration for `frontend_2`; docker-compose still references old `frontend`

## Scope

In scope:
- Remove all test files, demo files, and related dependencies from `frontend_2`
- Migrate raw HTML components to shadcn/ui primitives (Table, Select, Checkbox, Label, Dialog)
- Configure Vite proxy so `/api` requests route to the API gateway (localhost:8080 in dev, api-gateway:8080 in Docker)
- Create Dockerfile for `frontend_2` and update docker-compose files

Out of scope:
- New features or visual redesign
- SSR vs CSR architecture changes
- CI/CD pipeline changes

## Architecture

### API Proxy Flow

```
Browser → frontend_2:3000 → Vite proxy → API gateway:8080/api → backend services
```

All API calls use relative paths (`/api/...`). Vite dev server and preview server proxy `/api` prefix to the configured target.

### shadcn Component Map

| Component | Current | Target shadcn |
|---|---|---|
| Admin product table | div-based card list | `<Table>` with columns |
| Admin form selects | raw `<select>` | `<Select>` |
| Admin form checkbox | raw `<input type="checkbox">` | `<Checkbox>` + `<Label>` |
| Admin delete confirm | none (direct call) | `<Dialog>` confirmation |
| Catalog filters | raw buttons/inputs | `<Checkbox>` + `<Select>` |
| Form labels | raw `<label>` with text | `<Label>` primitive |

## Section 1: Remove Tests & Demos

### Files to Delete

**Test files (7):**
- `src/components/__tests__/header.a11y.test.tsx`
- `src/tests/accessibility.smoke.test.tsx`
- `src/features/admin/admin.guard.test.tsx`
- `src/lib/query/keys.test.ts`
- `src/features/catalog/catalog.keys.test.ts`
- `src/features/auth/auth.flow.test.tsx`
- `src/lib/api/http.test.ts`

**Demo files (5):**
- `src/lib/demo-store.ts`
- `src/lib/demo-store-devtools.tsx`
- `src/data/demo-table-data.ts`
- `src/routes/demo/store.tsx`
- `src/routes/demo/table.tsx`
- `src/routes/about.tsx` (demo route)

**Directories to remove:**
- `src/components/__tests__/`
- `src/tests/`
- `src/routes/demo/`
- `src/data/` (if empty after deletion)

### package.json Changes

**Remove dependencies:**
- `@faker-js/faker`
- `@tanstack/react-devtools`
- `@tanstack/react-router-devtools`
- `@tanstack/react-table`

**Remove devDependencies:**
- `@testing-library/dom`
- `@testing-library/react`
- `@tanstack/devtools-event-client`
- `@tanstack/devtools-vite`
- `jsdom`
- `vitest`

**Remove scripts:**
- `test`

### vite.config.ts Changes

- Remove `devtools` import and plugin usage
- Remove test-related config if any

### __root.tsx Changes

- Remove `TanStackRouterDevtoolsPanel`, `TanStackDevtools`, `StoreDevtools` imports
- Remove devtools rendering block

## Section 2: Vite API Proxy

### vite.config.ts

Add proxy configuration for both dev and preview servers:

```ts
const apiProxyTarget = process.env.VITE_API_PROXY_URL || 'http://localhost:8080'

server: {
  proxy: {
    '/api': { target: apiProxyTarget, changeOrigin: true },
  },
},
preview: {
  proxy: {
    '/api': { target: apiProxyTarget, changeOrigin: true },
  },
},
```

### http.ts Changes

- Change `API_BASE_URL` default from `''` to `''` (keep empty — all calls use relative `/api/...` paths)
- Simplify `buildUrl()` since all paths are now relative
- Remove `VITE_API_URL` env fallback (no longer needed)

### .env.example (new file)

```
VITE_API_PROXY_URL=http://localhost:8080
```

### Dockerfile ARG

```
ARG VITE_API_PROXY_URL=http://api-gateway:8080
ENV VITE_API_PROXY_URL=${VITE_API_PROXY_URL}
```

## Section 3: shadcn UI Migration

### New shadcn Components to Install

Using `npx shadcn@latest add`:
- `table` — admin product table
- `select` — form dropdowns, filter dropdowns
- `checkbox` — form checkboxes, filter chips
- `label` — form labels

### admin-product-table.tsx

Replace div-based card list with `<Table>`:
- Columns: Name, Category, Brand, Price, Stock, Actions
- Use `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>`
- Keep search filter Input at top
- Keep loading/empty states

### admin-product-form.tsx

Replace raw HTML elements:
- `<select>` → `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>`
- `<input type="checkbox">` → `<Checkbox>` + `<Label>`
- Raw `<label>` wrappers → `<Label>` + separate input
- Add `<Dialog>` for delete confirmation (in admin.tsx route)

### catalog-filters.tsx

Replace raw buttons/inputs:
- Filter chips → `<Checkbox>` with labels
- Price range buttons → `<Select>` with options
- Keep collapsible section structure
- Keep clear-all button

### catalog-filters.tsx — FilterSection

Keep as-is but replace toggle button with proper accessible pattern.

## Section 4: Docker Configuration

### frontend_2/Dockerfile (new)

Multi-stage build:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_PROXY_URL=http://api-gateway:8080
ENV VITE_API_PROXY_URL=${VITE_API_PROXY_URL}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build --chown=nodeuser:nodejs /app ./
USER nodeuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3000 >/dev/null || exit 1
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
```

### docker-compose.yml Changes

Replace `frontend` service with `frontend_2`:
- Build context: `./frontend_2`
- Port: `3000:3000`
- Env file: `./frontend_2/.env`
- Container name: `frontend_2`
- Healthcheck port: `3000`

### docker-compose.dev.yml Changes

Replace `frontend` service override with `frontend_2`:
- Build context: `./frontend_2`
- Volumes: `./frontend_2:/app`
- Volume name: `frontend_2_node_modules`
- Dev command: `npm run dev -- --host 0.0.0.0 --port 3000`

## Error Handling

- Proxy errors: Vite will log proxy failures in dev mode. In production (preview), same-origin requests will fail if gateway is unreachable — this is expected behavior.
- shadcn migration: All existing functionality must be preserved. No visual regression beyond improved accessibility.
- Docker: Healthcheck must pass before dependent services consider frontend ready.

## Testing & Verification

1. `npm run build` — production build succeeds
2. `npm run dev` — dev server starts, `/api` requests proxy correctly
3. `npx tsc --noEmit` — TypeScript strict passes
4. Manual: Sign in, browse products, admin CRUD all work
5. Docker: `docker compose up --build` starts all services, frontend proxies to gateway

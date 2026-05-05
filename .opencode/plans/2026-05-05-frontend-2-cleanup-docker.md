# Frontend_2 Cleanup, UI Migration, API Proxy & Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove test/demo files, migrate raw HTML to shadcn/ui, configure Vite API proxy, and set up Docker for frontend_2.

**Architecture:** Vertical-slice changes: cleanup first, then API proxy, then shadcn UI migration, finally Docker config. Each task produces a working, testable state.

**Tech Stack:** React 19, TypeScript strict, TanStack Start, Vite, shadcn/ui, Tailwind CSS 4, Docker

---

### Task 1: Remove all test and demo files + dependencies

**Files to Delete:**
- `src/components/__tests__/header.a11y.test.tsx`
- `src/tests/accessibility.smoke.test.tsx`
- `src/features/admin/admin.guard.test.tsx`
- `src/lib/query/keys.test.ts`
- `src/features/catalog/catalog.keys.test.ts`
- `src/features/auth/auth.flow.test.tsx`
- `src/lib/api/http.test.ts`
- `src/lib/demo-store.ts`
- `src/lib/demo-store-devtools.tsx`
- `src/data/demo-table-data.ts`
- `src/routes/demo/store.tsx`
- `src/routes/demo/table.tsx`
- `src/routes/about.tsx`

**Files to Modify:**
- `package.json` — remove test/demo deps and scripts
- `vite.config.ts` — remove devtools plugin
- `src/routes/__root.tsx` — remove devtools imports and rendering

- [ ] **Step 1: Delete all test and demo files**

Run these commands from `frontend_2/`:
```bash
rm -rf src/components/__tests__
rm -rf src/tests
rm -rf src/routes/demo
rm -rf src/data
rm src/features/admin/admin.guard.test.tsx
rm src/lib/query/keys.test.ts
rm src/features/catalog/catalog.keys.test.ts
rm src/features/auth/auth.flow.test.tsx
rm src/lib/api/http.test.ts
rm src/lib/demo-store.ts
rm src/lib/demo-store-devtools.tsx
rm src/routes/about.tsx
```

- [ ] **Step 2: Update package.json — remove deps and test script**

Replace entire package.json with:
```json
{
  "name": "frontend_2",
  "private": true,
  "type": "module",
  "imports": {
    "#/*": "./src/*"
  },
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint",
    "format": "prettier --write . && eslint --fix",
    "check": "prettier --check ."
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@tanstack/match-sorter-utils": "latest",
    "@tanstack/react-router": "latest",
    "@tanstack/react-router-ssr-query": "latest",
    "@tanstack/react-start": "latest",
    "@tanstack/react-store": "latest",
    "@tanstack/router-plugin": "^1.132.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.577.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "tailwind-merge": "^3.0.2",
    "tailwindcss": "^4.1.18",
    "tw-animate-css": "^1.3.6"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.16",
    "@tanstack/eslint-config": "latest",
    "@types/node": "^22.10.2",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.20.0",
    "prettier": "^3.8.1",
    "typescript": "^6.0.2",
    "vite": "^8.0.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "lightningcss"
    ]
  }
}
```

Removed: `@faker-js/faker`, `@tanstack/react-devtools`, `@tanstack/react-router-devtools`, `@tanstack/react-table`, `@testing-library/dom`, `@testing-library/react`, `@tanstack/devtools-event-client`, `@tanstack/devtools-vite`, `jsdom`, `vitest`, `test` script.

- [ ] **Step 3: Update vite.config.ts — remove devtools**

Replace entire vite.config.ts:
```ts
import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})

export default config
```

- [ ] **Step 4: Update __root.tsx — remove devtools**

Replace entire __root.tsx:
```tsx
import { HeadContent, Scripts, Outlet, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { queryClient } from '@/lib/query/client'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'D4C Clothing Shop' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      <Outlet />
      <Footer />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface-strong)] focus:px-3 focus:py-2 focus:text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
        <Scripts />
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Reinstall dependencies and verify**

```bash
cd frontend_2
npm install
npm run build
npx tsc --noEmit
```

Expected: Build succeeds, no test/devtools imports remain.

- [ ] **Step 6: Commit**

```bash
git add frontend_2/src frontend_2/package.json frontend_2/package-lock.json frontend_2/vite.config.ts
git commit -m "frontend_2: remove all test/demo files and dependencies"
```

---

### Task 2: Configure Vite API proxy + fix http.ts

**Files to Modify:**
- `vite.config.ts` — add proxy config
- `src/lib/api/http.ts` — simplify to use relative paths
- Create: `.env.example`

- [ ] **Step 1: Add proxy config to vite.config.ts**

Replace vite.config.ts:
```ts
import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget = process.env.VITE_API_PROXY_URL || 'http://localhost:8080'

const proxyConfig = {
  '/api': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  server: { proxy: proxyConfig },
  preview: { proxy: proxyConfig },
})

export default config
```

- [ ] **Step 2: Simplify http.ts to use relative paths**

Replace entire http.ts:
```ts
import { ApiError, toApiError } from './errors'
import type { ApiErrorDetails } from './errors'

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

type RefreshTokenHandler = () => Promise<string | null>

const REFRESH_TOKEN_PATH = '/api/auth/refresh-token'
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const

let accessToken: string | null = null
let refreshTokenHandler: RefreshTokenHandler | null = null
let refreshTokenPromise: Promise<string | null> | null = null

function isRefreshTokenRequest(path: string) {
  return path === REFRESH_TOKEN_PATH
}

function isBodyInit(body: unknown): body is BodyInit {
  if (typeof body === 'string' || body instanceof Blob || body instanceof FormData) {
    return true
  }
  if (body instanceof URLSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return true
  }
  return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
}

function toBody(body: unknown): BodyInit | undefined {
  if (body == null) return undefined
  if (isBodyInit(body)) return body
  return JSON.stringify(body)
}

function shouldSetJsonContentType(body: unknown): boolean {
  return body == null || typeof body === 'string' || (!isBodyInit(body) && !(body instanceof URLSearchParams))
}

async function parseErrorDetails(response: Response): Promise<ApiErrorDetails | undefined> {
  const contentType = response.headers.get('content-type')
  if (!contentType) return undefined
  try {
    if (contentType.includes('application/json')) {
      return (await response.json()) as ApiErrorDetails
    }
    const text = await response.text()
    if (!text) return undefined
    return { message: text }
  } catch {
    return undefined
  }
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) return undefined as T
  const payload = await response.text()
  if (!payload) return undefined as T
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) return JSON.parse(payload) as T
  return payload as T
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshTokenHandler) return null
  if (!refreshTokenPromise) {
    refreshTokenPromise = refreshTokenHandler().finally(() => {
      refreshTokenPromise = null
    })
  }
  return refreshTokenPromise
}

async function requestInternal<T>(path: string, options: RequestOptions = {}, allowRefresh = true): Promise<T> {
  const headers: Record<string, string> = { ...DEFAULT_HEADERS, ...options.headers }
  const rawBody = options.body
  const body = toBody(rawBody)

  if (!shouldSetJsonContentType(rawBody)) delete headers['Content-Type']
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(path, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
    body,
  })

  if (response.status === 401 && allowRefresh && !isRefreshTokenRequest(path)) {
    if (refreshTokenHandler) {
      try {
        const refreshedToken = await refreshAccessToken()
        if (refreshedToken) {
          accessToken = refreshedToken
          return requestInternal<T>(path, options, false)
        }
      } catch {
        // fall through
      }
    }
    accessToken = null
  }

  if (!response.ok) {
    const details = await parseErrorDetails(response)
    const message = typeof details?.message === 'string' ? details.message : response.statusText || 'Request failed'
    throw new ApiError(message, response.status, details)
  }

  return await parseSuccess<T>(response)
}

export async function http<T>(path: string, options?: RequestOptions): Promise<T> {
  try {
    return await requestInternal<T>(path, options)
  } catch (error) {
    throw toApiError(error)
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setRefreshTokenHandler(handler: RefreshTokenHandler | null) {
  refreshTokenHandler = handler
}
```

- [ ] **Step 3: Create .env.example**

```
VITE_API_PROXY_URL=http://localhost:8080
```

- [ ] **Step 4: Verify build**

```bash
cd frontend_2
npm run build
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend_2/vite.config.ts frontend_2/src/lib/api/http.ts frontend_2/.env.example
git commit -m "frontend_2: add Vite API proxy and simplify http client to use relative paths"
```

---

### Task 3: Install shadcn/ui primitives (Table, Select, Checkbox, Label)

**Files to Create:**
- `src/components/ui/table.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/label.tsx`

**Files to Modify:**
- `package.json` — add Radix UI deps

- [ ] **Step 1: Install dependencies**

```bash
cd frontend_2
npm install @radix-ui/react-select @radix-ui/react-checkbox @radix-ui/react-label
```

- [ ] **Step 2: Create table.tsx**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th className={cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)} {...props} />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
```

- [ ] **Step 3: Create select.tsx**

```tsx
import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="size-4 opacity-50" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content data-slot="select-content" className={cn('relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1', className)} position={position} {...props}>
        <SelectPrimitive.Viewport className={cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }
```

- [ ] **Step 4: Create checkbox.tsx**

```tsx
import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root data-slot="checkbox" className={cn('peer size-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground', className)} {...props}>
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center text-current">
        <Check className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
```

- [ ] **Step 5: Create label.tsx**

```tsx
import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root data-slot="label" className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />
  )
}

export { Label }
```

- [ ] **Step 6: Verify build**

```bash
cd frontend_2
npm run build
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend_2/src/components/ui/table.tsx frontend_2/src/components/ui/select.tsx frontend_2/src/components/ui/checkbox.tsx frontend_2/src/components/ui/label.tsx frontend_2/package.json frontend_2/package-lock.json
git commit -m "frontend_2: add shadcn Table, Select, Checkbox, Label primitives"
```

---

### Task 4: Migrate admin-product-table to shadcn Table

**Files to Modify:**
- `src/features/admin/components/admin-product-table.tsx`

- [ ] **Step 1: Rewrite using shadcn Table**

Replace entire file:
```tsx
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Product } from '@/features/catalog/api'

import { getTotalStock } from '../hooks'

interface AdminProductTableProps {
  readonly products: readonly Product[]
  readonly isLoading: boolean
  readonly isDeleting: boolean
  readonly onEdit: (product: Product) => void
  readonly onDelete: (product: Product) => void
}

export function AdminProductTable({ products, isLoading, isDeleting, onEdit, onDelete }: AdminProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) return products
    return products.filter((product) => {
      const fields = [product.name, product.brand, product.category]
      return fields.some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery))
    })
  }, [normalizedQuery, products])

  return (
    <Card>
      <CardHeader><CardTitle>Danh sách sản phẩm</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm theo tên, brand, danh mục" aria-label="Tìm sản phẩm trong admin" />
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải sản phẩm...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có sản phẩm phù hợp.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead className="hidden md:table-cell">Danh mục</TableHead>
                <TableHead className="hidden lg:table-cell">Thương hiệu</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead className="hidden sm:table-cell">Tồn kho</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.category ?? 'N/A'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{product.brand ?? 'N/A'}</TableCell>
                  <TableCell>{Number(product.price).toLocaleString('vi-VN')}₫</TableCell>
                  <TableCell className="hidden sm:table-cell">{getTotalStock(product)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(product)}>Sửa</Button>
                      <Button type="button" size="sm" onClick={() => onDelete(product)} disabled={isDeleting}>{isDeleting ? 'Đang xoá...' : 'Xoá'}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend_2 && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend_2/src/features/admin/components/admin-product-table.tsx
git commit -m "frontend_2: migrate admin product table to shadcn Table component"
```

---

### Task 5: Migrate admin-product-form to shadcn Select, Checkbox, Label

**Files to Modify:**
- `src/features/admin/components/admin-product-form.tsx`

- [ ] **Step 1: Rewrite using shadcn primitives**

Replace entire file with the version that uses:
- `<Select>` for category, gender, brand dropdowns
- `<Checkbox>` + `<Label>` for isFeatured checkbox
- `<Label>` for all form field labels
- `<textarea>` with shadcn-compatible classes (no shadcn textarea component needed)
- Keep color picker as Button chips (already uses shadcn Button)
- Keep stock inputs with `<Label>` + `<Input>`

Key changes from current code:
- Replace `<label className="block text-sm ...">` wrappers with `<Label htmlFor="...">` + separate input with `id`
- Replace `<select>` with `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>`
- Replace `<input type="checkbox">` with `<Checkbox>` + `<Label>`

Full replacement code:
```tsx
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Product } from '@/features/catalog/api'

const CATEGORY_OPTIONS = ['Áo', 'Quần', 'Giày', 'Phụ kiện']
const GENDER_OPTIONS = ['Nam', 'Nữ', 'Unisex']
const BRAND_OPTIONS = ['D4C', 'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Local Brand']
const COLOR_OPTIONS = ['Đen', 'Trắng', 'Xám', 'Đỏ', 'Xanh Navy', 'Xanh Dương', 'Xanh Lá', 'Vàng', 'Hồng', 'Nâu']
const SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

interface StockInput { readonly size: string; readonly quantity: number }
interface AdminProductFormState {
  readonly name: string; readonly description: string; readonly price: string
  readonly category: string; readonly gender: string; readonly brand: string
  readonly colors: readonly string[]; readonly tags: readonly string[]
  readonly isFeatured: boolean; readonly stock: readonly StockInput[]
}
interface AdminProductFormSubmitPayload { readonly id?: string; readonly formData: FormData }
interface AdminProductFormProps {
  readonly mode: 'create' | 'edit'; readonly product?: Product
  readonly isSubmitting: boolean
  readonly onSubmit: (payload: AdminProductFormSubmitPayload) => Promise<void>
  readonly onCancelEdit?: () => void
}

function buildDefaultStock(stock: readonly { size: string; quantity: number | string }[] | undefined): readonly StockInput[] {
  return SIZE_LIST.map((size) => {
    const current = stock?.find((item) => item.size === size)
    return { size, quantity: Number(current?.quantity ?? 0) }
  })
}

function toInitialState(product?: Product): AdminProductFormState {
  return {
    name: product?.name ?? '', description: product?.description ?? '',
    price: product?.price != null ? String(product.price) : '',
    category: product?.category ?? 'Áo', gender: product?.gender ?? 'Unisex',
    brand: product?.brand ?? 'D4C', colors: product?.colors ?? [],
    tags: product?.tags ?? [], isFeatured: Boolean(product?.isFeatured),
    stock: buildDefaultStock(product?.stock),
  }
}

function createFormData(state: AdminProductFormState, imageFile: File | null) {
  const payload = new FormData()
  payload.append('name', state.name); payload.append('description', state.description)
  payload.append('price', state.price); payload.append('stock', JSON.stringify(state.stock))
  payload.append('category', state.category); payload.append('gender', state.gender)
  payload.append('brand', state.brand); payload.append('colors', JSON.stringify(state.colors))
  payload.append('tags', JSON.stringify(state.tags)); payload.append('isFeatured', String(state.isFeatured))
  if (imageFile) payload.append('productImage', imageFile)
  return payload
}

export function AdminProductForm({ mode, product, isSubmitting, onSubmit, onCancelEdit }: AdminProductFormProps) {
  const [state, setState] = useState<AdminProductFormState>(() => toInitialState(product))
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [tagInput, setTagInput] = useState(state.tags.join(', '))

  useEffect(() => {
    const next = toInitialState(product); setState(next); setTagInput(next.tags.join(', ')); setImageFile(null)
  }, [product])

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(() => { if (!previewUrl) return; return () => URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const handleStockChange = (size: string, quantity: number) => {
    setState((prev) => ({ ...prev, stock: prev.stock.map((item) => (item.size === size ? { ...item, quantity } : item)) }))
  }

  const toggleColor = (color: string) => {
    setState((prev) => ({ ...prev, colors: prev.colors.includes(color) ? prev.colors.filter((c) => c !== color) : [...prev.colors, color] }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = createFormData(state, imageFile)
    await onSubmit({ id: mode === 'edit' ? product?.id : undefined, formData })
    if (mode === 'create') { const next = toInitialState(); setState(next); setTagInput(''); setImageFile(null) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'edit' ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</CardTitle>
        <CardDescription>{mode === 'edit' ? 'Cập nhật thông tin và tồn kho.' : 'Tạo sản phẩm mới cho catalog.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="product-name">Tên sản phẩm</Label>
              <Input id="product-name" value={state.name} onChange={(e) => setState((p) => ({ ...p, name: e.target.value }))} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Mô tả</Label>
              <textarea id="product-description" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={state.description} onChange={(e) => setState((p) => ({ ...p, description: e.target.value }))} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Giá (VNĐ)</Label>
              <Input id="product-price" type="number" min={0} value={state.price} onChange={(e) => setState((p) => ({ ...p, price: e.target.value }))} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-image">Ảnh sản phẩm</Label>
              <Input id="product-image" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} disabled={isSubmitting} required={mode === 'create'} />
            </div>
            {(previewUrl || product?.imageUrl) && (
              <img src={previewUrl ?? product?.imageUrl} alt={state.name || 'Product preview'} className="h-24 w-24 rounded-lg border border-border object-cover" />
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-category">Danh mục</Label>
                <Select value={state.category} onValueChange={(v) => setState((p) => ({ ...p, category: v }))} disabled={isSubmitting}>
                  <SelectTrigger id="product-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-gender">Giới tính</Label>
                <Select value={state.gender} onValueChange={(v) => setState((p) => ({ ...p, gender: v }))} disabled={isSubmitting}>
                  <SelectTrigger id="product-gender"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-brand">Thương hiệu</Label>
              <Select value={state.brand} onValueChange={(v) => setState((p) => ({ ...p, brand: v }))} disabled={isSubmitting}>
                <SelectTrigger id="product-brand"><SelectValue /></SelectTrigger>
                <SelectContent>{BRAND_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-tags">Tags (ngăn cách bởi dấu phẩy)</Label>
              <Input id="product-tags" value={tagInput} onChange={(e) => { setTagInput(e.target.value); setState((p) => ({ ...p, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })) }} disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label>Màu sắc</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <Button key={color} type="button" size="sm" variant={state.colors.includes(color) ? 'default' : 'outline'} onClick={() => toggleColor(color)} disabled={isSubmitting}>{color}</Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Số lượng theo size</Label>
              <div className="grid grid-cols-3 gap-2">
                {state.stock.map((item) => (
                  <div key={item.size} className="space-y-1">
                    <Label htmlFor={`stock-${item.size}`} className="text-xs text-muted-foreground">{item.size}</Label>
                    <Input id={`stock-${item.size}`} type="number" min={0} value={item.quantity} onChange={(e) => handleStockChange(item.size, Number(e.target.value))} disabled={isSubmitting} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="product-featured" checked={state.isFeatured} onCheckedChange={(c) => setState((p) => ({ ...p, isFeatured: c === true }))} disabled={isSubmitting} />
              <Label htmlFor="product-featured">Đánh dấu sản phẩm nổi bật</Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : mode === 'edit' ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm'}</Button>
              {mode === 'edit' && <Button type="button" variant="outline" onClick={onCancelEdit} disabled={isSubmitting}>Huỷ sửa</Button>}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend_2 && npm run build && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend_2/src/features/admin/components/admin-product-form.tsx
git commit -m "frontend_2: migrate admin form to shadcn Select, Checkbox, Label primitives"
```

---

### Task 6: Migrate catalog-filters to shadcn Checkbox + Select

**Files to Modify:**
- `src/features/catalog/components/catalog-filters.tsx`

- [ ] **Step 1: Rewrite using shadcn primitives**

Replace entire file:
```tsx
import { ChevronDown, ChevronUp, FilterX, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type { ProductListParams } from '../api'

interface CatalogFiltersProps {
  readonly filters: Pick<ProductListParams, 'category' | 'gender' | 'size' | 'color' | 'brand' | 'minPrice' | 'maxPrice'>
  readonly activeCount: number
  readonly onChange: (next: Partial<ProductListParams>) => void
  readonly onClear: () => void
}

const GENDERS = ['Nam', 'Nữ', 'Unisex'] as const
const CATEGORIES = ['Áo', 'Quần', 'Giày', 'Phụ kiện'] as const
const BRANDS = ['D4C', 'Nike', 'Adidas', 'Zara', 'H&M', 'Uniqlo', 'Local Brand'] as const
const PRICE_RANGES = [
  { label: 'Tất cả', minPrice: '', maxPrice: '' },
  { label: 'Dưới 100.000₫', minPrice: '', maxPrice: '100000' },
  { label: '100.000 - 200.000₫', minPrice: '100000', maxPrice: '200000' },
  { label: '200.000 - 300.000₫', minPrice: '200000', maxPrice: '300000' },
  { label: '300.000 - 400.000₫', minPrice: '300000', maxPrice: '400000' },
  { label: 'Trên 400.000₫', minPrice: '400000', maxPrice: '' },
] as const

function FilterSection({ title, defaultOpen = true, children }: { readonly title: string; readonly defaultOpen?: boolean; readonly children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-border pb-4 last:border-b-0 last:pb-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between py-2 text-left text-sm font-semibold" aria-expanded={open}>
        <span>{title}</span>
        {open ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  )
}

export function CatalogFilters({ filters, activeCount, onChange, onClear }: CatalogFiltersProps) {
  const selectedPriceLabel = useMemo(() => PRICE_RANGES.find((r) => r.minPrice === (filters.minPrice ?? '') && r.maxPrice === (filters.maxPrice ?? ''))?.label ?? '', [filters.maxPrice, filters.minPrice])

  return (
    <Card className="sticky top-24">
      <CardHeader className="space-y-3 px-5 pt-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
            Bộ lọc
            {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{activeCount}</span>}
          </CardTitle>
          {activeCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 text-xs">
              <FilterX className="size-3.5" aria-hidden="true" /> Xóa
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <FilterSection title="Giới tính">
          <div className="space-y-2">
            {GENDERS.map((g) => (
              <div key={g} className="flex items-center space-x-2">
                <Checkbox id={`gender-${g}`} checked={filters.gender === g} onCheckedChange={(c) => onChange({ gender: c ? g : '' })} />
                <Label htmlFor={`gender-${g}`} className="text-sm font-normal cursor-pointer">{g}</Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Danh mục">
          <div className="space-y-2">
            {CATEGORIES.map((c) => (
              <div key={c} className="flex items-center space-x-2">
                <Checkbox id={`category-${c}`} checked={filters.category === c} onCheckedChange={(v) => onChange({ category: v ? c : '' })} />
                <Label htmlFor={`category-${c}`} className="text-sm font-normal cursor-pointer">{c}</Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Khoảng giá">
          <Select value={selectedPriceLabel || 'Tất cả'} onValueChange={(label) => { const r = PRICE_RANGES.find((p) => p.label === label); if (r) onChange({ minPrice: r.minPrice, maxPrice: r.maxPrice }) }}>
            <SelectTrigger><SelectValue placeholder="Chọn khoảng giá" /></SelectTrigger>
            <SelectContent>{PRICE_RANGES.map((r) => <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterSection>

        <FilterSection title="Thương hiệu" defaultOpen={false}>
          <div className="space-y-2">
            {BRANDS.map((b) => (
              <div key={b} className="flex items-center space-x-2">
                <Checkbox id={`brand-${b}`} checked={filters.brand === b} onCheckedChange={(v) => onChange({ brand: v ? b : '' })} />
                <Label htmlFor={`brand-${b}`} className="text-sm font-normal cursor-pointer">{b}</Label>
              </div>
            ))}
          </div>
        </FilterSection>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend_2 && npm run build && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend_2/src/features/catalog/components/catalog-filters.tsx
git commit -m "frontend_2: migrate catalog filters to shadcn Checkbox and Select primitives"
```

---

### Task 7: Create Dockerfile for frontend_2

**Files to Create:**
- `frontend_2/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

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

- [ ] **Step 2: Commit**

```bash
git add frontend_2/Dockerfile
git commit -m "frontend_2: add multi-stage Dockerfile with API proxy build arg"
```

---

### Task 8: Update docker-compose files

**Files to Modify:**
- `docker-compose.yml`
- `docker-compose.dev.yml`

- [ ] **Step 1: Update docker-compose.yml**

Replace entire file:
```yaml
services:
  discovery-server:
    build:
      context: ./DiscoveryServer
      dockerfile: Dockerfile
    container_name: discovery-server
    env_file:
      - ./DiscoveryServer/.env
    ports:
      - "8761:8761"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8761/actuator/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 40s
    networks:
      - d4c-net

  mariadb:
    image: mariadb:11
    container_name: mariadb
    restart: unless-stopped
    env_file:
      - ./.env
    ports:
      - "3307:3306"
    volumes:
      - mariadb_data:/var/lib/mysql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "mariadb-admin ping -h 127.0.0.1 -u root -p$$MYSQL_ROOT_PASSWORD",
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks:
      - d4c-net

  userservice:
    build:
      context: ./UserService
      dockerfile: Dockerfile
    container_name: userservice
    hostname: userservice
    env_file:
      - ./UserService/.env
    depends_on:
      mariadb:
        condition: service_healthy
      discovery-server:
        condition: service_healthy
    ports:
      - "8081:8081"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8081/v3/api-docs"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 45s
    networks:
      - d4c-net

  productservice:
    build:
      context: ./ProductService
      dockerfile: Dockerfile
    container_name: productservice
    hostname: productservice
    depends_on:
      discovery-server:
        condition: service_healthy
    env_file:
      - ./ProductService/.env
    ports:
      - "8082:8082"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8082/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 25s
    networks:
      - d4c-net

  api-gateway:
    build:
      context: ./Api-Gateway
      dockerfile: Dockerfile
    container_name: api-gateway
    hostname: api-gateway
    env_file:
      - ./Api-Gateway/.env
    depends_on:
      discovery-server:
        condition: service_healthy
      userservice:
        condition: service_healthy
      productservice:
        condition: service_healthy
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8080/actuator/health"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 40s
    networks:
      - d4c-net

  frontend_2:
    build:
      context: ./frontend_2
      dockerfile: Dockerfile
    env_file:
      - ./frontend_2/.env
    container_name: frontend_2
    depends_on:
      api-gateway:
        condition: service_healthy
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 20s
    networks:
      - d4c-net

volumes:
  mariadb_data:

networks:
  d4c-net:
    driver: bridge
```

- [ ] **Step 2: Update docker-compose.dev.yml**

Replace entire file:
```yaml
services:
  frontend_2:
    build:
      context: ./frontend_2
      dockerfile: Dockerfile
      target: runtime
    command: ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
    volumes:
      - ./frontend_2:/app
      - frontend_2_node_modules:/app/node_modules

  productservice:
    command: ["npm", "run", "dev"]
    volumes:
      - ./ProductService:/app
      - product_node_modules:/app/node_modules

  userservice:
    environment:
      JAVA_TOOL_OPTIONS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
    ports:
      - "5005:5005"

  api-gateway:
    environment:
      JAVA_TOOL_OPTIONS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5006"
    ports:
      - "5006:5006"

  discovery-server:
    environment:
      JAVA_TOOL_OPTIONS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5007"
    ports:
      - "5007:5007"

volumes:
  frontend_2_node_modules:
  product_node_modules:
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "docker: replace frontend service with frontend_2 in compose files"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full verification**

```bash
cd frontend_2
npm run build
npx tsc --noEmit
npm run lint
```

- [ ] **Step 2: Verify no test/demo imports remain**

```bash
cd frontend_2
rg "vitest|@testing-library|demo-store|demo-table|devtools-vite|devtools-event" src/ --type ts --type tsx
```

Expected: No matches.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "frontend_2: complete cleanup, shadcn migration, proxy config, and docker setup"
```

# SearchService Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 verified bugs across SearchService (RabbitMQ DLQ, category sync, filter injection, multi-select, NaN pagination, category rename reindex) and frontend (gender filter).

**Architecture:** Targeted fixes across existing files plus 2 new service modules (category initial sync, product reindex by category). No architectural changes.

**Tech Stack:** Node.js/Express (SearchService), React 19 + TypeScript (frontend), RabbitMQ, Typesense, Axios.

---

### Task 1: Fix Category DLQ Routing Key Mismatch

**Files:**
- Modify: `SearchService/src/config/rabbitmq.config.js:56`

- [ ] **Step 1: Add second DLQ binding for category routing key**

Edit `SearchService/src/config/rabbitmq.config.js`, add binding after line 56:

```js
  // Bind DLQ to DLX
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, DLQ_ROUTING_KEY);
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, CATEGORY_DLQ_ROUTING_KEY);
```

This ensures category messages dead-lettered with routing key `category.failed` are routed to the DLQ.

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/config/rabbitmq.config.js
git commit -m "fix: bind DLQ to category.failed routing key for category dead-lettering"
```

---

### Task 2: Create Category Initial Sync Service

**Files:**
- Create: `SearchService/src/services/category-initial-sync.service.js`

- [ ] **Step 1: Create category-initial-sync.service.js**

Create `SearchService/src/services/category-initial-sync.service.js`:

```js
import axios from "axios";
import { toCategoryTypesenseDoc } from "../utils/category-transformer.js";
import { upsertCategoryDoc } from "./sync.service.js";

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";

const apiClient = axios.create({
  timeout: 30000,
  baseURL: PRODUCT_SERVICE_URL,
});

export async function initialCategorySync() {
  console.log("Starting initial category sync from ProductService...");

  try {
    const response = await apiClient.get("/api/categories");
    const categories = Array.isArray(response.data) ? response.data : [];

    if (categories.length === 0) {
      console.log("No categories to sync");
      return 0;
    }

    let totalSynced = 0;
    for (const cat of categories) {
      const doc = toCategoryTypesenseDoc(cat);
      await upsertCategoryDoc(doc);
      totalSynced++;
    }

    console.log(`Initial category sync complete: ${totalSynced} categories indexed in Typesense`);
    return totalSynced;
  } catch (err) {
    console.error("Category initial sync failed:", err.message);
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/services/category-initial-sync.service.js
git commit -m "feat: add category initial sync service"
```

---

### Task 3: Wire Category Initial Sync into Bootstrap

**Files:**
- Modify: `SearchService/src/index.js:7,40`

- [ ] **Step 1: Import and call initialCategorySync in bootstrap**

Edit `SearchService/src/index.js`:

Change the import at line 8:
```js
import { initialSync } from "./services/initial-sync.service.js";
import { initialCategorySync } from "./services/category-initial-sync.service.js";
```

Add call after `ensureCategoryCollection()` in bootstrap (after line 40):
```js
    // Initial sync from ProductService
    await initialSync();
    await initialCategorySync();
```

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/index.js
git commit -m "feat: wire category initial sync into bootstrap"
```

---

### Task 4: Add Filter String Escaping and Comma-Separated Multi-Select Fix

**Files:**
- Modify: `SearchService/src/services/search.service.js:6-52`

- [ ] **Step 1: Add escapeFilterValue helper and fix buildFilterString**

Replace the entire `buildFilterString` function in `SearchService/src/services/search.service.js` (lines 6-52) with:

```js
function escapeFilterValue(val) {
  return String(val).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function flattenFilterValue(value) {
  const arr = Array.isArray(value) ? value : [value];
  return arr.flatMap((v) => v.split(",").map((x) => x.trim()).filter(Boolean));
}

export function buildFilterString(query) {
  const filters = [];

  if (query.filter_by) {
    filters.push(query.filter_by);
  }

  if (query.category) {
    const cats = flattenFilterValue(query.category);
    const catExpr = cats.map((c) => `category_norm:="${escapeFilterValue(normalizeVietnamese(c))}"`).join(" || ");
    filters.push(catExpr);
  }

  if (query.brand) {
    const brands = flattenFilterValue(query.brand);
    const brandExpr = brands.map((b) => `brand_norm:="${escapeFilterValue(normalizeVietnamese(b))}"`).join(" || ");
    filters.push(brandExpr);
  }

  if (query.priceMin !== undefined && query.priceMin !== "") {
    const minVal = Number(query.priceMin);
    if (!Number.isNaN(minVal)) {
      filters.push(`price:>=${minVal}`);
    }
  }

  if (query.priceMax !== undefined && query.priceMax !== "") {
    const maxVal = Number(query.priceMax);
    if (!Number.isNaN(maxVal)) {
      filters.push(`price:<=${maxVal}`);
    }
  }

  if (query.size) {
    const sizes = flattenFilterValue(query.size);
    const sizeExpr = sizes.map((s) => `sizes:="${escapeFilterValue(s)}"`).join(" || ");
    filters.push(sizeExpr);
  }

  if (query.color) {
    const colors = flattenFilterValue(query.color);
    const colorExpr = colors.map((c) => `colors:="${escapeFilterValue(c)}"`).join(" || ");
    filters.push(colorExpr);
  }

  return filters.length > 0 ? filters.join(" && ") : undefined;
}
```

This fixes both Bug 3 (escaping special characters) and Bug 4 (comma-separated multi-select) in one change.

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/services/search.service.js
git commit -m "fix: escape filter values and flatten comma-separated multi-select filters"
```

---

### Task 5: Add Gender Filter to SearchOptions and ProductsPage

**Files:**
- Modify: `frontend/src/services/searchApi.ts:29-41`
- Modify: `frontend/src/pages/ProductsPage.tsx:74-87`

- [ ] **Step 1: Add gender to SearchOptions interface**

Edit `frontend/src/services/searchApi.ts`, add `gender?: string` to the `SearchOptions` interface:

```ts
export interface SearchOptions {
  page?: number;
  limit?: number;
  filter_by?: string;
  sort_by?: string;
  // Individual filter params (backend buildFilterString() processes these)
  category?: string;
  brand?: string;
  size?: string;
  color?: string;
  gender?: string;
  priceMin?: number;
  priceMax?: number;
}
```

- [ ] **Step 2: Add gender to searchOptions in ProductsPage**

Edit `frontend/src/pages/ProductsPage.tsx`, update the `searchOptions` useMemo (lines 74-87):

```tsx
  const searchOptions: SearchOptions = useMemo(
    () => ({
      page,
      limit,
      category: categoryId
        ? categories.find((c) => c.id === categoryId)?.name
        : undefined,
      brand,
      size,
      color,
      gender,
      sort_by: sort,
    }),
    [page, limit, sort, categoryId, categories, brand, size, color, gender],
  );
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/searchApi.ts frontend/src/pages/ProductsPage.tsx
git commit -m "fix: add gender filter to search options for keyword search"
```

---

### Task 6: Fix NaN Pagination Input in Category Service

**Files:**
- Modify: `SearchService/src/services/category.service.js:5-31`

- [ ] **Step 1: Add NaN guards to pagination parameters**

Replace the `searchCategories` function in `SearchService/src/services/category.service.js` (lines 5-31) with:

```js
export async function searchCategories(options = {}) {
  const {
    q = "*",
    page = 1,
    limit = 20,
    sort_by = "createdAt:desc",
  } = options;

  const pageNum = Number(page);
  const limitNum = Number(limit);

  const allowedSortFields = ["name", "createdAt"];
  const rawSortBy = sort_by || "createdAt:desc";
  const validatedSortBy = rawSortBy
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const field = s.split(":")[0];
      return allowedSortFields.includes(field);
    })
    .join(",") || "createdAt:desc";

  const searchParams = {
    collection: COLLECTION_NAME,
    q: q,
    query_by: "name,description",
    page: Math.max(1, Number.isNaN(pageNum) ? 1 : pageNum),
    per_page: Math.min(100, Math.max(1, Number.isNaN(limitNum) ? 20 : limitNum)),
    sort_by: validatedSortBy,
  };

  const startTime = Date.now();
  const result = await typesenseClient.multiSearch.perform({
    searches: [searchParams],
  });
  const searchTimeMs = Date.now() - startTime;

  const searchResult = result.results[0];
  const hits = searchResult.hits || [];
  const total = searchResult.found || 0;
  const perPage = searchResult.request_params?.per_page || searchParams.per_page;
  const totalPages = Math.ceil(total / perPage) || 1;

  const data = hits.map((hit) => ({
    ...hit.document,
    _text_match: hit.text_match,
  }));

  return {
    data,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages,
    keyword: q === "*" ? "" : q,
    searchTimeMs,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/services/category.service.js
git commit -m "fix: add NaN guards for pagination input in category search"
```

---

### Task 7: Create Product Reindex Service for Category Rename

**Files:**
- Create: `SearchService/src/services/product-reindex.service.js`

- [ ] **Step 1: Create product-reindex.service.js**

Create `SearchService/src/services/product-reindex.service.js`:

```js
import axios from "axios";
import { toTypesenseDocs } from "../utils/product-transformer.js";
import { upsertDocs } from "./sync.service.js";

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:8082";

const apiClient = axios.create({
  timeout: 30000,
  baseURL: PRODUCT_SERVICE_URL,
});

export async function reindexProductsByCategory(categoryId) {
  console.log(`Starting reindex for category ${categoryId}...`);

  let page = 1;
  const limit = 250;
  let totalSynced = 0;
  let totalPages = Infinity;

  try {
    while (page <= totalPages) {
      const response = await apiClient.get(`/api/products`, {
        params: { categoryId, page, limit },
      });
      const envelope = response.data;
      const products = Array.isArray(envelope.data) ? envelope.data : [];

      totalPages = envelope.totalPages || 1;

      if (products.length === 0) {
        break;
      }

      const docs = toTypesenseDocs(products);
      const results = await upsertDocs(docs);
      const successCount = results.filter((r) => r.success).length;
      totalSynced += successCount;

      console.log(`Reindexed ${successCount}/${products.length} products for category ${categoryId} (total: ${totalSynced})`);
      page++;
    }

    console.log(`Category reindex complete: ${totalSynced} products updated`);
    return totalSynced;
  } catch (err) {
    console.error(`Failed to reindex products for category ${categoryId}:`, err.message);
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/services/product-reindex.service.js
git commit -m "feat: add product reindex service for category rename"
```

---

### Task 8: Wire Category Rename Reindex into Event Processor

**Files:**
- Modify: `SearchService/src/utils/event-processor.js:1-31`

- [ ] **Step 1: Update event-processor to reindex products on CATEGORY_UPDATED**

Replace the entire `SearchService/src/utils/event-processor.js` with:

```js
import { toTypesenseDoc } from "./product-transformer.js";
import { toCategoryTypesenseDoc } from "./category-transformer.js";
import { upsertDoc, deleteDoc, upsertCategoryDoc, deleteCategoryDoc } from "../services/sync.service.js";
import { reindexProductsByCategory } from "../services/product-reindex.service.js";

export async function processEvent(eventType, data) {
  switch (eventType) {
    case "CREATE":
    case "UPDATE":
      const doc = toTypesenseDoc(data);
      await upsertDoc(doc);
      console.log(`Product ${data.id} synced to Typesense (${eventType})`);
      break;
    case "DELETE":
      await deleteDoc(data.id);
      console.log(`Product ${data.id} removed from Typesense`);
      break;
    case "CATEGORY_CREATED":
    case "CATEGORY_UPDATED":
      const catDoc = toCategoryTypesenseDoc(data);
      await upsertCategoryDoc(catDoc);
      console.log(`Category ${data.id} synced to Typesense (${eventType})`);

      // Reindex products when category is updated to refresh denormalized category name
      if (eventType === "CATEGORY_UPDATED" && data.id) {
        try {
          await reindexProductsByCategory(data.id);
        } catch (err) {
          console.error(`Failed to reindex products for category ${data.id}:`, err.message);
        }
      }
      break;
    case "CATEGORY_DELETED":
      await deleteCategoryDoc(data.id);
      console.log(`Category ${data.id} removed from Typesense`);
      break;
    default:
      console.warn(`Unknown event type: ${eventType}`);
      break;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add SearchService/src/utils/event-processor.js
git commit -m "fix: reindex products when category name is updated"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec Item | Task |
|-----------|------|
| Bug 1: DLQ routing key | Task 1 |
| Bug 2: Category initial sync | Tasks 2, 3 |
| Bug 3: Filter injection | Task 4 |
| Bug 4: Comma-separated multi-select | Task 4 |
| Bug 5: Gender filter | Task 5 |
| Bug 6: NaN pagination | Task 6 |
| Bug 7: Category rename reindex | Tasks 7, 8 |

All 7 bugs covered.

**2. Placeholder scan:** No TBD/TODO. All steps contain complete code.

**3. Type consistency:** 
- `SearchOptions.gender` is `string | undefined` — matches backend `query.gender` handling in `buildFilterString()`
- `reindexProductsByCategory` uses same pagination pattern as `initialSync()` — consistent with existing code
- `toTypesenseDocs` and `toCategoryTypesenseDoc` are existing imports — no new dependencies

**4. Dependency order:** Tasks are ordered correctly. Task 4 combines bugs 3+4 since they modify the same function. Task 8 depends on Task 7 (new service). All other tasks are independent.

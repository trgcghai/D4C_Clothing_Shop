# SearchService Bug Fixes Design

**Date:** 2026-05-19
**Scope:** 7 verified bugs across SearchService and frontend

---

## Bug 1: Category DLQ Routing Key Mismatch

**File:** `SearchService/src/config/rabbitmq.config.js`

**Problem:** DLX exchange `product.search.dlx` is `direct`. DLQ is bound to routing key `"dlq"`. Category queue dead-letters with routing key `CATEGORY_DLQ_ROUTING_KEY` (`"category.failed"`). Direct exchange requires exact match, so category DLQ messages are unroutable and lost.

**Fix:** Add second binding:
```js
await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, CATEGORY_DLQ_ROUTING_KEY);
```
Place after existing `bindQueue(DLQ_QUEUE, DLX_EXCHANGE, DLQ_ROUTING_KEY)` at line 56.

**Impact:** Category failure messages now appear in DLQ and are processed by DLQ handler.

---

## Bug 2: Category Collection Wiped on Restart

**Files:** `SearchService/src/services/category-initial-sync.service.js` (new), `SearchService/src/index.js`

**Problem:** `ensureCategoryCollection()` deletes and recreates `d4c_categories` on every startup. No initial sync for categories exists, so restart leaves categories empty.

**Fix:**

1. Create `SearchService/src/services/category-initial-sync.service.js`:
   - Axios client to ProductService (`PRODUCT_SERVICE_URL`)
   - Paginated fetch via `GET /api/categories?page=&limit=`
   - Transform with `toCategoryTypesenseDoc()` from `category-transformer.js`
   - Batch upsert via `upsertCategoryDoc()` from `sync.service.js`
   - Log sync progress and total

2. Update `SearchService/src/index.js`:
   - Import `initialCategorySync`
   - Call after `ensureCategoryCollection()` in bootstrap

**Impact:** Categories repopulated on restart before consumers start.

---

## Bug 3: Filter String Injection

**File:** `SearchService/src/services/search.service.js`

**Problem:** Raw query values interpolated into Typesense filter syntax without escaping. Values containing `"`, `\`, or `:` produce malformed `filter_by` expressions.

**Fix:** Add helper and apply to all interpolated values:
```js
function escapeFilterValue(val) {
  return String(val).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
```
Apply in `buildFilterString()` to: `category`, `brand`, `size`, `color` values before interpolation into `field:="value"` expressions.

**Impact:** Special characters in filter values no longer break search queries.

---

## Bug 4: Comma-Separated Multi-Select

**File:** `SearchService/src/services/search.service.js`

**Problem:** Frontend sends `size=XL,L` as comma-joined string. Backend wraps in array `["XL,L"]` and produces `sizes:="XL,L"` which matches nothing.

**Fix:** In `buildFilterString()`, flatten comma-delimited strings before building OR expressions:
```js
const sizes = Array.isArray(query.size) ? query.size : [query.size];
const flattenedSizes = sizes.flatMap(s => s.split(",").map(x => x.trim()).filter(Boolean));
const sizeExpr = flattenedSizes.map(s => `sizes:="${escapeFilterValue(s)}"`).join(" || ");
```
Same pattern for `color`.

**Impact:** Multi-size and multi-color filters now correctly match any selected value.

---

## Bug 5: Gender Filter Omitted from Search

**Files:** `frontend/src/services/searchApi.ts`, `frontend/src/pages/ProductsPage.tsx`

**Problem:** `searchOptions` includes `category`, `brand`, `size`, `color` but not `gender`. Gender filter has no effect during keyword search.

**Fix:**

1. `frontend/src/services/searchApi.ts`: Add `gender?: string` to `SearchOptions` interface.
2. `frontend/src/pages/ProductsPage.tsx`: Add `gender` to `searchOptions` object and dependency array.

**Impact:** Gender filter now applies during keyword search.

---

## Bug 6: NaN Pagination Input

**File:** `SearchService/src/services/category.service.js`

**Problem:** `Math.max(1, Number("abc"))` returns `NaN`. Invalid Typesense parameters cause category search to fail.

**Fix:** Add NaN guards:
```js
const pageNum = Number(page);
const limitNum = Number(limit);
page: Math.max(1, Number.isNaN(pageNum) ? 1 : pageNum),
per_page: Math.min(100, Math.max(1, Number.isNaN(limitNum) ? 20 : limitNum)),
```

**Impact:** Non-numeric pagination input falls back to defaults instead of crashing.

---

## Bug 7: Category Rename Stale Products

**Files:** `SearchService/src/utils/event-processor.js`, `SearchService/src/services/product-reindex.service.js` (new)

**Problem:** Product documents denormalize `category`/`category_norm`. When category name changes, products retain old name until individually reindexed.

**Fix:**

1. Create `SearchService/src/services/product-reindex.service.js`:
   - Axios client to ProductService
   - `reindexProductsByCategory(categoryId)`: fetch all products for category, transform, batch upsert to Typesense

2. Update `SearchService/src/utils/event-processor.js`:
   - On `CATEGORY_UPDATED`, call `reindexProductsByCategory(data.id)` after updating category document

**Impact:** Products in renamed category are immediately reindexed with new category name.

---

## Dependencies

- Bug 4 depends on Bug 3 (both modify `buildFilterString()`)
- Bug 7 requires ProductService API to expose `GET /api/products?categoryId=`
- No other interdependencies

## Testing Approach

- Manual testing via API endpoints and frontend UI
- Verify DLQ receives category failure messages
- Verify categories persist after restart
- Verify special characters in filters don't break search
- Verify multi-select size/color returns correct results
- Verify gender filter works during keyword search
- Verify non-numeric pagination falls back gracefully
- Verify category rename updates product documents

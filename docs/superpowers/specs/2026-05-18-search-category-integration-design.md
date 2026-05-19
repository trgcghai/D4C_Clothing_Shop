# SearchService Category Integration & Dynamic Filter Builder Design

**Date:** 2026-05-18  
**Status:** Draft — Pending Review  
**Author:** opencode

## 1. Overview

This spec covers two independent but complementary enhancements to SearchService:

1. **Category Index & Search** — A new `d4c_categories` Typesense collection synced from ProductService via RabbitMQ, with a dedicated `GET /api/search/categories` endpoint to offload category search traffic from DynamoDB.
2. **Dynamic Filter Builder** — Extends the existing `GET /api/search` endpoint to parse `size`, `color`, `category`, `brand`, `price` query params from frontend URLs and translate them into Typesense `filter_by` expressions, fixing the current bug where these params are silently ignored.

**Non-goals:**
- ProductService remains the master source of truth for categories (no Option C)
- No changes to DynamoDB schema or GSI creation
- No changes to API Gateway routing (existing `/api/search/**` route covers all new endpoints)

## 2. Typesense Schema: `d4c_categories`

```javascript
{
  name: "d4c_categories",
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string", locale: "vi", facet: true },
    { name: "description", type: "string", locale: "vi", optional: true },
    { name: "imageUrl", type: "string", index: false },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "createdAt",
}
```

**Design notes:**
- Uses `locale: "vi"` for native Vietnamese diacritic handling, consistent with `d4c_products`
- No `*_norm` duplicate fields — saves memory and maintains schema consistency
- `name` is facetable for both search and filtering
- `imageUrl` is stored but not indexed (frontend needs it, search doesn't)

## 3. RabbitMQ Configuration

### 3.1 Exchange & Routing Keys

**Exchange:** Reuse existing `product.exchange` (topic type)

**New routing keys:**

| Event | Routing Key |
|-------|-------------|
| Category created | `category.created` |
| Category updated | `category.updated` |
| Category deleted | `category.deleted` |

### 3.2 Queue Configuration

```javascript
{
  queue: "search.category.queue",
  options: {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-message-ttl": 300000, // 5 minutes
    },
  },
  bindings: [
    { exchange: "product.exchange", routingKey: "category.created" },
    { exchange: "product.exchange", routingKey: "category.updated" },
    { exchange: "product.exchange", routingKey: "category.deleted" },
  ],
}
```

### 3.3 DLX/DLQ Reuse

- **DLX:** Reuse existing `product.search.dlx`
- **DLQ:** Reuse existing `product.search.dlq`
- **DLQ routing key:** `category.failed` (new, for filtering DLQ messages by type)
- **Retry logic:** Existing `dlq-handler.service.js` handles both product and category events by inspecting message headers/`eventType` field

**Queue configuration with DLX:**
```javascript
arguments: {
  "x-queue-type": "quorum",
  "x-message-ttl": 300000,
  "x-dead-letter-exchange": "product.search.dlx",
  "x-dead-letter-routing-key": "category.failed",
}
```

### 3.4 Event Payload Envelope

All category events follow the standard envelope:

```json
{
  "eventId": "uuid-v4",
  "eventType": "CATEGORY_CREATED",
  "timestamp": 1715000000000,
  "data": {
    "id": "cat_123",
    "name": "Áo thun",
    "description": "Mô tả danh mục",
    "imageUrl": "https://s3.../categories/cat_123.jpg",
    "createdAt": 1715000000000,
    "updatedAt": 1715000000000
  }
}
```

**Event types:** `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_DELETED`

## 4. Category Search Endpoint

### 4.1 Route Definition

`GET /api/search/categories`

### 4.2 Query Parameters

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `q` | No | — | Search keyword (matches `name`, `description`) |
| `page` | No | 1 | Page number |
| `limit` | No | 20 | Results per page (max 100) |
| `sort_by` | No | `createdAt:desc` | Sort field and direction |

### 4.3 Response Format

```json
{
  "data": [
    {
      "id": "cat_123",
      "name": "Áo thun",
      "description": "Mô tả danh mục",
      "imageUrl": "https://s3.../categories/cat_123.jpg",
      "createdAt": 1715000000000,
      "updatedAt": 1715000000000
    }
  ],
  "total": 4,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "keyword": "áo",
  "searchTimeMs": 12
}
```

### 4.4 Implementation Files

| File | Purpose |
|------|---------|
| `src/controllers/category.controller.js` | Request handler — extracts params, calls service |
| `src/services/category.service.js` | Typesense query builder for categories |
| `src/routes/category.routes.js` | Route definitions |
| `src/config/typesense.config.js` | Add `ensureCategoryCollection()` to bootstrap |
| `src/index.js` | Call `ensureCategoryCollection()` during startup |

### 4.5 Search Logic

```javascript
// category.service.js
async function searchCategories({ q, page = 1, limit = 20, sort_by = "createdAt:desc" }) {
  const searchParams = {
    collection: "d4c_categories",
    q: q || "*",
    query_by: "name,description",
    page: Number(page),
    per_page: Math.min(Number(limit), 100),
    sort_by: sort_by,
    exclude_fields: "",
  };

  const results = await typesenseClient.multiSearch.perform({ searches: [searchParams] }, {});
  // ... transform and return
}
```

## 5. Dynamic Filter Builder

### 5.1 Problem

Frontend URLs like `/products?search=áo&size=XL&category=Áo thun&brand=Nike&priceMin=100000&priceMax=500000&color=Đỏ` pass filter params that SearchService currently ignores. Only `q` is extracted.

### 5.2 Solution

Add `buildFilterString()` in `search.service.js` to parse query params and construct Typesense `filter_by` expressions.

### 5.3 Implementation

```javascript
// src/services/search.service.js

function buildFilterString(query) {
  const filters = [];

  // Preserve existing explicit filter_by if passed
  if (query.filter_by) {
    filters.push(query.filter_by);
  }

  // Category — exact match, quoted, supports multiple values (OR)
  if (query.category) {
    const cats = Array.isArray(query.category) ? query.category : [query.category];
    const catExpr = cats.map((c) => `category:="${c}"`).join(" || ");
    filters.push(catExpr);
  }

  // Brand — exact match, quoted, supports multiple values (OR)
  if (query.brand) {
    const brands = Array.isArray(query.brand) ? query.brand : [query.brand];
    const brandExpr = brands.map((b) => `brand:="${b}"`).join(" || ");
    filters.push(brandExpr);
  }

  // Price range — numeric comparison
  if (query.priceMin !== undefined) {
    filters.push(`price:>=${Number(query.priceMin)}`);
  }
  if (query.priceMax !== undefined) {
    filters.push(`price:<=${Number(query.priceMax)}`);
  }

  // Size — array field, any-match (OR within, AND across filters)
  if (query.size) {
    const sizes = Array.isArray(query.size) ? query.size : [query.size];
    const sizeExpr = sizes.map((s) => `sizes:="${s}"`).join(" || ");
    filters.push(sizeExpr);
  }

  // Color — array field, any-match (OR within, AND across filters)
  if (query.color) {
    const colors = Array.isArray(query.color) ? query.color : [query.color];
    const colorExpr = colors.map((c) => `colors:="${c}"`).join(" || ");
    filters.push(colorExpr);
  }

  return filters.length > 0 ? filters.join(" && ") : undefined;
}
```

### 5.4 Controller Update

```javascript
// src/controllers/search.controller.js — extract all filter params
const {
  q,
  page,
  limit,
  filter_by,
  sort_by,
  category,
  brand,
  priceMin,
  priceMax,
  size,
  color,
} = req.query;

const dynamicFilter = buildFilterString({
  filter_by,
  category,
  brand,
  priceMin,
  priceMax,
  size,
  color,
});

const result = await searchService.searchProducts({
  keyword: q,
  page: Number(page) || 1,
  limit: Math.min(Number(limit) || 12, 250),
  filter_by: dynamicFilter,
  sort_by: sort_by || "_text_match:desc",
});
```

### 5.5 Example Filter Output

| Frontend URL Params | Generated `filter_by` |
|---------------------|----------------------|
| `size=XL` | `sizes:="XL"` |
| `size=XL&size=L` | `sizes:="XL" \|\| sizes:="L"` |
| `category=Áo thun&brand=Nike` | `category:="Áo thun" && brand:="Nike"` |
| `priceMin=100000&priceMax=500000&size=XL&color=Đỏ` | `price:>=100000 && price:<=500000 && sizes:="XL" && colors:="Đỏ"` |
| `filter_by=brand:="Adidas"&size=M` | `brand:="Adidas" && sizes:="M"` |

## 6. Product Schema Update: Flatten Variants

### 6.1 Problem

The current `d4c_products` schema has `variants` as `object[]` with `index: false`. Typesense cannot filter on nested object arrays.

### 6.2 Solution

Add `sizes` and `colors` as `string[]` facet fields to `d4c_products` schema, populated during product transformation.

### 6.3 Schema Addition

```javascript
// In typesense.config.js — add to d4c_products fields:
{ name: "sizes", type: "string[]", facet: true },
{ name: "colors", type: "string[]", facet: true },
```

### 6.4 Transformer Update

```javascript
// src/utils/product-transformer.js — add to transformProduct():
sizes: (product.variants || []).map((v) => v.size).filter(Boolean),
colors: (product.variants || []).map((v) => v.color).filter(Boolean),
```

**Note:** Requires re-sync after schema update. Use `POST /api/search/admin/sync` to trigger full re-sync.

## 7. ProductService Changes

### 7.1 Category Event Publisher

Add category event publishing to `category.controller.js`:

```javascript
// After successful category CRUD operations:
await eventPublisher.publish("category.created", categoryData);
await eventPublisher.publish("category.updated", categoryData);
await eventPublisher.publish("category.deleted", { id: categoryId });
```

The `event-publisher.service.js` must wrap payloads in the standard envelope:

```javascript
async publish(routingKey, data) {
  const envelope = {
    eventId: crypto.randomUUID(),
    eventType: routingKey.replace(".", "_").toUpperCase(),
    timestamp: Date.now(),
    data,
  };
  // ... publish to product.exchange with routingKey
}
```

### 7.2 No DynamoDB Changes

ProductService continues to use DynamoDB as the master store. No schema changes, no GSI creation needed.

## 8. Data Flow Diagrams

### 8.1 Category Sync Flow

```
ProductService (CRUD)
  └── publish("category.created/updated/deleted", data)
        └── RabbitMQ: product.exchange [category.*]
              └── search.category.queue
                    └── event-processor.js
                          └── category-transformer.js
                                └── Typesense: d4c_categories (upsert/delete)
```

### 8.2 Product Search with Filters Flow

```
Frontend: GET /api/search?q=áo&size=XL&category=Áo thun&priceMin=100000
  └── API Gateway → SEARCHSERVICE
        └── search.controller.js (extract all params)
              └── buildFilterString() → "category:=\"Áo thun\" && price:>=100000 && sizes:=\"XL\""
                    └── search.service.js (Typesense multiSearch with filter_by)
                          └── Typesense: d4c_products
                                └── Response → Frontend
```

## 9. Error Handling

### 9.1 Category Sync Errors

- Failed category events → DLQ via existing `product.search.dlx` with routing key `category.failed`
- DLQ retry endpoint (`POST /api/search/admin/dlq/retry`) handles both product and category events
- Max 5 retry attempts before permanent failure (existing logic)

### 9.2 Filter Builder Errors

- Invalid numeric values for `priceMin`/`priceMax` → `Number()` returns `NaN`, filter is skipped (safe default)
- Empty string values → filtered out by truthy checks
- Unknown params → silently ignored (forward-compatible)

## 10. Testing Strategy

### 10.1 Unit Tests

- `buildFilterString()` — test all param combinations (single, multiple, mixed, empty)
- `category-transformer.js` — test envelope unwrapping and field mapping
- `category.service.js` — test Typesense query construction

### 10.2 Integration Tests

- Category event end-to-end: publish → consume → Typesense upsert → search
- Filter builder end-to-end: URL params → filter_by → Typesense results
- DLQ flow: force category event failure → verify DLQ → retry → success

### 10.3 Manual Verification

```bash
# Category search
curl "http://localhost:8080/api/search/categories?q=áo"

# Product search with filters
curl "http://localhost:8080/api/search?q=áo&size=XL&category=Áo thun&brand=Nike&priceMin=100000&priceMax=500000&color=Đỏ"

# Category CRUD triggers event (via ProductService)
curl -X POST http://localhost:8080/api/categories -F "name=Test" -F "description=Test desc"
# Verify appears in SearchService within seconds
curl "http://localhost:8080/api/search/categories?q=test"
```

## 11. Migration Steps

1. **Add `sizes` and `colors` fields** to `d4c_products` schema in `typesense.config.js`
2. **Update `product-transformer.js`** to flatten variants into `sizes`/`colors` arrays
3. **Add `ensureCategoryCollection()`** to bootstrap sequence in `index.js`
4. **Add category RabbitMQ bindings** in `rabbitmq.config.js`
5. **Update `event-processor.js`** to route `CATEGORY_*` events to category handler
6. **Create `category-transformer.js`** for envelope unwrapping and field mapping
7. **Create `category.service.js`** and `category.controller.js`
8. **Create `category.routes.js`** and register in `index.js`
9. **Update `search.controller.js`** to extract all filter params
10. **Add `buildFilterString()`** to `search.service.js`
11. **Update ProductService** `category.controller.js` to publish events
12. **Trigger full re-sync** via `POST /api/search/admin/sync`

## 12. Rollback Plan

- If category sync breaks: delete `search.category.queue`, stop category event publishing, revert `category.controller.js`
- If filter builder breaks: revert `search.controller.js` to extract only `q`, `page`, `limit`, `filter_by`, `sort_by`
- If schema update breaks: drop `d4c_products` collection, revert schema, re-run initial sync

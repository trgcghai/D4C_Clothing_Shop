# Product Caching Design

**Date:** 2026-06-03
**Status:** Draft

## Overview

Add Redis-based caching to ProductService for frequently-accessed product data, and add a cache layer for per-user recommendations computed by RecommendationService.

## Decisions Made

| Decision | Choice |
|---|---|
| Scope | ProductService: featured, new-arrivals, product list, product detail, related products, recommendations |
| Invalidation | Selective (delete only affected keys on CRUD) |
| Recommendation cache location | ProductService (centralized caching) |
| TTL values | Featured 10m, New-arrivals 5m, Detail 15m, Related 10m, List 10m, Recommendations 30m |
| Pattern | Cache-aside (check cache → miss → fetch → cache → return) |
| Redis down | Log warning, fall through to DynamoDB (no request fails) |
| Recommendation invalidation | TTL-only, no manual deletion |

## Architecture

### Cache Key Design

All keys follow `product:{type}:{identifier}` pattern:

| Endpoint | Cache Key | TTL | Data |
|---|---|---|---|
| `GET /api/products/featured` | `product:featured` | 600s | JSON array |
| `GET /api/products/new-arrivals?limit=N` | `product:new-arrivals:{limit}` | 300s | JSON array |
| `GET /api/products` (with filters) | `product:list:{sha256(sorted_filters)}` | 600s | JSON `{ data, total, page, limit, totalPages }` |
| `GET /api/products/:id` | `product:detail:{productId}` | 900s | JSON product object |
| `GET /api/products/:id/related` | `product:related:{productId}` | 600s | JSON array |
| `GET /api/products/recommendations/:userId` | `product:recommendations:{userId}` | 1800s | JSON array |

Filter hash: SHA-256 of sorted query params string (e.g., `brand=nike&category=shoes&gender=male&limit=12&page=1`).

### Cache Service (`src/services/cache.service.js`)

New centralized service:

```
get(key)           → parse JSON from Redis, return null on miss/error
set(key, data, ttl) → JSON stringify, SET with EX ttl
delete(key)        → DEL key
deletePattern(pattern) → SCAN + DEL for wildcard patterns
```

Key builder functions: `featured()`, `newArrivals(limit)`, `detail(productId)`, `related(productId)`, `list(filters)`, `recommendations(userId)`.

TTL constants exported: `FEATURED_TTL`, `NEW_ARRIVALS_TTL`, `DETAIL_TTL`, `RELATED_TTL`, `LIST_TTL`, `RECOMMENDATIONS_TTL`.

### Cache-Aside Pattern

Each service method:
1. Check cache via `cache.get(key)`
2. If hit, return cached data
3. If miss, fetch from DynamoDB
4. Cache result with `cache.set(key, data, TTL)`
5. Return data

### Cache Invalidation

| Trigger | Keys Deleted |
|---|---|
| Create product (featured) | `product:featured`, `product:new-arrivals:*`, `product:list:*` |
| Create product (not featured) | `product:new-arrivals:*`, `product:list:*` |
| Update product (changed isFeatured) | `product:featured`, `product:detail:{id}`, `product:related:*`, `product:list:*`, `product:new-arrivals:*` |
| Update product (other fields) | `product:detail:{id}`, `product:related:*`, `product:list:*`, `product:new-arrivals:*` |
| Delete product | `product:detail:{id}`, `product:related:*`, `product:featured` (if was featured), `product:list:*`, `product:new-arrivals:*` |
| Create/Update/Delete category | `product:list:*`, `product:detail:*`, `product:related:*`, `product:featured`, `product:new-arrivals:*` |

Pattern deletion uses Redis `SCAN` (not `KEYS`) to avoid blocking.

### Recommendation Cache Flow

ProductService does NOT compute recommendations. It only stores and retrieves.

**New endpoints in ProductService:**
- `GET /api/products/recommendations/:userId` - Returns cached recommendations or 404 (cache miss). Internal only (protected by GatewayIdentityFilter checking X-User-Id header from RecommendationService).
- `POST /api/products/cache/recommendations` - Accepts `{ userId, data: [...] }`, stores under `product:recommendations:{userId}` with 1800s TTL. Internal only (protected by GatewayIdentityFilter).

**RecommendationService flow:**
1. `GET /api/products/recommendations/:userId` → ProductService
2. If cache hit → return cached data to client
3. If cache miss → compute recommendations (existing logic)
4. `POST /api/products/cache/recommendations` → send result to ProductService for caching
5. Return to client

Recommendation cache is TTL-only. No manual invalidation when user behavior changes.

### Error Handling

- Redis unavailable: log warning, treat as cache miss, fetch from DynamoDB
- JSON parse/stringify error: log error, treat as cache miss, do not cache
- No request should fail due to Redis unavailability

### Files Changed

**New files:**
- `ProductService/src/services/cache.service.js` - Centralized cache service

**Modified files:**
- `ProductService/src/services/product.service.js` - Add cache read/write to getFeatured, getNewArrivals, getProductsWithFilters, getProductById, getRelatedProducts
- `ProductService/src/controllers/product.controller.js` - Add recommendation cache endpoints
- `ProductService/src/routes/product.routes.js` - Add recommendation cache routes (internal)
- `ProductService/src/services/stock.service.js` - No changes (already uses Redis)

### Files NOT Changed

- `ProductService/src/config/redis.config.js` - Existing connection reused
- `RecommendationService/` - Only changes are to call ProductService cache endpoints instead of computing directly (minimal change to existing flow)

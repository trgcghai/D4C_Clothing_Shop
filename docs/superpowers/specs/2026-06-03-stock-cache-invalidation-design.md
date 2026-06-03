# Design Spec: Cache Invalidation on Stock Operations

**Date:** 2026-06-03
**Status:** Draft — awaiting user review

## Problem

After purchasing a product, stock quantities in ProductService Redis cache become stale. Product detail cache (TTL 15 min) and product list cache (TTL 10 min) are not invalidated when stock is deducted or restored. Users see incorrect stock availability for up to 15 minutes after a purchase.

## Solution

Pass `productId` from OrderService through the stock operation request, enabling ProductService to invalidate the correct cache entries immediately after successful stock changes.

## Architecture

### Components Affected

| Service | File | Change |
|---|---|---|
| OrderService | `BatchStockRequest.java` | Add `productId` field |
| OrderService | `OrderService.java` | Populate `productId` when building requests |
| ProductService | `stock.service.js` | Invalidate cache after successful deduct/restore |

### Data Flow

```
OrderService.createOrderFromCheckout()
  → Build BatchStockRequest[] { variantId, quantity, productId }
    → POST /api/products/stock/deduct-batch
      → ProductService.deductStock()
        → Deduct stock in DynamoDB
        → Extract unique productIds from successfully processed items
        → cacheDel(keys.detail(productId)) × N
        → cacheDelPattern("product:list:*") × 1
        → Return response
```

Same flow for `restore-stock` (order cancel, payment expired, payment cancelled).

## Detailed Changes

### 1. OrderService — BatchStockRequest.java

**File:** `OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockRequest.java`

Change from:
```java
public record BatchStockRequest(String variantId, int quantity) {}
```

Change to:
```java
public record BatchStockRequest(String variantId, int quantity, String productId) {}
```

### 2. OrderService — OrderService.java

**File:** `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

Two methods build `BatchStockRequest` lists:

**`deductStockForOrder()` (line ~242):** Currently builds from `List<CheckoutItemDto>`. Each `CheckoutItemDto` has `productId`. Add it to the request:
```java
items.stream()
    .map(item -> new BatchStockRequest(item.getVariantId(), item.getQuantity(), item.getProductId()))
    .toList()
```

**`restoreStockForOrder(Order)` (line ~216):** Builds from `OrderItem` entities. `OrderItem` has `productId` field. Add it:
```java
order.getItems().stream()
    .map(item -> new BatchStockRequest(item.getVariantId(), item.getQuantity(), item.getProductId()))
    .toList()
```

### 3. ProductService — stock.service.js

**File:** `ProductService/src/services/stock.service.js`

Add imports:
```javascript
import { cacheDel, cacheDelPattern, keys } from './cache.service.js';
```

**After successful deduct (line ~55):**
```javascript
// Invalidate cache for affected products
const productIds = [...new Set(items.map(item => item.productId).filter(Boolean))];
for (const productId of productIds) {
  await cacheDel(keys.detail(productId));
}
await cacheDelPattern('product:list:*');
```

**After successful restore (line ~100):** Same pattern.

**Backward compatibility:** If `productId` is missing/null, `filter(Boolean)` skips it. Stock operation still succeeds, just no cache invalidation for that item.

## Error Handling

- Cache invalidation failures are caught and logged silently (existing `cacheDel`/`cacheDelPattern` behavior)
- Stock operation succeeds regardless of cache invalidation outcome
- Partial stock deduct (some variants fail): only invalidate cache for successfully processed items' products

## Testing

- Unit test: stock deduct invalidates correct cache keys
- Unit test: stock restore invalidates correct cache keys
- Unit test: missing productId does not break stock operation
- Integration test: after purchase, product detail cache reflects new stock

## Risks

- **Increased cache miss rate:** Invalidating list cache on every purchase means more DynamoDB reads. Mitigation: list cache TTL is already 10 min, so this only adds invalidation for the specific purchased product's detail cache. List invalidation is acceptable since stock changes are a strong signal that cached list data is stale.
- **OrderService DTO change:** All callers of `BatchStockRequest` must include `productId`. Since there are only 2 call sites (deduct and restore), both are updated in this change.

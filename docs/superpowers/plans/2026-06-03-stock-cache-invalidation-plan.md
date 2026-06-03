# Stock Cache Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invalidate ProductService Redis cache (detail + list) after stock deduct/restore operations triggered by purchases.

**Architecture:** Pass `productId` from OrderService through `BatchStockRequest` to ProductService. After successful DynamoDB stock operations, ProductService extracts unique `productId`s and invalidates `product:detail:{id}` and `product:list:*` cache entries.

**Tech Stack:** Java 21 (Spring Boot 3), Node.js/Express, Redis, DynamoDB, Vitest (JS tests), JUnit 5 (Java tests)

---

### Task 1: Add productId to BatchStockRequest DTO

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockRequest.java`

- [ ] **Step 1: Add productId field to the record**

Current file content (3 lines):
```java
package com.iuh.fit.client.dto;

public record BatchStockRequest(String variantId, int quantity) {}
```

Change to:
```java
package com.iuh.fit.client.dto;

public record BatchStockRequest(String variantId, int quantity, String productId) {}
```

- [ ] **Step 2: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockRequest.java
git commit -m "feat: add productId to BatchStockRequest for cache invalidation"
```

---

### Task 2: Update OrderService to populate productId in deduct/restore requests

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

Three methods need updating. Each builds `BatchStockRequest` lists.

- [ ] **Step 1: Update `deductStockForOrder()` (lines 242-253)**

Current code at lines 242-253:
```java
    private void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items, String checkoutOrderId) {
        List<BatchStockRequest> batchItems = items.stream()
                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
                .collect(Collectors.toList());

        if (batchItems.isEmpty()) {
            return;
        }

        batchDeductStock(batchItems, checkoutOrderId);
    }
```

Change to:
```java
    private void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items, String checkoutOrderId) {
        List<BatchStockRequest> batchItems = items.stream()
                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity(), itemDto.getProductId()))
                .collect(Collectors.toList());

        if (batchItems.isEmpty()) {
            return;
        }

        batchDeductStock(batchItems, checkoutOrderId);
    }
```

- [ ] **Step 2: Update `restoreStockForOrder(Order)` (lines 216-227)**

Current code at lines 216-227:
```java
    private void restoreStockForOrder(Order order) {
        List<BatchStockRequest> items = order.getItems().stream()
                .filter(item -> item.getVariantId() != null && !item.getVariantId().isBlank())
                .map(item -> new BatchStockRequest(item.getVariantId(), item.getQuantity()))
                .collect(Collectors.toList());

        if (items.isEmpty()) {
            return;
        }

        batchRestoreStock(items);
    }
```

Change to:
```java
    private void restoreStockForOrder(Order order) {
        List<BatchStockRequest> items = order.getItems().stream()
                .filter(item -> item.getVariantId() != null && !item.getVariantId().isBlank())
                .map(item -> new BatchStockRequest(item.getVariantId(), item.getQuantity(), item.getProductId()))
                .collect(Collectors.toList());

        if (items.isEmpty()) {
            return;
        }

        batchRestoreStock(items);
    }
```

- [ ] **Step 3: Update `restoreStockForOrder(List<CheckoutItemDto>)` (lines 229-240)**

Current code at lines 229-240:
```java
    private void restoreStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        List<BatchStockRequest> batchItems = items.stream()
                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
                .collect(Collectors.toList());

        if (batchItems.isEmpty()) {
            return;
        }

        batchRestoreStock(batchItems);
    }
```

Change to:
```java
    private void restoreStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        List<BatchStockRequest> batchItems = items.stream()
                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity(), itemDto.getProductId()))
                .collect(Collectors.toList());

        if (batchItems.isEmpty()) {
            return;
        }

        batchRestoreStock(batchItems);
    }
```

- [ ] **Step 4: Update the fallback stock restore in `createOrderFromCheckout()` catch block (lines 127-131)**

Current code at lines 127-131:
```java
                        request.getItems().stream()
                                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                                .map(itemDto -> new com.iuh.fit.client.dto.BatchStockRequest(
                                        itemDto.getVariantId(), itemDto.getQuantity()))
                                .collect(Collectors.toList()),
```

Change to:
```java
                        request.getItems().stream()
                                .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                                .map(itemDto -> new com.iuh.fit.client.dto.BatchStockRequest(
                                        itemDto.getVariantId(), itemDto.getQuantity(), itemDto.getProductId()))
                                .collect(Collectors.toList()),
```

- [ ] **Step 5: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: No errors

- [ ] **Step 6: Run existing tests**

Run: `cd OrderService && ./mvnw test -Dtest=OrderServiceCheckoutTest -q`
Expected: All tests pass (existing tests still pass because `createRequest()` already sets `productId`)

- [ ] **Step 7: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git commit -m "feat: populate productId in all BatchStockRequest build sites"
```

---

### Task 3: Add cache invalidation to ProductService stock.service.js

**Files:**
- Modify: `ProductService/src/services/stock.service.js`

- [ ] **Step 1: Add cache imports at top of file**

Current imports (lines 1-5):
```javascript
import { dynamoClient } from "../config/aws.config.js";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();
```

Change to:
```javascript
import { dynamoClient } from "../config/aws.config.js";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { cacheDel, cacheDelPattern, keys } from "./cache.service.js";
import dotenv from "dotenv";

dotenv.config();
```

- [ ] **Step 2: Add helper method for cache invalidation**

Add this method to the `StockService` class (before `parseCancellationReasons`):

```javascript
  async invalidateProductCache(items) {
    try {
      const productIds = [...new Set(items.map(item => item.productId).filter(Boolean))];
      for (const productId of productIds) {
        await cacheDel(keys.detail(productId));
      }
      if (productIds.length > 0) {
        await cacheDelPattern("product:list:*");
      }
    } catch (err) {
      console.error("[Stock] Cache invalidation error:", err.message);
    }
  }
```

- [ ] **Step 3: Call invalidation after successful deduct**

In `batchDeductStock()`, after the successful transaction and before returning `result` (after line 39, before line 41):

Current code around lines 35-46:
```javascript
    try {
      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
      const result = { success: true };

      if (idempotencyKey) {
        const { redisClient } = await import("../config/redis.config.js");
        await redisClient.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), { EX: 3600 });
      }

      return result;
```

Change to:
```javascript
    try {
      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
      const result = { success: true };

      if (idempotencyKey) {
        const { redisClient } = await import("../config/redis.config.js");
        await redisClient.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), { EX: 3600 });
      }

      await this.invalidateProductCache(items);

      return result;
```

- [ ] **Step 4: Call invalidation after successful restore**

In `batchRestoreStock()`, after the successful transaction and before returning `result` (after line 85, before line 87):

Current code around lines 81-92:
```javascript
    try {
      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
      const result = { success: true };

      if (idempotencyKey) {
        const { redisClient } = await import("../config/redis.config.js");
        await redisClient.set(`idempotency:restore:${idempotencyKey}`, JSON.stringify(result), { EX: 3600 });
      }

      return result;
```

Change to:
```javascript
    try {
      await dynamoClient.send(new TransactWriteCommand({
        TransactItems: transactItems
      }));
      const result = { success: true };

      if (idempotencyKey) {
        const { redisClient } = await import("../config/redis.config.js");
        await redisClient.set(`idempotency:restore:${idempotencyKey}`, JSON.stringify(result), { EX: 3600 });
      }

      await this.invalidateProductCache(items);

      return result;
```

- [ ] **Step 5: Verify syntax**

Run: `cd ProductService && node -c src/services/stock.service.js`
Expected: No syntax errors

- [ ] **Step 6: Commit**

```bash
git add ProductService/src/services/stock.service.js
git commit -m "feat: invalidate product cache after stock deduct/restore"
```

---

### Task 4: Write ProductService unit tests for cache invalidation

**Files:**
- Modify: `ProductService/src/__tests__/stock.service.test.js`

- [ ] **Step 1: Add Redis mock for cache operations**

Current mock at lines 12-19:
```javascript
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
vi.mock("../config/redis.config.js", () => ({
  redisClient: {
    get: vi.fn().mockImplementation(async (key) => mockRedisGet(key)),
    set: vi.fn().mockImplementation(async (key, val, opts) => mockRedisSet(key, val, opts))
  }
}));
```

Change to:
```javascript
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisScan = vi.fn();
vi.mock("../config/redis.config.js", () => ({
  redisClient: {
    get: vi.fn().mockImplementation(async (key) => mockRedisGet(key)),
    set: vi.fn().mockImplementation(async (key, val, opts) => mockRedisSet(key, val, opts)),
    del: vi.fn().mockImplementation(async (keyOrKeys) => mockRedisDel(keyOrKeys)),
    scan: vi.fn().mockImplementation(async (cursor, opts) => mockRedisScan(cursor, opts))
  }
}));
```

- [ ] **Step 2: Add test for deduct stock cache invalidation**

Add after the existing test block (after line 72, before the final `});`):

```javascript
  it("should invalidate detail and list cache after successful deduct", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisScan.mockResolvedValueOnce({ cursor: 0, keys: ["product:list:abc123"] });

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-789"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisScan).toHaveBeenCalledWith(0, { MATCH: "product:list:*", COUNT: 100 });
  });

  it("should invalidate cache for multiple unique productIds after deduct", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisScan.mockResolvedValueOnce({ cursor: 0, keys: [] });

    const result = await stockService.batchDeductStock(
      [
        { variantId: "var_1", quantity: 1, productId: "prod_1" },
        { variantId: "var_2", quantity: 2, productId: "prod_2" },
        { variantId: "var_3", quantity: 1, productId: "prod_1" } // duplicate productId
      ],
      "checkout-dup"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledTimes(2);
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_2");
  });

  it("should skip cache invalidation when productId is missing", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-no-pid"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).not.toHaveBeenCalled();
    expect(mockRedisScan).not.toHaveBeenCalled();
  });

  it("should invalidate cache after successful restore", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisScan.mockResolvedValueOnce({ cursor: 0, keys: ["product:list:def456"] });

    const result = await stockService.batchRestoreStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "restore-123"
    );

    expect(result).toEqual({ success: true });
    expect(mockRedisDel).toHaveBeenCalledWith("product:detail:prod_1");
    expect(mockRedisScan).toHaveBeenCalledWith(0, { MATCH: "product:list:*", COUNT: 100 });
  });

  it("should not fail stock operation when cache invalidation throws", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});
    mockRedisDel.mockRejectedValueOnce(new Error("Redis connection lost"));

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2, productId: "prod_1" }],
      "checkout-cache-err"
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 3: Run tests**

Run: `cd ProductService && npx vitest run src/__tests__/stock.service.test.js`
Expected: All 8 tests pass (3 existing + 5 new)

- [ ] **Step 4: Commit**

```bash
git add ProductService/src/__tests__/stock.service.test.js
git commit -m "test: add cache invalidation tests for stock operations"
```

---

### Task 5: Update existing OrderService test to verify productId is passed

**Files:**
- Modify: `OrderService/src/test/java/com/iuh/fit/service/OrderServiceCheckoutTest.java`

- [ ] **Step 1: Add test to verify BatchStockRequest includes productId**

Add this test method before the final `}` of the class (after line 92):

```java
    @Test
    void shouldPassProductIdInBatchStockRequest() {
        CreateOrderFromCheckoutRequest request = createRequest();
        when(orderRepository.findByUserIdAndCheckoutOrderId(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(productClient.batchDeductStock(anyList(), anyString()))
                .thenReturn(new BatchStockResponse(true, null));
        when(orderRepository.save(any(Order.class)))
                .thenAnswer(invocation -> {
                    Order order = invocation.getArgument(0);
                    order.setId(1L);
                    return order;
                });

        orderService.createOrderFromCheckout(1L, "test@email.com", request);

        verify(productClient).batchDeductStock(argThat(items -> {
            BatchStockRequest first = items.get(0);
            return "var_1".equals(first.variantId())
                    && first.quantity() == 2
                    && "prod_1".equals(first.productId());
        }), anyString());
    }
```

- [ ] **Step 2: Run tests**

Run: `cd OrderService && ./mvnw test -Dtest=OrderServiceCheckoutTest -q`
Expected: All 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/test/java/com/iuh/fit/service/OrderServiceCheckoutTest.java
git commit -m "test: verify productId is passed in BatchStockRequest"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run all ProductService tests**

Run: `cd ProductService && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run all OrderService tests**

Run: `cd OrderService && ./mvnw test -q`
Expected: All tests pass

- [ ] **Step 3: Final commit with verification tag**

```bash
git commit --allow-empty -m "chore: verify all tests pass for stock cache invalidation feature"
```

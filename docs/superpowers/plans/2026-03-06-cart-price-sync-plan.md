# Cart Price Sync & Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement event-driven cart price sync so that when admins change product data, cart items are flagged, users are notified before checkout, and can sync to latest data before payment.

**Architecture:** ProductService publishes `product.updated` RabbitMQ events → CartService consumes via `@RabbitListener`, runs SQL UPDATE to set `needs_sync = true` on affected cart items, evicts Redis cache for affected users → Frontend shows warning banner, checkout validates → modal prompts user → sync API updates cart data → confirmation popup → checkout.

**Tech Stack:** Java 21, Spring Boot 3.3.1, Spring AMQP, MariaDB, Redis, React 19, TypeScript, TanStack Query, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `CartItem.java` | Modify | Add `needsSync` field |
| `CartItemRepository.java` | Modify | Add bulk UPDATE + findDistinctUserIds queries |
| `RabbitMQConfig.java` | Modify | Add product sync queue, exchange, binding |
| `ProductUpdateListener.java` | Create | Consume `product.updated`, SQL UPDATE + Redis pipeline delete |
| `ProductServiceClient.java` | Modify | Add `bulkGetProducts` Feign method |
| `SyncRequest.java` | Create | Sync request DTO |
| `SyncResponse.java` | Create | Sync response DTO |
| `BulkProductRequest.java` | Create | Bulk fetch request DTO |
| `BulkProductResponse.java` | Create | Bulk fetch response DTO |
| `CartService.java` | Modify | Add `syncItems()`, enhance `buildCartResponse()` with `hasChanges` + `needsSync` |
| `CartController.java` | Modify | Add `PATCH /{userId}/sync` endpoint |
| `application.properties` | Modify | Enable RabbitMQ listener |
| `product.controller.js` | Modify | Add `bulkGetProducts` handler |
| `product.service.js` | Modify | Add `getProductsByIds` method |
| `product.routes.js` | Modify | Register `POST /api/products/bulk` |
| `cartApi.ts` | Modify | Add `syncCartItems` API function, update types |
| `useCart.ts` | Modify | Add `useSyncCartItems` hook |
| `CartPage.tsx` | Modify | Add banner, badge, validation modal, confirmation popup |
| `ProductUpdateListenerTest.java` | Create | Unit tests for listener |
| `CartServiceSyncTest.java` | Create | Unit tests for syncItems |

---

### Task 1: CartService — Add `needsSync` field to CartItem entity

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/entity/CartItem.java`

- [ ] **Step 1: Add `needsSync` field**

Add after `imageUrl` field:

```java
@Column(name = "image_url")
private String imageUrl;

@Column(name = "needs_sync", nullable = false)
@Builder.Default
private Boolean needsSync = false;
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/domain/entity/CartItem.java
git commit -m "feat(CartService): add needsSync field to CartItem entity"
```

---

### Task 2: CartService — Add repository queries for bulk sync operations

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/repository/CartItemRepository.java`

- [ ] **Step 1: Add bulk UPDATE and findDistinctUserIds queries**

Full file content:

```java
package iuh.fit.CartService.repository;

import iuh.fit.CartService.domain.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCartId(Long cartId);
    Optional<CartItem> findByCartIdAndVariantId(Long cartId, String variantId);
    void deleteByCartId(Long cartId);
    void deleteByIdAndCartId(Long itemId, Long cartId);
    List<CartItem> findAllByIdInAndCartId(List<Long> itemIds, Long cartId);
    void deleteAllByIdInAndCartId(List<Long> itemIds, Long cartId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE CartItem ci SET ci.needsSync = true WHERE ci.productId = :productId")
    int markNeedsSyncByProductId(@Param("productId") String productId);

    @Query("SELECT DISTINCT ci.cart.userId FROM CartItem ci WHERE ci.productId = :productId AND ci.needsSync = true")
    List<Long> findDistinctUserIdsByProductId(@Param("productId") String productId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.cart.userId = :userId AND ci.needsSync = true")
    List<CartItem> findNeedsSyncByUserId(@Param("userId") Long userId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.cart.userId = :userId AND ci.variantId IN :variantIds")
    List<CartItem> findByUserIdAndVariantIds(@Param("userId") Long userId, @Param("variantIds") List<String> variantIds);
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/repository/CartItemRepository.java
git commit -m "feat(CartService): add bulk sync queries to CartItemRepository"
```

---

### Task 3: CartService — Configure RabbitMQ for product update events

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/config/RabbitMQConfig.java`

- [ ] **Step 1: Add product sync queue, exchange, and binding**

Add these constants and beans to the existing class:

```java
public static final String PRODUCT_EXCHANGE = "product.exchange";
public static final String PRODUCT_UPDATE_ROUTING_KEY = "product.updated";
public static final String PRODUCT_SYNC_QUEUE = "cart.product.sync.queue";

@Bean
public TopicExchange productExchange() {
    return new TopicExchange(PRODUCT_EXCHANGE);
}

@Bean
public Queue productSyncQueue() {
    return QueueBuilder.durable(PRODUCT_SYNC_QUEUE).build();
}

@Bean
public Binding productSyncBinding(Queue productSyncQueue, TopicExchange productExchange) {
    return BindingBuilder.bind(productSyncQueue).to(productExchange).with(PRODUCT_UPDATE_ROUTING_KEY);
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/config/RabbitMQConfig.java
git commit -m "feat(CartService): add RabbitMQ config for product update events"
```

---

### Task 4: CartService — Create ProductUpdateListener

**Files:**
- Create: `CartService/src/main/java/iuh/fit/CartService/listener/ProductUpdateListener.java`

- [ ] **Step 1: Create the listener class**

```java
package iuh.fit.CartService.listener;

import iuh.fit.CartService.repository.CartItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Component
public class ProductUpdateListener {

    private static final Logger log = LoggerFactory.getLogger(ProductUpdateListener.class);
    private static final String CART_CACHE_PREFIX = "cart:";

    private final CartItemRepository cartItemRepository;
    private final RedisTemplate<String, String> redisTemplate;

    public ProductUpdateListener(CartItemRepository cartItemRepository,
                                  RedisTemplate<String, String> redisTemplate) {
        this.cartItemRepository = cartItemRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    @RabbitListener(queues = "${cart.rabbitmq.product-sync-queue:cart.product.sync.queue}")
    @SuppressWarnings("unchecked")
    public void handleProductUpdate(Map<String, Object> message) {
        try {
            Map<String, Object> data = (Map<String, Object>) message.get("data");
            if (data == null) {
                log.warn("Received product update event with no data");
                return;
            }

            String productId = (String) data.get("id");
            if (productId == null) {
                log.warn("Received product update event with no product id");
                return;
            }

            int updatedCount = cartItemRepository.markNeedsSyncByProductId(productId);
            if (updatedCount == 0) {
                log.debug("No cart items affected by product update: {}", productId);
                return;
            }

            log.info("Marked {} cart items as needsSync for product {}", updatedCount, productId);

            List<Long> affectedUserIds = cartItemRepository.findDistinctUserIdsByProductId(productId);
            if (!affectedUserIds.isEmpty()) {
                evictCaches(affectedUserIds);
                log.info("Evicted Redis cache for {} users affected by product {}", affectedUserIds.size(), productId);
            }
        } catch (Exception e) {
            log.error("Error processing product update event: {}", e.getMessage(), e);
        }
    }

    private void evictCaches(List<Long> userIds) {
        try {
            String[] keys = userIds.stream()
                    .map(id -> CART_CACHE_PREFIX + id)
                    .toArray(String[]::new);
            redisTemplate.delete(List.of(keys));
        } catch (Exception e) {
            log.error("Failed to evict caches: {}", e.getMessage());
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/listener/ProductUpdateListener.java
git commit -m "feat(CartService): add ProductUpdateListener for product.updated events"
```

---

### Task 5: CartService — Add DTOs for sync and bulk fetch

**Files:**
- Create: `CartService/src/main/java/iuh/fit/CartService/domain/dto/SyncRequest.java`
- Create: `CartService/src/main/java/iuh/fit/CartService/domain/dto/SyncResponse.java`
- Create: `CartService/src/main/java/iuh/fit/CartService/domain/dto/BulkProductRequest.java`
- Create: `CartService/src/main/java/iuh/fit/CartService/domain/dto/BulkProductResponse.java`

- [ ] **Step 1: Create SyncRequest.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncRequest {
    private List<String> variantIds;
    @Builder.Default
    private Boolean forceSync = false;
}
```

- [ ] **Step 2: Create SyncResponse.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncResponse {
    private List<SyncedItem> synced;
    private List<SyncError> errors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncedItem {
        private String variantId;
        private String productName;
        private BigDecimal price;
        private Integer quantity;
        private Boolean needsSync;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncError {
        private String variantId;
        private String reason;
        private String message;
    }
}
```

- [ ] **Step 3: Create BulkProductRequest.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkProductRequest {
    private List<String> productIds;
}
```

- [ ] **Step 4: Create BulkProductResponse.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkProductResponse {
    private Map<String, ProductDto> products;
}
```

- [ ] **Step 5: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/domain/dto/SyncRequest.java \
  CartService/src/main/java/iuh/fit/CartService/domain/dto/SyncResponse.java \
  CartService/src/main/java/iuh/fit/CartService/domain/dto/BulkProductRequest.java \
  CartService/src/main/java/iuh/fit/CartService/domain/dto/BulkProductResponse.java
git commit -m "feat(CartService): add sync and bulk fetch DTOs"
```

---

### Task 6: CartService — Add bulk fetch to ProductServiceClient

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/client/ProductServiceClient.java`

- [ ] **Step 1: Add bulkGetProducts method to Feign client**

Full file content:

```java
package iuh.fit.CartService.client;

import iuh.fit.CartService.domain.dto.BulkProductRequest;
import iuh.fit.CartService.domain.dto.BulkProductResponse;
import iuh.fit.CartService.domain.dto.DeductStockRequest;
import iuh.fit.CartService.domain.dto.ProductDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ProductService")
public interface ProductServiceClient {

    @GetMapping("/api/products/{id}")
    ProductDto getProductById(@PathVariable("id") String id);

    @PostMapping("/api/products/variants/{variantId}/deduct-stock")
    void deductStock(@PathVariable("variantId") String variantId, @RequestBody DeductStockRequest request);

    @PostMapping("/api/products/bulk")
    BulkProductResponse bulkGetProducts(@RequestBody BulkProductRequest request);
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/client/ProductServiceClient.java
git commit -m "feat(CartService): add bulkGetProducts to ProductServiceClient"
```

---

### Task 7: CartService — Implement syncItems and enhance buildCartResponse

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`

- [ ] **Step 1: Add syncItems method**

Add this method before the `private` helper methods (after `removeItemsBulk`):

```java
@Transactional
public SyncResponse syncItems(Long userId, SyncRequest request) {
    List<CartItem> targetItems;

    if (request.getForceSync() != null && request.getForceSync()) {
        targetItems = cartItemRepository.findByCartId(
                cartRepository.findByUserId(userId)
                        .orElseThrow(() -> new RuntimeException("Cart not found"))
                        .getId());
    } else if (request.getVariantIds() != null && !request.getVariantIds().isEmpty()) {
        targetItems = cartItemRepository.findByUserIdAndVariantIds(userId, request.getVariantIds());
    } else {
        targetItems = cartItemRepository.findNeedsSyncByUserId(userId);
    }

    if (targetItems.isEmpty()) {
        return SyncResponse.builder()
                .synced(List.of())
                .errors(List.of())
                .build();
    }

    List<String> productIds = targetItems.stream()
            .map(CartItem::getProductId)
            .distinct()
            .collect(Collectors.toList());

    Map<String, ProductDto> productMap;
    try {
        BulkProductResponse bulkResponse = productServiceClient.bulkGetProducts(
                BulkProductRequest.builder().productIds(productIds).build());
        productMap = bulkResponse.getProducts();
    } catch (Exception e) {
        log.error("Bulk fetch failed for user {}: {}", userId, e.getMessage());
        throw new RuntimeException("Khong the dong bo gio hang, vui long thu lai sau");
    }

    List<SyncResponse.SyncedItem> synced = new ArrayList<>();
    List<SyncResponse.SyncError> errors = new ArrayList<>();

    for (CartItem item : targetItems) {
        ProductDto product = productMap.get(item.getProductId());
        if (product == null) {
            errors.add(SyncResponse.SyncError.builder()
                    .variantId(item.getVariantId())
                    .reason("PRODUCT_NOT_FOUND")
                    .message("San pham khong ton tai")
                    .build());
            continue;
        }

        VariantDto variant = product.getVariants().stream()
                .filter(v -> v.getId().equals(item.getVariantId()))
                .findFirst()
                .orElse(null);

        if (variant == null) {
            errors.add(SyncResponse.SyncError.builder()
                    .variantId(item.getVariantId())
                    .reason("VARIANT_NOT_FOUND")
                    .message("Variant khong ton tai")
                    .build());
            continue;
        }

        if (variant.getQuantity() == 0) {
            errors.add(SyncResponse.SyncError.builder()
                    .variantId(item.getVariantId())
                    .reason("OUT_OF_STOCK")
                    .message("San pham '" + item.getProductName() + "' da het hang")
                    .build());
            continue;
        }

        if (variant.getQuantity() < item.getQuantity()) {
            errors.add(SyncResponse.SyncError.builder()
                    .variantId(item.getVariantId())
                    .reason("INSUFFICIENT_STOCK")
                    .message("San pham '" + item.getProductName() + "' chi con " + variant.getQuantity() + " san pham")
                    .build());
            continue;
        }

        item.setPrice(product.getPrice());
        item.setProductName(product.getName());
        item.setImageUrl(product.getImageUrl());
        item.setColor(variant.getColor());
        item.setSize(variant.getSize());
        item.setSku(variant.getSku());
        item.setNeedsSync(false);
        cartItemRepository.save(item);

        synced.add(SyncResponse.SyncedItem.builder()
                .variantId(item.getVariantId())
                .productName(item.getProductName())
                .price(item.getPrice())
                .quantity(item.getQuantity())
                .needsSync(false)
                .build());
    }

    invalidateCache(userId);

    return SyncResponse.builder()
            .synced(synced)
            .errors(errors)
            .build();
}
```

- [ ] **Step 2: Replace buildCartResponse method**

Replace the existing `buildCartResponse` method entirely:

```java
private CartResponse buildCartResponse(Cart cart) {
    List<CartItem> items = cartItemRepository.findByCartId(cart.getId());

    boolean hasChanges = false;
    List<CartResponse.CartItemDto> itemDtos = new ArrayList<>();

    for (CartItem item : items) {
        if (item.getNeedsSync() != null && item.getNeedsSync()) {
            hasChanges = true;
        }

        itemDtos.add(CartResponse.CartItemDto.builder()
                .id(item.getId())
                .variantId(item.getVariantId())
                .productId(item.getProductId())
                .productName(item.getProductName())
                .color(item.getColor())
                .size(item.getSize())
                .price(item.getPrice())
                .quantity(item.getQuantity())
                .subtotal(item.getSubtotal())
                .sku(item.getSku())
                .imageUrl(item.getImageUrl())
                .needsSync(item.getNeedsSync() != null && item.getNeedsSync())
                .build());
    }

    BigDecimal totalAmount = itemDtos.stream()
            .map(CartResponse.CartItemDto::getSubtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    int totalItems = itemDtos.stream()
            .mapToInt(CartResponse.CartItemDto::getQuantity)
            .sum();

    return CartResponse.builder()
            .cartId(cart.getId())
            .userId(cart.getUserId())
            .items(itemDtos)
            .totalAmount(totalAmount)
            .totalItems(totalItems)
            .hasChanges(hasChanges)
            .build();
}
```

- [ ] **Step 3: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/service/CartService.java
git commit -m "feat(CartService): add syncItems and enhance buildCartResponse with hasChanges"
```

---

### Task 8: CartService — Add sync endpoint to CartController

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/controller/CartController.java`

- [ ] **Step 1: Add PATCH sync endpoint**

Add this endpoint after the existing `removeItemsBulk` method:

```java
@PatchMapping("/{userId}/sync")
@Operation(summary = "Sync cart items with latest product data", description = "Updates cart items with current product prices, names, and stock. Returns synced items and any errors (out of stock, etc).")
public ResponseEntity<SyncResponse> syncCartItems(
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody SyncRequest request) {
    return ResponseEntity.ok(cartService.syncItems(userId, request));
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/controller/CartController.java
git commit -m "feat(CartService): add PATCH /api/cart/{userId}/sync endpoint"
```

---

### Task 9: CartService — Enable RabbitMQ listener in application.properties

**Files:**
- Modify: `CartService/src/main/resources/application.properties`

- [ ] **Step 1: Add listener enable + queue config**

Add these lines at the end:

```properties
# RabbitMQ Listener
spring.rabbitmq.listener.simple.auto-startup=true
spring.rabbitmq.listener.simple.acknowledge-mode=auto
cart.rabbitmq.product-sync-queue=cart.product.sync.queue
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/resources/application.properties
git commit -m "config(CartService): enable RabbitMQ listener"
```

---

### Task 10: ProductService — Add bulk fetch endpoint

**Files:**
- Modify: `ProductService/src/services/product.service.js`
- Modify: `ProductService/src/controllers/product.controller.js`
- Modify: `ProductService/src/routes/product.routes.js`

- [ ] **Step 1: Add getProductsByIds to product.service.js**

Add this method to the `ProductService` class (after `getProductById`). Also add the import at the top of the file:

```javascript
import { BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
```

And add `const TABLE_NAME` reference (already exists at top of file as `process.env.TABLE_NAME`).

Method implementation:

```javascript
async getProductsByIds(ids) {
  if (!ids || ids.length === 0) return {};
  const products = {};

  // Batch get from DynamoDB in chunks of 100 (AWS limit per BatchGetItem)
  const CHUNK_SIZE = 100;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const params = {
      RequestItems: {
        [TABLE_NAME]: {
          Keys: chunk.map((id) => ({ id })),
        },
      },
    };
    const command = new BatchGetItemCommand(params);
    const response = await dynamoClient.send(command);
    const items = response.Responses?.[TABLE_NAME] || [];
    for (const item of items) {
      item.variants = await variantModel.findByProductId(item.id);
      products[item.id] = item;
    }
  }
  return products;
}
```

- [ ] **Step 2: Add bulkGetProducts controller handler**

Add this function to `product.controller.js`:

```javascript
export const bulkGetProducts = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds must be a non-empty array" });
    }
    const products = await productService.getProductsByIds(productIds);
    res.status(200).json({ products });
  } catch (error) {
    console.error("Error bulk get products:", error);
    res.status(500).json({ message: "Loi server khi lay san pham", error: error.message });
  }
};
```

- [ ] **Step 3: Register route in product.routes.js**

Add `bulkGetProducts` to the existing import block:

```javascript
import {
  getAllProducts,
  getProduct,
  createNewProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  getFeaturedProducts,
  getNewArrivals,
  getRelatedProducts,
  deductStock,
  restoreStock,
  bulkGetProducts,
} from "../controllers/product.controller.js";
```

Add this route BEFORE `router.get("/:id", getProduct);`:

```javascript
router.post("/bulk", bulkGetProducts);
```

- [ ] **Step 4: Commit**

```bash
git add ProductService/src/services/product.service.js \
  ProductService/src/controllers/product.controller.js \
  ProductService/src/routes/product.routes.js
git commit -m "feat(ProductService): add POST /api/products/bulk endpoint"
```

---

### Task 11: Frontend — Update cartApi with sync types and function

**Files:**
- Modify: `frontend/src/services/cartApi.ts`

- [ ] **Step 1: Update CartItem and Cart interfaces**

Add `needsSync` to `CartItem`:

```typescript
export interface CartItem {
  id: number;
  variantId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  subtotal: number;
  sku?: string;
  imageUrl?: string;
  needsSync?: boolean;
}
```

Add `hasChanges` to `Cart`:

```typescript
export interface Cart {
  cartId: number;
  userId: number;
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
  hasChanges?: boolean;
}
```

- [ ] **Step 2: Add sync types and API function**

Add after existing exports:

```typescript
export interface SyncRequest {
  variantIds?: string[];
  forceSync?: boolean;
}

export interface SyncedItem {
  variantId: string;
  productName: string;
  price: number;
  quantity: number;
  needsSync: boolean;
}

export interface SyncError {
  variantId: string;
  reason: string;
  message: string;
}

export interface SyncResponse {
  synced: SyncedItem[];
  errors: SyncError[];
}

export const syncCartItems = (payload: SyncRequest) =>
  axiosInstance.patch<SyncResponse>("/api/cart/sync", payload).then((res) => res.data);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/cartApi.ts
git commit -m "feat(frontend): add syncCartItems API and update types"
```

---

### Task 12: Frontend — Add useSyncCartItems hook

**Files:**
- Modify: `frontend/src/hooks/useCart.ts`

- [ ] **Step 1: Add import and hook**

Update the import block to include `syncCartItems` and `SyncRequest`:

```typescript
import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
  checkout,
  clearCartAfterCheckout,
  partialCheckout,
  removeCartItemsBulk,
  syncCartItems,
  type AddCartItemPayload,
  type UpdateCartItemPayload,
  type SyncRequest,
} from "@/src/services/cartApi";
```

Add this hook at the end of the file:

```typescript
export function useSyncCartItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SyncRequest) => syncCartItems(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Khong the dong bo gio hang";
        toast.error(msg);
      } else {
        toast.error("Khong the dong bo gio hang");
      }
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useCart.ts
git commit -m "feat(frontend): add useSyncCartItems hook"
```

---

### Task 13: Frontend — Enhance CartPage with validation modal, banner, badge, confirmation popup

**Files:**
- Modify: `frontend/src/pages/CartPage.tsx`

- [ ] **Step 1: Replace all imports**

Replace the entire import block at the top:

```typescript
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  useValidateCart,
  useSyncCartItems,
} from "@/src/hooks/useCart";
import { useCartSelection } from "@/src/hooks/useCartSelection";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import type { ValidationError } from "@/src/services/cartApi";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
```

- [ ] **Step 2: Add state and mutations**

After `const [editingQty, setEditingQty] = useState<Record<number, string>>({});`, add:

```typescript
const [showValidationModal, setShowValidationModal] = useState(false);
const [showConfirmationModal, setShowConfirmationModal] = useState(false);
const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
const [syncedTotal, setSyncedTotal] = useState(0);

const validateMutation = useValidateCart();
const syncMutation = useSyncCartItems();
```

- [ ] **Step 3: Replace handleCheckout**

Replace the existing `handleCheckout` function:

```typescript
const handleCheckout = async () => {
  if (selectedIds.length === 0) return;

  try {
    const validation = await validateMutation.mutateAsync();
    if (validation.valid) {
      const idsParam = selectedIds.join(",");
      navigate(`/checkout?selectedIds=${idsParam}`);
    } else {
      setValidationErrors(validation.errors);
      setShowValidationModal(true);
    }
  } catch (error) {
    if (isAxiosError(error)) {
      const data = error.response?.data;
      if (data?.errors) {
        setValidationErrors(data.errors);
        setShowValidationModal(true);
      } else {
        const msg = data?.message || "Khong the kiem tra gio hang";
        toast.error(msg);
      }
    } else {
      toast.error("Khong the kiem tra gio hang");
    }
  }
};
```

- [ ] **Step 4: Add new handler functions**

Add after `handleCheckout`:

```typescript
const handleContinueCheckout = async () => {
  try {
    const result = await syncMutation.mutateAsync({});
    if (result.errors.length > 0) {
      const stockErrors = result.errors.filter(
        (e) => e.reason === "OUT_OF_STOCK" || e.reason === "INSUFFICIENT_STOCK"
      );
      if (stockErrors.length > 0) {
        stockErrors.forEach((e) => toast.error(e.message));
        setShowValidationModal(false);
        return;
      }
    }

    const refetched = await refetch();
    if (refetched.data) {
      const selectedItemsInCart = refetched.data.items.filter((item) =>
        selectedIds.includes(item.id)
      );
      const newTotal = selectedItemsInCart.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
      setSyncedTotal(newTotal);
      setShowValidationModal(false);
      setShowConfirmationModal(true);
    }
  } catch (error) {
    if (isAxiosError(error)) {
      toast.error(error.response?.data?.message || "Khong the dong bo gio hang");
    } else {
      toast.error("Khong the dong bo gio hang");
    }
  }
};

const handleBackToCart = async () => {
  try {
    await syncMutation.mutateAsync({});
    await refetch();
  } catch {
    await refetch();
  }
  setShowValidationModal(false);
};

const handleConfirmPayment = () => {
  setShowConfirmationModal(false);
  const idsParam = selectedIds.join(",");
  navigate(`/checkout?selectedIds=${idsParam}`);
};
```

- [ ] **Step 5: Add warning banner**

After `<div className="mx-auto">` and before the header div, add:

```tsx
{cart.hasChanges && (
  <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
    <div>
      <p className="font-medium text-amber-800 dark:text-amber-200">
        Mot so san pham trong gio hang da co thay doi
      </p>
      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
        Gia hoac thong tin san pham da duoc cap nhat. Vui long kiem tra truoc khi thanh toan.
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 6: Add needsSync badge**

In the cart item map, find the color/size badges block and replace:

```tsx
<div className="flex gap-2 mt-1">
  <Badge variant="secondary" className="text-xs">
    {item.color}
  </Badge>
  <Badge variant="secondary" className="text-xs">
    {item.size}
  </Badge>
  {item.needsSync && (
    <Badge variant="destructive" className="text-xs">
      Da thay doi
    </Badge>
  )}
</div>
```

- [ ] **Step 7: Add validation and confirmation modals**

Add before `export default CartPage;`:

```tsx
<Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        Thong tin san pham da thay doi
      </DialogTitle>
      <DialogDescription>
        Mot so san pham trong gio hang da co thay doi. Ban co muon tiep tuc?
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-3 max-h-60 overflow-y-auto">
      {validationErrors.map((error, idx) => (
        <div key={idx} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {error.reason === "PRICE_CHANGED" && "Gia da thay doi"}
            {error.reason === "NAME_CHANGED" && "Ten san pham da thay doi"}
            {error.reason === "IMAGE_CHANGED" && "Hinh anh da thay doi"}
            {error.reason === "OUT_OF_STOCK" && "Het hang"}
            {error.reason === "INSUFFICIENT_STOCK" && "Khong du hang"}
            {error.reason === "VARIANT_NOT_FOUND" && "Variant khong ton tai"}
            {error.reason === "PRODUCT_INACTIVE" && "San pham ngung hoat dong"}
          </p>
          <p className="text-muted-foreground mt-1">{error.message}</p>
        </div>
      ))}
    </div>
    <DialogFooter className="sm:justify-between">
      <Button
        variant="outline"
        onClick={handleBackToCart}
        disabled={syncMutation.isPending}
      >
        {syncMutation.isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Dang dong bo...</>
        ) : "Quay lai gio hang"}
      </Button>
      <Button onClick={handleContinueCheckout} disabled={syncMutation.isPending}>
        {syncMutation.isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Dang dong bo...</>
        ) : "Tiep tuc"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={showConfirmationModal} onOpenChange={setShowConfirmationModal}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Xac nhan thanh toan</DialogTitle>
      <DialogDescription>
        Tong tien moi cua ban la{" "}
        <span className="font-semibold text-foreground">
          {formatCurrency(syncedTotal)}
        </span>
        . Xac nhan thanh toan?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="sm:justify-between">
      <Button variant="outline" onClick={() => setShowConfirmationModal(false)}>
        Huy
      </Button>
      <Button onClick={handleConfirmPayment}>Xac nhan</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/CartPage.tsx
git commit -m "feat(frontend): add validation modal, confirmation popup, banner, badge to CartPage"
```

---

### Task 14: CartService — Write unit tests for ProductUpdateListener

**Files:**
- Create: `CartService/src/test/java/iuh/fit/CartService/listener/ProductUpdateListenerTest.java`

- [ ] **Step 1: Create the test class**

```java
package iuh.fit.CartService.listener;

import iuh.fit.CartService.repository.CartItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProductUpdateListenerTest {

    @Mock
    private CartItemRepository cartItemRepository;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @InjectMocks
    private ProductUpdateListener listener;

    private Map<String, Object> createEventMessage(String productId) {
        return Map.of(
            "eventId", "test-event-id",
            "eventType", "UPDATE",
            "timestamp", "2026-03-06T00:00:00Z",
            "data", Map.of(
                "id", productId,
                "name", "Test Product",
                "price", 100.0,
                "imageUrl", "http://example.com/img.jpg"
            )
        );
    }

    @Test
    void shouldMarkNeedsSyncAndEvictCache_WhenProductUpdated() {
        String productId = "prod-123";
        when(cartItemRepository.markNeedsSyncByProductId(productId)).thenReturn(5);
        when(cartItemRepository.findDistinctUserIdsByProductId(productId)).thenReturn(List.of(1L, 2L, 3L));
        when(redisTemplate.delete(anyList())).thenReturn(3L);

        listener.handleProductUpdate(createEventMessage(productId));

        verify(cartItemRepository).markNeedsSyncByProductId(productId);
        verify(cartItemRepository).findDistinctUserIdsByProductId(productId);
        verify(redisTemplate).delete(List.of("cart:1", "cart:2", "cart:3"));
    }

    @Test
    void shouldDoNothing_WhenNoCartItemsAffected() {
        String productId = "prod-999";
        when(cartItemRepository.markNeedsSyncByProductId(productId)).thenReturn(0);

        listener.handleProductUpdate(createEventMessage(productId));

        verify(cartItemRepository).markNeedsSyncByProductId(productId);
        verify(cartItemRepository, never()).findDistinctUserIdsByProductId(anyString());
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void shouldHandleNullDataGracefully() {
        Map<String, Object> message = Map.of("eventId", "test", "eventType", "UPDATE");

        listener.handleProductUpdate(message);

        verifyNoInteractions(cartItemRepository);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void shouldHandleExceptionGracefully() {
        String productId = "prod-123";
        when(cartItemRepository.markNeedsSyncByProductId(productId)).thenThrow(new RuntimeException("DB error"));

        listener.handleProductUpdate(createEventMessage(productId));

        verify(cartItemRepository).markNeedsSyncByProductId(productId);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/test/java/iuh/fit/CartService/listener/ProductUpdateListenerTest.java
git commit -m "test(CartService): add ProductUpdateListener unit tests"
```

---

### Task 15: CartService — Write unit tests for syncItems

**Files:**
- Create: `CartService/src/test/java/iuh/fit/CartService/service/CartServiceSyncTest.java`

- [ ] **Step 1: Create the test class**

```java
package iuh.fit.CartService.service;

import iuh.fit.CartService.client.ProductServiceClient;
import iuh.fit.CartService.domain.dto.*;
import iuh.fit.CartService.domain.entity.Cart;
import iuh.fit.CartService.domain.entity.CartItem;
import iuh.fit.CartService.repository.CartItemRepository;
import iuh.fit.CartService.repository.CartRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceSyncTest {

    @Mock private CartRepository cartRepository;
    @Mock private CartItemRepository cartItemRepository;
    @Mock private ProductServiceClient productServiceClient;
    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ObjectMapper objectMapper;
    @InjectMocks private CartService cartService;

    private Cart testCart;
    private CartItem testItem;
    private ProductDto testProduct;
    private VariantDto testVariant;

    @BeforeEach
    void setUp() {
        testCart = Cart.builder().id(1L).userId(42L).build();
        testVariant = VariantDto.builder()
                .id("var-1").productId("prod-1").color("Red").size("M")
                .quantity(10).sku("SKU-001").build();
        testProduct = ProductDto.builder()
                .id("prod-1").name("Updated T-Shirt").price(new BigDecimal("150.00"))
                .imageUrl("http://new-image.jpg").status("ACTIVE")
                .variants(List.of(testVariant)).build();
        testItem = CartItem.builder()
                .id(100L).cart(testCart).variantId("var-1").productId("prod-1")
                .productName("Old T-Shirt").color("Red").size("M")
                .price(new BigDecimal("100.00")).quantity(2)
                .sku("SKU-001").imageUrl("http://old-image.jpg")
                .needsSync(true).build();
    }

    @Test
    void shouldSyncItemsWithBulkFetch() {
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of(testItem));
        when(productServiceClient.bulkGetProducts(any(BulkProductRequest.class)))
                .thenReturn(BulkProductResponse.builder().products(Map.of("prod-1", testProduct)).build());

        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());

        assertEquals(1, response.getSynced().size());
        assertEquals(0, response.getErrors().size());
        SyncResponse.SyncedItem synced = response.getSynced().get(0);
        assertEquals("var-1", synced.getVariantId());
        assertEquals("Updated T-Shirt", synced.getProductName());
        assertEquals(new BigDecimal("150.00"), synced.getPrice());
        assertFalse(synced.getNeedsSync());
        verify(cartItemRepository).save(testItem);
        verify(redisTemplate).delete("cart:42");
        assertEquals(new BigDecimal("150.00"), testItem.getPrice());
        assertFalse(testItem.getNeedsSync());
    }

    @Test
    void shouldReturnError_WhenVariantOutOfStock() {
        VariantDto oos = VariantDto.builder().id("var-1").productId("prod-1")
                .color("Red").size("M").quantity(0).sku("SKU-001").build();
        ProductDto p = ProductDto.builder().id("prod-1").name("T-Shirt")
                .price(new BigDecimal("150.00")).imageUrl("http://img.jpg")
                .status("ACTIVE").variants(List.of(oos)).build();
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of(testItem));
        when(productServiceClient.bulkGetProducts(any(BulkProductRequest.class)))
                .thenReturn(BulkProductResponse.builder().products(Map.of("prod-1", p)).build());

        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());

        assertEquals(0, response.getSynced().size());
        assertEquals(1, response.getErrors().size());
        assertEquals("OUT_OF_STOCK", response.getErrors().get(0).getReason());
    }

    @Test
    void shouldReturnError_WhenInsufficientStock() {
        VariantDto low = VariantDto.builder().id("var-1").productId("prod-1")
                .color("Red").size("M").quantity(1).sku("SKU-001").build();
        ProductDto p = ProductDto.builder().id("prod-1").name("T-Shirt")
                .price(new BigDecimal("150.00")).imageUrl("http://img.jpg")
                .status("ACTIVE").variants(List.of(low)).build();
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of(testItem));
        when(productServiceClient.bulkGetProducts(any(BulkProductRequest.class)))
                .thenReturn(BulkProductResponse.builder().products(Map.of("prod-1", p)).build());

        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());

        assertEquals(0, response.getSynced().size());
        assertEquals(1, response.getErrors().size());
        assertEquals("INSUFFICIENT_STOCK", response.getErrors().get(0).getReason());
    }

    @Test
    void shouldReturnEmpty_WhenNoItemsToSync() {
        when(cartItemRepository.findNeedsSyncByUserId(42L)).thenReturn(List.of());
        SyncResponse response = cartService.syncItems(42L, SyncRequest.builder().build());
        assertEquals(0, response.getSynced().size());
        assertEquals(0, response.getErrors().size());
        verifyNoInteractions(productServiceClient);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/test/java/iuh/fit/CartService/service/CartServiceSyncTest.java
git commit -m "test(CartService): add CartServiceSyncTest unit tests"
```

---

### Task 16: Run tests and verify build

- [ ] **Step 1: Run CartService tests**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop\CartService
./mvnw test
```

Expected: All tests pass

- [ ] **Step 2: Run CartService build**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop\CartService
./mvnw clean package -DskipTests
```

Expected: BUILD SUCCESS

- [ ] **Step 3: Run frontend lint**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop\frontend
npm run lint
```

Expected: No errors

- [ ] **Step 4: Run frontend build**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop\frontend
npm run build
```

Expected: Build succeeds

---

## Self-Review Checklist

**1. Spec coverage:**
- CartItem needsSync field -> Task 1
- RabbitMQ listener for product.updated -> Tasks 3, 4
- SQL UPDATE for needsSync (no OOM) -> Task 4
- Redis cache eviction on event -> Task 4
- Bulk fetch endpoint (no N+1) -> Tasks 6, 10
- Sync API endpoint -> Tasks 7, 8
- hasChanges in cart response -> Task 7
- needsSync per item in response -> Task 7
- Frontend warning banner -> Task 13
- Frontend "Da thay doi" badge -> Task 13
- Validation modal with old vs new -> Task 13
- Yes path: sync -> confirmation popup -> checkout -> Task 13
- No path: sync -> return to cart -> Task 13
- Stock error notification -> Task 13
- Unit tests for listener -> Task 14
- Unit tests for syncItems -> Task 15

**2. Placeholder scan:** No TBD, TODO, or incomplete sections. All code is complete.

**3. Type consistency:**
- SyncRequest, SyncResponse, BulkProductRequest, BulkProductResponse defined in Task 5, used consistently in Tasks 6, 7, 8, 10, 11, 12
- CartItem.needsSync (Boolean) consistent across entity, DTOs, frontend types
- Cart.hasChanges (boolean) consistent across service and frontend
- Validation error codes (PRICE_CHANGED, OUT_OF_STOCK, etc.) consistent between backend ValidationResponse and frontend modal

**4. Fixes applied after review:**
- Task 2: Added `clearAutomatically = true` to `@Modifying` to prevent JPA L1 cache staleness
- Task 4: Added `@Transactional` to `handleProductUpdate` to prevent `TransactionRequiredException`
- Task 10: Replaced N+1 DynamoDB queries with `BatchGetItemCommand` (chunked at 100 per AWS limit)

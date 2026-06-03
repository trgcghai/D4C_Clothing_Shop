# Cart Price Sync & Validation Design

**Date**: 2026-03-06  
**Status**: Draft  
**Author**: opencode

## Problem Statement

When a user adds a product to their cart, the price and product information are snapshotted at add-time. If an admin changes the price, name, image, or stock, the cart retains stale data. Users only discover discrepancies at checkout, which creates a poor experience.

## Requirements

1. Cart items must be proactively flagged when product data changes (event-driven via RabbitMQ)
2. Users must be notified of changes before checkout
3. When validation fails, users are prompted: *"Sản phẩm này đã được thay đổi thông tin. Bạn có muốn tiếp tục?"*
4. **Yes**: Sync cart items → show new total confirmation → proceed to checkout
5. **No**: Sync cart items → return to cart for review
6. If synced items are out of stock or insufficient stock, notify user and block checkout

## Architecture

### Component Overview

```
ProductService (RabbitMQ Publisher)
    |
    | product.updated event
    v
CartService (@RabbitListener)
    |
    |-- Marks CartItem.needsSync = true
    |-- Compares event data vs stored data
    |
    v
Frontend (React)
    |
    |-- GET /cart → hasChanges flag → warning banner
    |-- Checkout → validateCart() → modal → sync → confirm → checkout
```

### Data Model Changes

**cart_items table** (MariaDB):
- Add column: `needs_sync` BOOLEAN NOT NULL DEFAULT FALSE
- Add JPA field: `CartItem.needsSync`

### RabbitMQ Configuration (CartService)

**New Queue**: `cart.product.sync.queue`  
**Binding**: `product.exchange` → queue, routing key: `product.updated`

**Listener**: Consumes `product.updated` events, extracts productId, finds all cart items matching that productId, compares event payload (price, name, imageUrl, stock) against stored CartItem fields. If any differs, set `needsSync = true`.

**Event payload structure** (from ProductService):
```json
{
  "id": "product-uuid",
  "name": "string",
  "price": number,
  "imageUrl": "string",
  "variants": [{ "id": "variant-uuid", "quantity": number, "sku": "string" }]
}
```

### API Changes

#### 1. `PATCH /api/cart/{userId}/sync`

**Purpose**: Sync cart items with latest product data from ProductService.

**Request body**:
```json
{
  "variantIds": ["uuid1", "uuid2"],  // optional, if absent syncs all needsSync items
  "forceSync": false                   // optional, syncs all items regardless of needsSync
}
```

**Behavior**:
- For each target CartItem, fetches current product data via ProductServiceClient
- Updates CartItem fields: `price`, `productName`, `imageUrl`, `color`, `size`, `sku`
- Validates stock: if variant stock < requested quantity, adds to error list
- Sets `needsSync = false` on successfully synced items
- Invalidates Redis cache
- Returns: `{ synced: CartItem[], errors: [{ variantId, reason, message }] }`

**Response**:
```json
{
  "synced": [{ "variantId": "...", "price": 100, "productName": "...", "needsSync": false }],
  "errors": [{ "variantId": "...", "reason": "OUT_OF_STOCK", "message": "Sản phẩm đã hết hàng" }]
}
```

#### 2. `GET /api/cart/{userId}` (Enhanced)

**Response change**: Add `hasChanges` boolean at cart level.

```json
{
  "id": 1,
  "userId": 42,
  "items": [...],
  "total": 500,
  "hasChanges": true
}
```

`hasChanges = true` when any cart item has `needsSync = true`.

**CartItem response** (in CartResponse.items): Add `needsSync: boolean` per item so frontend can render per-item badges.

```json
{
  "variantId": "uuid",
  "productName": "T-Shirt",
  "price": 100,
  "quantity": 2,
  "needsSync": true
}
```

#### 3. `POST /api/cart/{userId}/checkout` (No change)

Existing `validateCart()` runs as before. After sync, data is fresh so validation passes.

### Frontend Flow

#### Cart Page
- On mount, call `GET /api/cart/{userId}`
- If `hasChanges === true`, show banner: *"Một số sản phẩm trong giỏ hàng đã có thay đổi về giá hoặc thông tin. Vui lòng kiểm tra trước khi thanh toán."*
- Items with `needsSync = true` get a *"Đã thay đổi"* badge

#### Checkout Flow
1. User clicks "Thanh toán"
2. Frontend calls `validateCart()`
3. If validation errors exist (PRICE_CHANGED, NAME_CHANGED, IMAGE_CHANGED, OUT_OF_STOCK):
   - Show modal listing changed items with old vs new values
   - Prompt: *"Sản phẩm này đã được thay đổi thông tin. Bạn có muốn tiếp tục?"*
4. **Yes (Tiếp tục)**:
   - Call `PATCH /api/cart/{userId}/sync`
   - If sync returns stock errors → show toast notification → return to cart
   - If sync success → fetch updated cart → show confirmation popup:
     - *"Tổng tiền mới của bạn là [formatted total]. Xác nhận thanh toán?"*
     - Shows updated itemized breakdown
     - **Xác nhận** → call checkout API → proceed to payment
     - **Hủy** → return to cart
5. **No (Quay lại giỏ hàng)**:
   - Call `PATCH /api/cart/{userId}/sync`
   - Fetch latest cart data
   - Clear alert
   - Return to cart (user reviews updated prices/items)

### Validation Error Types

| Code | Trigger | Message (Vietnamese) |
|---|---|---|
| `PRICE_CHANGED` | Stored price != current price | "Giá đã thay đổi từ [old] → [new]" |
| `NAME_CHANGED` | Stored name != current name | "Tên sản phẩm đã thay đổi" |
| `IMAGE_CHANGED` | Stored imageUrl != current imageUrl | "Hình ảnh sản phẩm đã thay đổi" |
| `OUT_OF_STOCK` | Variant stock = 0 | "Sản phẩm đã hết hàng" |
| `INSUFFICIENT_STOCK` | Variant stock < requested quantity | "Chỉ còn [X] sản phẩm" |

### Error Handling

- **ProductService unavailable during sync**: Return error, user stays in cart, can retry
- **RabbitMQ event lost**: Redis cache TTL (30 min) limits stale data window; validateCart() catches at checkout
- **Race condition** (user checks out while sync is running): Optimistic locking via `updatedAt` or checkout validation re-checks

### Testing Strategy

**CartService (JUnit 5)**:
- Unit test: `ProductUpdateListener` — verifies needsSync flagging logic
- Unit test: `CartService.syncItems()` — verifies field updates, stock validation, error reporting
- Integration test: Full sync flow with mock ProductServiceClient
- Integration test: RabbitMQ event consumption and cart item flagging

**Frontend**:
- Manual testing of checkout modal flow (Yes/No paths)
- Verify banner display, badge rendering, confirmation popup

## Migration

1. Add `needs_sync` column to `cart_items` table (Flyway or manual SQL)
2. Enable RabbitMQ listener in CartService `application.properties`
3. Deploy CartService with new listener and sync endpoint
4. Deploy frontend with updated checkout flow

## Files to Modify

| File | Change |
|---|---|
| `CartService/src/.../domain/entity/CartItem.java` | Add `needsSync` field |
| `CartService/src/.../config/RabbitMQConfig.java` | Add product.sync queue + binding |
| `CartService/src/.../listener/ProductUpdateListener.java` | New file — consumes product.updated |
| `CartService/src/.../service/CartService.java` | Add `syncItems()` method, enhance `getCart()` to set `hasChanges` |
| `CartService/src/.../domain/dto/SyncRequest.java` | New DTO |
| `CartService/src/.../domain/dto/SyncResponse.java` | New DTO |
| `CartService/src/.../controller/CartController.java` | Add `PATCH /{userId}/sync` endpoint |
| `CartService/src/main/resources/application.properties` | Enable listener |
| `frontend/src/pages/CartPage.tsx` | Add banner, badge, modal, confirmation popup |
| `frontend/src/services/cartService.ts` | Add sync API call |
| `frontend/src/components/` | New modal/confirmation components |

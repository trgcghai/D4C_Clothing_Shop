# Design: Buy Now + Cart Selection Flow

**Date:** 2026-05-13
**Status:** Draft
**Affected modules:** frontend, CartService

## 1. Problem Statement

Currently, clicking "Buy Now" adds the item to the cart and redirects to the cart page. The user must then click "Checkout" to proceed. There is no way to select which cart items to pay for — checkout always processes the entire cart.

## 2. Goals

1. "Buy Now" redirects directly to the checkout/payment method screen (skipping the cart page)
2. Users can select which cart items to pay for via checkboxes
3. Selection state persists across sessions (stored in localStorage keyed by userId)
4. On payment failure: selected items remain in cart, order created as CANCELLED
5. On payment success: only selected items removed from cart, order created normally
6. Cancelled orders visible in user's order history

## 3. Architecture

### 3.1 Backend Changes (CartService)

**CartController.java** — Add new endpoint:
```
POST /api/cart/checkout/partial
Body: { "itemIds": [Long, ...] }
```

**CartService.java** — Add new method `partialCheckout(List<Long> itemIds, Long userId)`:
- Validates only the specified items
- Creates CheckoutResponse with only those items
- Returns same response shape as full checkout
- Throws if any item doesn't belong to user's cart

**CartItemRepository.java** — Add methods:
```java
void deleteAllByIdInAndCartId(List<Long> itemIds, Long cartId);
List<CartItem> findAllByIdInAndCartId(List<Long> itemIds, Long cartId);
```

**CartController.java** — Add bulk delete endpoint:
```
DELETE /api/cart/items/bulk
Body: { "itemIds": [Long, ...] }
```

### 3.2 Frontend Changes

#### New: `frontend/src/hooks/useCartSelection.ts`
- Manages persistent selection state in localStorage
- Key format: `d4c-cart-selection-{userId}`
- Exports: `selectedIds`, `setSelectedIds`, `toggleItem`, `selectAll`, `deselectAll`, `isAllSelected`, `isSomeSelected`
- Auto-prunes stale IDs when cart items change
- Defaults all items to selected on first visit or when new items appear

#### Modified: `frontend/src/pages/CartPage.tsx`
- Add checkbox per cart item row
- Add "Select All" / "Deselect All" buttons
- "Checkout" button only enabled when at least one item selected
- Checkout navigates to `/checkout?selectedIds=id1,id2,...`
- Order summary shows only selected items' totals

#### Modified: `frontend/src/pages/ProductDetail.tsx`
- "Buy Now" onSuccess: navigate to `/checkout?buyNowItemId={cartItemId}` instead of `/cart`
- The cartItemId comes from the addItemToCart mutation response

#### Modified: `frontend/src/pages/CheckoutPage.tsx`
- On load: reads URL params `buyNowItemId` or `selectedIds`
- If `buyNowItemId`: sets selection to only that item
- If `selectedIds`: uses those IDs
- If neither: falls back to all items selected (current behavior)
- `handleConfirm`: calls partial checkout API with selected item IDs
- On success: removes only selected items from cart via `deleteAllByIdInAndCartId`
- On failure: items remain in cart, order created as CANCELLED

#### Modified: `frontend/src/services/cartApi.ts`
- Add `partialCheckout(itemIds: number[])` → `POST /api/cart/checkout/partial`
- Add `removeCartItemsBulk(itemIds: number[])` → `DELETE /api/cart/items/bulk`

#### Modified: `frontend/src/hooks/useCart.ts`
- Add `usePartialCheckout()` mutation
- Add `useRemoveCartItems()` mutation

### 3.3 Data Flow

```
Buy Now:
  ProductDetail → POST /api/cart/items → navigate(/checkout?buyNowItemId=X)
  → CheckoutPage filters to item X
  → User selects payment method → POST /api/cart/checkout/partial { itemIds: [X] }
  → Stock deducted → POST /api/orders → If success: DELETE item X from cart
  → If QR: POST /api/payments → /payment/{id}
  → If CASH: /orders/{id}
  → If failure: order CANCELLED, item X stays in cart

Cart checkout:
  CartPage → user selects items → navigate(/checkout?selectedIds=A,B)
  → CheckoutPage filters to items A,B
  → Same flow as above with multiple itemIds
```

### 3.4 Error Handling

| Scenario | Behavior |
|----------|----------|
| Cart item not found / doesn't belong to user | Checkout shows error toast, redirects to /cart |
| Payment fails | Order CANCELLED, selected items stay in cart, user sees order in history |
| Stock deduction fails | Rollback stock, cancel order, show error, redirect to /cart |
| Cart item removed between selection and checkout | Prune stale IDs, show warning, proceed or redirect if none left |
| User navigates away during QR payment | Payment cleanup via sendBeacon (existing) |

### 3.5 Security

- Backend validates that all itemIds in partial checkout belong to the authenticated user's cart
- URL params are not trusted — the backend is the source of truth for item ownership
- Selection state in localStorage is client-side only; backend always validates

## 4. Implementation Order

1. CartService: add partialCheckout endpoint + repository method
2. Frontend: add useCartSelection hook
3. Frontend: modify CartPage with checkboxes + select all/deselect all
4. Frontend: modify ProductDetail "Buy Now" navigation
5. Frontend: modify CheckoutPage to handle partial checkout
6. Frontend: add cartApi + useCart hooks for partial operations
7. Test full flow: Buy Now, cart selection, payment success, payment failure

## 5. Notes

- CartItem entity does NOT need an `isBuyNow` field — selection is purely client-side
- The partial checkout endpoint is backward compatible — full checkout remains unchanged
- Cancelled orders are already supported by OrderService; no changes needed there
- localStorage persists across browser sessions; selection survives logout/login since it's keyed by userId

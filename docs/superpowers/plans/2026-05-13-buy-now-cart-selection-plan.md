# Buy Now + Cart Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable "Buy Now" to bypass cart and go directly to checkout for a single item, and add persistent cart item selection so users choose which items to pay for.

**Architecture:** Backend adds partial checkout endpoint to CartService. Frontend adds a `useCartSelection` hook for persistent localStorage-based selection, modifies CartPage with checkboxes, modifies ProductDetail "Buy Now" navigation, and modifies CheckoutPage to handle partial checkout flows.

**Tech Stack:** Java/Spring Boot (CartService), React + TypeScript + Zustand + TanStack Query (frontend)

---

### Task 1: CartService — Add partial checkout endpoint

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/repository/CartItemRepository.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/controller/CartController.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutRequest.java` (create)

- [ ] **Step 1: Create `CheckoutRequest.java` DTO**

Create `CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutRequest.java`:

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
public class CheckoutRequest {
    private List<Long> itemIds;
}
```

- [ ] **Step 2: Add repository methods to `CartItemRepository.java`**

Read `CartService/src/main/java/iuh/fit/CartService/repository/CartItemRepository.java`, then add:

```java
List<CartItem> findAllByIdInAndCartId(List<Long> itemIds, Long cartId);
void deleteAllByIdInAndCartId(List<Long> itemIds, Long cartId);
```

- [ ] **Step 3: Add `partialCheckout` method to `CartService.java`**

Add this method to `CartService.java`:

```java
@Transactional
public CheckoutResponse partialCheckout(Long userId, List<Long> itemIds) {
    Cart cart = cartRepository.findByUserId(userId)
            .orElseThrow(() -> new RuntimeException("Cart not found"));

    List<CartItem> items = cartItemRepository.findAllByIdInAndCartId(itemIds, cart.getId());
    if (items.isEmpty()) {
        throw new RuntimeException("No valid items found in cart");
    }

    if (items.size() != itemIds.size()) {
        throw new RuntimeException("Some items do not belong to your cart");
    }

    List<String> validationErrors = new ArrayList<>();
    for (CartItem item : items) {
        try {
            ProductDto product = productServiceClient.getProductById(item.getProductId());
            if (product == null) {
                validationErrors.add("Sản phẩm '" + item.getProductName() + "' không tồn tại");
                continue;
            }
            if ("INACTIVE".equalsIgnoreCase(product.getStatus())) {
                validationErrors.add("Sản phẩm '" + product.getName() + "' không còn hoạt động");
                continue;
            }
            VariantDto variant = product.getVariants().stream()
                    .filter(v -> v.getId().equals(item.getVariantId()))
                    .findFirst()
                    .orElse(null);
            if (variant == null) {
                validationErrors.add("Variant '" + item.getVariantId() + "' không tồn tại");
                continue;
            }
            if (variant.getQuantity() < item.getQuantity()) {
                validationErrors.add("Sản phẩm '" + item.getProductName()
                        + "' (" + item.getColor() + ", " + item.getSize()
                        + ") chỉ còn " + variant.getQuantity()
                        + ", bạn cần " + item.getQuantity());
            }
        } catch (Exception e) {
            validationErrors.add("Không thể kiểm tra tồn kho sản phẩm '" + item.getProductName() + "'");
        }
    }

    if (!validationErrors.isEmpty()) {
        throw new RuntimeException("Thanh toán thất bại:\n" + String.join("\n", validationErrors));
    }

    String orderId = "ORD-" + System.currentTimeMillis() + "-" + userId;

    List<CheckoutResponse.CheckoutItem> checkoutItems = items.stream()
            .map(item -> CheckoutResponse.CheckoutItem.builder()
                    .variantId(item.getVariantId())
                    .productId(item.getProductId())
                    .productName(item.getProductName())
                    .color(item.getColor())
                    .size(item.getSize())
                    .price(item.getPrice())
                    .quantity(item.getQuantity())
                    .snapshot(CheckoutResponse.Snapshot.builder()
                            .priceAtCheckout(item.getPrice())
                            .productName(item.getProductName())
                            .variantSku(item.getSku())
                            .build())
                    .build())
            .collect(Collectors.toList());

    BigDecimal totalAmount = checkoutItems.stream()
            .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    return CheckoutResponse.builder()
            .orderId(orderId)
            .status("PENDING")
            .items(checkoutItems)
            .totalAmount(totalAmount)
            .build();
}
```

- [ ] **Step 4: Add `removeItemsBulk` method to `CartService.java`**

Add this method:

```java
@Transactional
public CartResponse removeItemsBulk(Long userId, List<Long> itemIds) {
    Cart cart = cartRepository.findByUserId(userId)
            .orElseThrow(() -> new RuntimeException("Cart not found"));

    cartItemRepository.deleteAllByIdInAndCartId(itemIds, cart.getId());
    invalidateCache(userId);
    return buildCartResponse(cart);
}
```

- [ ] **Step 5: Add endpoints to `CartController.java`**

Add these two endpoints to `CartController.java`:

```java
@PostMapping("/checkout/partial")
@Operation(summary = "Partial checkout - create order draft for selected items", description = "Create order with PENDING status for specific cart items only.")
public ResponseEntity<CheckoutResponse> partialCheckout(
        Authentication authentication,
        @Valid @RequestBody CheckoutRequest request) {
    Long userId = extractUserId(authentication);
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(cartService.partialCheckout(userId, request.getItemIds()));
}

@DeleteMapping("/items/bulk")
@Operation(summary = "Remove multiple items from cart", description = "Remove specified items from cart.")
public ResponseEntity<CartResponse> removeItemsBulk(
        Authentication authentication,
        @Valid @RequestBody CheckoutRequest request) {
    Long userId = extractUserId(authentication);
    return ResponseEntity.ok(cartService.removeItemsBulk(userId, request.getItemIds()));
}
```

- [ ] **Step 6: Build CartService to verify compilation**

Run from `CartService/`:
```bash
./mvnw compile
```
Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutRequest.java
git add CartService/src/main/java/iuh/fit/CartService/repository/CartItemRepository.java
git add CartService/src/main/java/iuh/fit/CartService/service/CartService.java
git add CartService/src/main/java/iuh/fit/CartService/controller/CartController.java
git commit -m "feat(CartService): add partial checkout and bulk remove endpoints"
```

---

### Task 2: Frontend — Add cart API functions and hooks

**Files:**
- Modify: `frontend/src/services/cartApi.ts`
- Modify: `frontend/src/hooks/useCart.ts`

- [ ] **Step 1: Add `partialCheckout` and `removeCartItemsBulk` to `cartApi.ts`**

Read `frontend/src/services/cartApi.ts`, then add these exports:

```typescript
export interface CheckoutRequest {
  itemIds: number[];
}

export const partialCheckout = (payload: CheckoutRequest) =>
  axiosInstance.post<CheckoutResponse>("/api/cart/checkout/partial", payload).then((res) => res.data);

export const removeCartItemsBulk = (payload: CheckoutRequest) =>
  axiosInstance.delete<Cart>("/api/cart/items/bulk", { data: payload }).then((res) => res.data);
```

- [ ] **Step 2: Add `usePartialCheckout` and `useRemoveCartItemsBulk` hooks to `useCart.ts`**

Read `frontend/src/hooks/useCart.ts`, then add these imports and hooks:

```typescript
import {
  partialCheckout,
  removeCartItemsBulk,
  type CheckoutRequest,
} from "@/src/services/cartApi";

// ... existing hooks ...

export function usePartialCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutRequest) => partialCheckout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Checkout thất bại";
        toast.error(msg);
      } else {
        toast.error("Checkout thất bại");
      }
    },
  });
}

export function useRemoveCartItemsBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CheckoutRequest) => removeCartItemsBulk(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Không thể xóa sản phẩm";
        toast.error(msg);
      } else {
        toast.error("Không thể xóa sản phẩm");
      }
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/cartApi.ts
git add frontend/src/hooks/useCart.ts
git commit -m "feat(frontend): add partial checkout and bulk remove API hooks"
```

---

### Task 3: Frontend — Create `useCartSelection` hook

**Files:**
- Create: `frontend/src/hooks/useCartSelection.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/src/hooks/useCartSelection.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/src/store";

const STORAGE_KEY = "d4c-cart-selection";

function getStorageKey(userId: number): string {
  return `${STORAGE_KEY}-${userId}`;
}

function loadSelectedIds(userId: number | undefined): number[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSelectedIds(userId: number | undefined, ids: number[]) {
  if (!userId) return;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(ids));
}

export function useCartSelection(cartItemIds: number[]) {
  const { user } = useAuth();
  const userId = user?.id;

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const stored = loadSelectedIds(userId);
    // Filter out stale IDs that are no longer in the cart
    return stored.filter((id) => cartItemIds.includes(id));
  });

  // When cart items change, sync selection and persist
  useEffect(() => {
    if (cartItemIds.length === 0) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds((prev) => {
      // Keep only IDs that still exist in cart
      let synced = prev.filter((id) => cartItemIds.includes(id));

      // If nothing was selected (or all were stale), select all items
      if (synced.length === 0) {
        synced = [...cartItemIds];
      }

      // If there are new items not in selection, add them (default to selected)
      const newItems = cartItemIds.filter((id) => !synced.includes(id));
      if (newItems.length > 0) {
        synced = [...synced, ...newItems];
      }

      saveSelectedIds(userId, synced);
      return synced;
    });
  }, [cartItemIds, userId]);

  const toggleItem = useCallback(
    (itemId: number) => {
      setSelectedIds((prev) => {
        const next = prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];
        saveSelectedIds(userId, next);
        return next;
      });
    },
    [userId],
  );

  const selectAll = useCallback(() => {
    const all = [...cartItemIds];
    setSelectedIds(all);
    saveSelectedIds(userId, all);
  }, [cartItemIds, userId]);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
    saveSelectedIds(userId, []);
  }, [userId]);

  const isAllSelected = cartItemIds.length > 0 && selectedIds.length === cartItemIds.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < cartItemIds.length;

  return {
    selectedIds,
    setSelectedIds: (ids: number[]) => {
      setSelectedIds(ids);
      saveSelectedIds(userId, ids);
    },
    toggleItem,
    selectAll,
    deselectAll,
    isAllSelected,
    isSomeSelected,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useCartSelection.ts
git commit -m "feat(frontend): add useCartSelection hook with localStorage persistence"
```

---

### Task 4: Frontend — Modify CartPage with checkboxes

**Files:**
- Modify: `frontend/src/pages/CartPage.tsx`

- [ ] **Step 1: Add imports and selection hook**

At the top of `CartPage.tsx`, add the `Checkbox` import and `useCartSelection` import:

```typescript
import { Checkbox } from "@/components/ui/checkbox";
import { useCartSelection } from "@/src/hooks/useCartSelection";
```

- [ ] **Step 2: Initialize selection and update checkout handler**

After the existing hook declarations (`const clearMutation = useClearCart();`), add:

```typescript
const cartItemIds = cart.items.map((item) => item.id);
const {
  selectedIds,
  toggleItem,
  selectAll,
  deselectAll,
  isAllSelected,
  isSomeSelected,
} = useCartSelection(cartItemIds);

const selectedItems = cart.items.filter((item) => selectedIds.includes(item.id));
const selectedTotal = selectedItems.reduce(
  (sum, item) => sum + item.subtotal,
  0,
);
const selectedItemCount = selectedItems.reduce(
  (sum, item) => sum + item.quantity,
  0,
);
```

- [ ] **Step 3: Update `handleCheckout` to pass selected IDs**

Replace the existing `handleCheckout` function:

```typescript
const handleCheckout = () => {
  if (selectedIds.length === 0) return;
  const idsParam = selectedIds.join(",");
  navigate(`/checkout?selectedIds=${idsParam}`);
};
```

- [ ] **Step 4: Add Select All / Deselect All buttons**

In the header section (after the "Xóa giỏ hàng" button div, around line 148-168), add selection controls. Replace the existing header `div` block:

```tsx
<div className="mb-8 flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold">Giỏ hàng</h1>
    <p className="text-sm text-muted-foreground mt-1">
      {cart.totalItems} sản phẩm
    </p>
  </div>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" asChild>
      <Link to="/products">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Tiếp tục mua sắm
      </Link>
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={isAllSelected ? deselectAll : selectAll}
    >
      {isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
    </Button>
    <Button
      variant="destructive"
      size="sm"
      onClick={() => clearMutation.mutate()}
      disabled={clearMutation.isPending}
    >
      {clearMutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="mr-2 h-4 w-4" />
      )}
      Xóa giỏ hàng
    </Button>
  </div>
</div>
```

- [ ] **Step 5: Add checkbox to each cart item row**

In the cart item `div` (the one with `className="flex gap-4 rounded-lg border p-4..."`), add a checkbox at the start. Modify the item row:

```tsx
{cart.items.map((item) => (
  <div
    key={item.id}
    className="flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30"
  >
    <div className="flex items-center">
      <Checkbox
        checked={selectedIds.includes(item.id)}
        onCheckedChange={() => toggleItem(item.id)}
      />
    </div>
    <Link to={`/products/${item.productId}`} className="flex h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
      {/* ... existing image/content ... */}
    </Link>
    {/* ... rest of item content unchanged ... */}
  </div>
))}
```

The checkbox `div` goes right after the opening of the mapped `div`, before the `<Link>` for the image.

- [ ] **Step 6: Update order summary to show only selected items**

Replace the entire summary sidebar (`<div className="lg:col-span-1">` block):

```tsx
<div className="lg:col-span-1">
  <div className="sticky top-24 rounded-lg border p-6 space-y-4">
    <h2 className="text-lg font-semibold">Tổng đơn hàng</h2>
    <Separator />

    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Tạm tính ({selectedItemCount} sản phẩm)</span>
        <span>{selectedTotal.toLocaleString("vi-VN")}₫</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Phí vận chuyển</span>
        <span className="text-green-600">Miễn phí</span>
      </div>
    </div>

    <Separator />

    <div className="flex justify-between text-lg font-bold">
      <span>Tổng cộng</span>
      <span className="tabular-nums">
        {selectedTotal.toLocaleString("vi-VN")}₫
      </span>
    </div>

    <Button
      className="w-full"
      size="lg"
      onClick={handleCheckout}
      disabled={selectedIds.length === 0}
    >
      Thanh toán
    </Button>

    {selectedIds.length === 0 && (
      <p className="text-xs text-destructive text-center">
        Vui lòng chọn ít nhất một sản phẩm để thanh toán.
      </p>
    )}

    <p className="text-xs text-muted-foreground text-center">
      Giá đã bao gồm VAT (nếu có).
    </p>
  </div>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/CartPage.tsx
git commit -m "feat(frontend): add cart item selection with checkboxes and persistent state"
```

---

### Task 5: Frontend — Modify ProductDetail "Buy Now" navigation

**Files:**
- Modify: `frontend/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Update "Buy Now" to navigate to checkout with cart item ID**

The "Buy Now" button's `onSuccess` callback currently navigates to `/cart`. Change it to navigate to `/checkout` with the `buyNowItemId` param.

The `addToCart` mutation returns the updated cart. We need the ID of the newly added item. Since the mutation returns the full cart response, we can get the item that matches the variant we just added.

Replace the "Buy Now" button's `onClick` handler (lines 327-346):

```tsx
<Button
  variant="outline"
  size="lg"
  disabled={!canBuy || addToCart.isPending}
  onClick={() => {
    if (!selectedVariant) return;
    if (!isAuthenticated) {
      toast.info("Vui lòng đăng nhập để mua hàng");
      navigate("/signin");
      return;
    }
    addToCart.mutate(
      {
        productId,
        variantId: selectedVariant.id!,
        quantity: purchaseQty,
      },
      {
        onSuccess: (cart) => {
          setPurchaseQty(1);
          // Find the cart item that matches the variant we just added
          const addedItem = cart.items.find(
            (item) => item.variantId === selectedVariant.id,
          );
          if (addedItem) {
            navigate(`/checkout?buyNowItemId=${addedItem.id}`);
          } else {
            navigate("/checkout");
          }
        },
      },
    );
  }}
>
  Mua ngay
</Button>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ProductDetail.tsx
git commit -m "feat(frontend): redirect Buy Now to checkout with buyNowItemId param"
```

---

### Task 6: Frontend — Modify CheckoutPage for partial checkout

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx`

- [ ] **Step 1: Add imports**

Add these imports at the top:

```typescript
import { useSearchParams } from "react-router-dom";
import {
  usePartialCheckout,
  useRemoveCartItemsBulk,
} from "@/src/hooks/useCart";
import type { CheckoutRequest } from "@/src/services/cartApi";
```

- [ ] **Step 2: Read URL params and filter cart items**

After the existing hook declarations, add:

```typescript
const [searchParams] = useSearchParams();
const buyNowItemId = searchParams.get("buyNowItemId");
const selectedIdsParam = searchParams.get("selectedIds");

// Determine which items to show/process
const filteredItems = useMemo(() => {
  if (!cart) return [];

  if (buyNowItemId) {
    const id = Number(buyNowItemId);
    return cart.items.filter((item) => item.id === id);
  }

  if (selectedIdsParam) {
    const ids = selectedIdsParam.split(",").map(Number);
    return cart.items.filter((item) => ids.includes(item.id));
  }

  return cart.items;
}, [cart, buyNowItemId, selectedIdsParam]);

const filteredTotal = filteredItems.reduce(
  (sum, item) => sum + item.subtotal,
  0,
);

const itemIdsForCheckout = filteredItems.map((item) => item.id);
```

Add `useMemo` to the imports from React.

- [ ] **Step 3: Replace checkout mutation and update `handleConfirm`**

Replace `checkoutMutation` with `partialCheckoutMutation`:

```typescript
const partialCheckoutMutation = usePartialCheckout();
const removeItemsBulkMutation = useRemoveCartItemsBulk();
```

Replace the entire `handleConfirm` function:

```typescript
const handleConfirm = async () => {
  const deductedItems: { variantId: string; quantity: number }[] = [];
  let orderCreated = false;
  let createdOrderId: number | null = null;

  if (!user || !user.email) return;
  if (itemIdsForCheckout.length === 0) return;

  try {
    const checkoutData = await partialCheckoutMutation.mutateAsync({
      itemIds: itemIdsForCheckout,
    });

    for (const item of checkoutData.items) {
      try {
        await deductStock(item.variantId, item.quantity);
        deductedItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
        });
      } catch (deductError) {
        if (isAxiosError(deductError)) {
          const msg =
            deductError.response?.data?.message || "Không đủ tồn kho";
          toast.error(msg);
        } else {
          toast.error("Không đủ tồn kho");
        }
        return;
      }
    }

    const order = await createOrderFromCheckoutMutation.mutateAsync({
      orderId: checkoutData.orderId,
      items: checkoutData.items,
      totalAmount: checkoutData.totalAmount,
      paymentMethod: method,
      email: user.email,
    });
    orderCreated = true;
    createdOrderId = order.id;

    // Remove only the checked-out items from cart
    await removeItemsBulkMutation.mutateAsync({
      itemIds: itemIdsForCheckout,
    });

    if (method === "QR") {
      try {
        const payment = await createPaymentMutation.mutateAsync({
          orderId: order.id,
          checkoutOrderId: order.checkoutOrderId,
          amount: checkoutData.totalAmount,
          method: "QR",
        });
        navigate(`/payment/${payment.paymentId}`);
      } catch (paymentError) {
        for (const item of deductedItems) {
          await restoreStock(item.variantId, item.quantity);
        }
        await cancelOrderMutation.mutateAsync(order.id);
        toast.error(
          "Tạo thanh toán thất bại, đơn hàng đã được hủy và tồn kho đã hoàn",
        );
        return;
      }
    } else {
      toast.success(`Đơn hàng ${order.checkoutOrderId} đã được tạo!`);
      navigate(`/orders/${order.id}`);
    }
  } catch (error) {
    if (orderCreated && createdOrderId) {
      for (const item of deductedItems) {
        await restoreStock(item.variantId, item.quantity);
      }
      await cancelOrderMutation.mutateAsync(createdOrderId);
    }
    if (isAxiosError(error)) {
      const msg = error.response?.data?.message || "Thanh toán thất bại";
      toast.error(msg);
    } else {
      toast.error("Thanh toán thất bại, vui lòng thử lại");
    }
  }
};
```

- [ ] **Step 4: Update empty/error state to handle partial checkout**

Replace the empty cart error block:

```tsx
if (isError || !cart || cart.items.length === 0) {
  return (
    <main className="page-wrap px-4 py-20">
      <div className="mx-auto max-w-md text-center">
        <p className="text-lg text-muted-foreground">
          Giỏ hàng trống hoặc không thể tải
        </p>
        <Button
          variant="link"
          onClick={() => navigate("/cart")}
          className="mt-2"
        >
          Quay lại giỏ hàng
        </Button>
      </div>
    </main>
  );
}

// Additional check: if filtered items are empty (e.g., buyNowItemId not found)
if (filteredItems.length === 0) {
  return (
    <main className="page-wrap px-4 py-20">
      <div className="mx-auto max-w-md text-center">
        <p className="text-lg text-muted-foreground">
          Không tìm thấy sản phẩm được chọn
        </p>
        <Button
          variant="link"
          onClick={() => navigate("/cart")}
          className="mt-2"
        >
          Quay lại giỏ hàng
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Update order summary to show only filtered items**

Replace the order summary section (the right column `div` with items list):

```tsx
<div className="rounded-lg border p-6 space-y-4">
  <h2 className="text-lg font-semibold">Đơn hàng</h2>
  <Separator />
  <div className="space-y-2 max-h-48 overflow-y-auto">
    {filteredItems.map((item) => (
      <div key={item.id} className="flex justify-between text-sm">
        <span className="truncate mr-2">
          {item.productName} ({item.color}, {item.size}) x{item.quantity}
        </span>
        <span className="tabular-nums whitespace-nowrap">
          {item.subtotal.toLocaleString("vi-VN")}₫
        </span>
      </div>
    ))}
  </div>
  <Separator />
  <div className="flex justify-between font-bold">
    <span>Tổng cộng</span>
    <span className="tabular-nums">
      {filteredTotal.toLocaleString("vi-VN")}₫
    </span>
  </div>
  <Button
    className="w-full"
    size="lg"
    onClick={handleConfirm}
    disabled={createOrderFromCheckoutMutation.isPending || filteredItems.length === 0}
  >
    {createOrderFromCheckoutMutation.isPending ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang xử lý...
      </>
    ) : (
      "Xác nhận thanh toán"
    )}
  </Button>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/CheckoutPage.tsx
git commit -m "feat(frontend): modify CheckoutPage for partial checkout with URL params"
```

---

### Task 7: Verify full flow and clean up

- [ ] **Step 1: Run frontend lint**

```bash
cd frontend && npm run lint
```

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && npm run build
```

Expected: No errors

- [ ] **Step 3: Manual test checklist**

Test these flows:
1. **Buy Now flow**: Click "Mua ngay" on a product → redirected to checkout → only that item shown → select payment → confirm → item removed from cart on success
2. **Cart selection flow**: Go to cart → uncheck some items → click "Thanh toán" → only selected items shown at checkout → confirm → only selected items removed
3. **Select All / Deselect All**: Toggle buttons work correctly
4. **Persistence**: Select/deselect items, refresh page, selections remain
5. **Payment failure simulation**: If payment fails, items remain in cart with their selection state
6. **Empty selection**: Cart checkout button disabled when nothing selected

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from verification"
```

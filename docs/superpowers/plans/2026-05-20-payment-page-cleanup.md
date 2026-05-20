# PaymentPage Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up PaymentPage.tsx — fix infinite loop with `use-countdown-timer` library, use proper hooks instead of direct API calls, consolidate duplicate logic, and improve overall code quality.

**Architecture:** Single-file refactor. No new files created. Uses existing `paymentApi.ts`, `usePayment.ts`, `useUserOrders.ts` hooks. Adds `use-countdown-timer` dependency.

**Tech Stack:** React 19, TypeScript, TanStack Query, `use-countdown-timer`

---

## File Map

| File | Action | Task |
|---|---|---|
| `frontend/package.json` | Modify | Task 1: add `use-countdown-timer` |
| `frontend/src/pages/PaymentPage.tsx` | Rewrite | Tasks 1-5 |

---

### Task 1: Replace Custom useCountdown with `use-countdown-timer`

**Problem:** Custom `useCountdown` hook (lines 27-50) causes infinite loop because `onExpire` changes every render. Fixing it manually is unnecessary — a well-tested library exists.

**Install dependency:**
```bash
cd frontend && npm install use-countdown-timer
```

**Remove:** The entire `useCountdown` function (lines 27-50) and `formatTime` helper (lines 52-57).

**Replace with library usage inside the component:**
```typescript
import { useCountdownTimer } from "use-countdown-timer";

// Inside PaymentPage component, replace:
//   const remaining = useCountdown(payment?.expiresAt ?? null, handleExpire);
// with:
const { remaining, isExpired } = useCountdownTimer({
  expiresAt: payment?.expiresAt ?? undefined,
  onExpire: () => handleCancelPayment("expired"),
});
```

The library handles:
- Interval management
- Expired state tracking
- Cleanup on unmount
- No dependency array issues

- [ ] **Step 1: Install use-countdown-timer**

Run `cd frontend && npm install use-countdown-timer`.

- [ ] **Step 2: Remove custom useCountdown and formatTime**

Delete lines 27-57 (both functions).

- [ ] **Step 3: Add library import and usage**

Add `import { useCountdownTimer } from "use-countdown-timer";` at the top. Inside the component, add the `useCountdownTimer` call. Replace `remaining > 0` checks with `!isExpired && remaining > 0`.

- [ ] **Step 4: Verify build passes**

Run `cd frontend && npm run build`. Expected: no errors.

---

### Task 2: Use `useCancelOrder` Hook Instead of Direct API Call

**Problem:** Line 15 imports `cancelOrder` directly from `orderApi.ts` and calls it without TanStack Query integration (no cache invalidation, no loading state, no error handling).

**Current:**
```typescript
import { cancelOrder } from "@/src/services/orderApi";
// ...
await cancelOrder(order.id);
```

**The hook already exists** at `useUserOrders.ts:62-73`:
```typescript
export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userOrderKeys.lists() });
    },
    onError: (error) => {
      console.error("Failed to cancel order:", error);
      toast.error("Failed to cancel order. Please try again.");
    },
  });
}
```

**Replace with:**
```typescript
import { useCancelOrder } from "@/src/hooks/useUserOrders";

// Inside component:
const cancelOrderMutation = useCancelOrder();

// In handleCancelPayment:
await cancelOrderMutation.mutateAsync(order.id);
```

- [ ] **Step 1: Change import**

Replace `import { cancelOrder } from "@/src/services/orderApi";` with `import { useCancelOrder } from "@/src/hooks/useUserOrders";`.

- [ ] **Step 2: Add hook call**

Add `const cancelOrderMutation = useCancelOrder();` alongside other hook calls.

- [ ] **Step 3: Update call sites**

Replace `await cancelOrder(order.id)` with `await cancelOrderMutation.mutateAsync(order.id)`.

---

### Task 3: Add `buildCancelPaymentUrl` to paymentApi and Remove Dangerous Cleanup Effect

**Problem 1:** Lines 132-157 use raw `fetch()` and `navigator.sendBeacon()` with hardcoded `VITE_API_BASE_URL`.

**Problem 2 (Critical):** The cleanup effect at lines 132-144 fires on **every component unmount**, including React StrictMode double-mount in dev. This means navigating TO the payment page immediately cancels the payment before the user sees the QR code.

**Root cause of immediate cancel:**
```typescript
useEffect(() => {
  return () => {
    // This fires on EVERY unmount — StrictMode double-mount, route transitions, etc.
    if (!paymentCompletedRef.current && paymentId) {
      fetch(`${VITE_API_BASE_URL}/api/payments/${pid}/cancel`, ...);
    }
  };
}, []);
```

In StrictMode: mount → effect runs → **unmount (cleanup fires → CANCELS PAYMENT)** → mount again.

**Step 3a: Create `buildCancelPaymentUrl` in paymentApi.ts**

Add to `frontend/src/services/paymentApi.ts` (after the existing exports):

```typescript
export const buildCancelPaymentUrl = (paymentId: number): string => {
  const base = axiosInstance.defaults.baseURL ?? import.meta.env.VITE_API_BASE_URL;
  return `${base}/api/payments/${paymentId}/cancel`;
};
```

- [ ] **Step 3a.1: Add buildCancelPaymentUrl to paymentApi.ts**

Add the function shown above to `paymentApi.ts`.

**Step 3b: Remove the cleanup effect, keep only `beforeunload`**

**Delete lines 132-144 entirely** (the cleanup useEffect). Replace lines 146-157 with:

```typescript
import { buildCancelPaymentUrl } from "@/src/services/paymentApi";

// Only cancel on actual tab/window close — NOT on component unmount
// The previous cleanup effect caused immediate cancellation on React StrictMode double-mount
useEffect(() => {
  const handler = () => {
    if (!paymentCompletedRef.current && paymentId) {
      const url = buildCancelPaymentUrl(parseInt(paymentId, 10));
      navigator.sendBeacon(url);
    }
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, []);
```

Key changes:
- **Remove the cleanup effect entirely** — it was cancelling payments on every unmount (StrictMode, route transitions, etc.)
- Keep only `beforeunload` — fires when user actually closes the tab or leaves the site
- URL built by `buildCancelPaymentUrl()` — single source of truth in the API layer
- No hardcoded `VITE_API_BASE_URL` in the component

- [ ] **Step 3b.1: Import buildCancelPaymentUrl and replace teardown effects**

Remove lines 132-157 (both useEffects). Replace with the single `useEffect` shown above. Add the import.

---

### Task 4: Consolidate Duplicate Cancel Logic

**Problem:** `handleExpire` and `handleCancel` do nearly the same thing. After Task 1, `handleExpire` is replaced by the library's `onExpire` callback. After Task 2, `cancelOrder` becomes `cancelOrderMutation.mutateAsync`.

**Replace both with:**
```typescript
const handleCancelPayment = async (reason: "user" | "expired") => {
  if (paymentCompletedRef.current || !paymentId) return;
  paymentCompletedRef.current = true;

  try {
    await cancelPaymentMutation.mutateAsync(parseInt(paymentId, 10));
    if (order) {
      await cancelOrderMutation.mutateAsync(order.id);
    }
    if (reason === "expired") {
      toast.info("Hết thời gian thanh toán, đơn hàng đã bị hủy");
    }
    navigate("/orders");
  } catch (error) {
    paymentCompletedRef.current = false;
    console.error("Failed to cancel payment:", error);
  }
};
```

- [ ] **Step 1: Create handleCancelPayment**

Remove the old `handleExpire` and `handleCancel` functions. Create `handleCancelPayment` as shown.

- [ ] **Step 2: Wire up call sites**

- `useCountdownTimer` `onExpire`: `() => handleCancelPayment("expired")`
- Cancel button: `onClick={() => handleCancelPayment("user")}`

---

### Task 5: Clean Up Remaining Issues

**5a. Memoize removeItemIds**

Lines 64-69: `removeItemIds` recalculated every render. Wrap in `useMemo`:
```typescript
const removeItemIds = useMemo(() => {
  if (!removeItemIdsParam) return [];
  return removeItemIdsParam
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
}, [removeItemIdsParam]);
```

**5b. Clean up payment status useEffect**

Replace lines 104-130 (two separate useEffects) with one clean effect:
```typescript
useEffect(() => {
  const status = paymentStatus?.status;
  if (!status || status === "PENDING" || status === "EXPIRED") return;

  paymentCompletedRef.current = true;

  if (status === "PAID") {
    if (removeItemIds.length > 0) {
      removeItemsBulkMutation.mutate({ itemIds: removeItemIds }, {
        onSettled: () => {
          toast.success("Thanh toán thành công!");
          navigate(`/orders/${payment?.orderId}`);
        },
      });
    } else {
      toast.success("Thanh toán thành công!");
      navigate(`/orders/${payment?.orderId}`);
    }
  } else if (status === "CANCELLED") {
    toast.info("Thanh toán đã bị hủy");
    navigate("/orders");
  }
}, [paymentStatus?.status]);
```

**5c. Fix paymentId! non-null assertion**

`handleCancelPayment` guards `if (!paymentId) return`, so `parseInt(paymentId, 10)` is safe. Remove `!`.

**5d. Remove unused imports**

After all changes, verify no unused imports remain. Expected imports:
```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useCountdownTimer } from "use-countdown-timer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentById, usePaymentStatus, useCancelPayment } from "@/src/hooks/usePayment";
import { useRemoveCartItemsBulk } from "@/src/hooks/useCart";
import { useUserOrderDetail, useCancelOrder } from "@/src/hooks/useUserOrders";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import { buildCancelPaymentUrl } from "@/src/services/paymentApi";
import { ArrowLeft, Loader2, QrCode, XCircle, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";
```

- [ ] **Step 1: Add useMemo and wrap removeItemIds**

- [ ] **Step 2: Replace payment status useEffects**

Remove lines 104-130. Replace with the single clean effect.

- [ ] **Step 3: Remove non-null assertion**

- [ ] **Step 4: Clean up imports**

Remove `cancelOrder` import. Add `buildCancelPaymentUrl` import. Verify all imports are used.

- [ ] **Step 5: Final build verification**

Run `cd frontend && npm run build`. Expected: zero errors, zero warnings.

---

## Final Expected Structure

After all tasks, PaymentPage.tsx should be ~220 lines (down from 320) with:

1. **Imports** — clean, all from hooks and API layer (no direct API calls, no axiosInstance in component)
2. **PaymentPage component:**
   - Params/hooks setup
   - `handleCancelPayment` — single cancel function using hooks
   - `handleCopyCode` — unchanged
   - `useCountdownTimer` — library-based countdown
   - Status polling useEffect — clean, mutation callbacks
   - `beforeunload` listener — only cancels on actual tab close (NOT on unmount)
   - Early returns (loading, error, completed)
   - JSX render

Additionally, `paymentApi.ts` gains one new export:
- `buildCancelPaymentUrl(paymentId: number): string` — centralizes cancel URL construction for `sendBeacon` usage

# QR Payment Countdown Fix - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the 5-minute QR payment countdown timer on the frontend with clock drift compensation, expired state rendering, and race condition protection.

**Architecture:** Extract countdown into a separate `CountdownTimer` component that only mounts when payment data is available. Add server time offset tracking via axios interceptor fallback. Handle EXPIRED/CANCELLED payment states with dedicated banners instead of the countdown.

**Tech Stack:** React 19, TypeScript, use-countdown-timer, axios, TanStack Query, shadcn/ui Alert, sonner toast

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/services/clockSync.ts` | **Create** | Module-level `clockOffset` tracking with safe fallback logic |
| `frontend/src/services/_axios.ts` | **Modify** | Add Date header extraction to existing response interceptor |
| `frontend/src/components/CountdownTimer.tsx` | **Create** | Countdown display component using `use-countdown-timer` |
| `frontend/src/pages/PaymentPage.tsx` | **Modify** | Remove old countdown logic, integrate CountdownTimer, add expired/cancelled banners |

---

### Task 1: Create clockSync service for server time offset

**Files:**
- Create: `frontend/src/services/clockSync.ts`

- [ ] **Step 1: Write the clockSync module**

This module provides a safe way to track server-client clock offset with fallback behavior.

```typescript
// frontend/src/services/clockSync.ts

/**
 * Tracks the offset between server time and client time.
 * Updated by axios response interceptor when Date header is present.
 * Defaults to 0 (client clock) if header is missing/stripped by proxy/CDN.
 * Capped at ±30 seconds for safety.
 */

let clockOffset = 0; // milliseconds: serverTime - clientTime

const MAX_OFFSET_MS = 30_000; // ±30 seconds cap

/**
 * Update clock offset from a response Date header.
 * Safe: never throws, silently ignores invalid headers.
 */
export function updateClockOffset(dateHeader: string | undefined | null): void {
  if (!dateHeader) return;

  try {
    const serverTime = new Date(dateHeader).getTime();
    if (isNaN(serverTime)) return;

    const clientTime = Date.now();
    let offset = serverTime - clientTime;

    // Clamp to ±30s to prevent extreme values from bad headers
    offset = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, offset));

    clockOffset = offset;
  } catch {
    // Silently ignore — fallback to client clock
  }
}

/**
 * Get current adjusted time: Date.now() + clockOffset.
 * Falls back to raw Date.now() if offset is 0 (no server time received yet).
 */
export function getAdjustedNow(): number {
  return Date.now() + clockOffset;
}

/**
 * Reset offset to 0. Useful for testing or cleanup.
 */
export function resetClockOffset(): void {
  clockOffset = 0;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit src/services/clockSync.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop
git add frontend/src/services/clockSync.ts
git commit -m "feat: add clockSync service for server time offset tracking"
```

---

### Task 2: Integrate Date header extraction into axios interceptor

**Files:**
- Modify: `frontend/src/services/_axios.ts:45-46`

- [ ] **Step 1: Add Date header extraction to the success path of the response interceptor**

The existing response interceptor has a success handler at line 46 that just returns the response. We add clock offset extraction there.

Current code at line 45-46:
```typescript
axiosInstance.interceptors.response.use(
  (response) => response,
```

Change to:
```typescript
axiosInstance.interceptors.response.use(
  (response) => {
    const dateHeader = response.headers["date"] ?? response.headers["Date"];
    if (dateHeader) {
      const { updateClockOffset } = require("./clockSync");
      updateClockOffset(dateHeader as string);
    }
    return response;
  },
```

This extracts the `Date` header from every successful response and updates the clock offset. The `require()` call avoids circular dependency issues since `_axios.ts` is imported by many modules.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop
git add frontend/src/services/_axios.ts
git commit -m "feat: extract Date header from axios responses for clock sync"
```

---

### Task 3: Create CountdownTimer component

**Files:**
- Create: `frontend/src/components/CountdownTimer.tsx`

- [ ] **Step 1: Write the CountdownTimer component**

```typescript
// frontend/src/components/CountdownTimer.tsx

import { useEffect } from "react";
import { useCountdownTimer } from "use-countdown-timer";
import { Clock } from "lucide-react";
import { getAdjustedNow } from "@/src/services/clockSync";

interface CountdownTimerProps {
  expiresAt: string;
  onExpire: () => void;
}

export default function CountdownTimer({
  expiresAt,
  onExpire,
}: CountdownTimerProps) {
  const timerMs = Math.max(0, new Date(expiresAt).getTime() - getAdjustedNow());

  const { countdown, start } = useCountdownTimer({
    timer: timerMs,
    autostart: false,
    onExpire,
  });

  // Start timer on mount — expiresAt is guaranteed by parent
  useEffect(() => {
    start();
  }, [start]);

  if (countdown <= 0) return null;

  const minutes = Math.floor(countdown / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((countdown % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 text-amber-600">
      <Clock className="h-4 w-4" />
      <span className="font-mono font-semibold text-lg">
        {minutes}:{seconds}
      </span>
      <span className="text-sm">còn lại để thanh toán</span>
    </div>
  );
}
```

**Key design decisions:**
- `autostart: false` + `useEffect` + `start()` — ensures the hook is fully initialized before the timer begins
- `getAdjustedNow()` uses server time offset, falls back to client clock if offset is 0
- `Math.max(0, ...)` prevents negative initial timer
- `if (countdown <= 0) return null` — hides component when expired, preventing negative display
- Parent controls `onExpire` callback stability

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop
git add frontend/src/components/CountdownTimer.tsx
git commit -m "feat: add CountdownTimer component with server time sync"
```

---

### Task 4: Update PaymentPage to use CountdownTimer and handle expired states

**Files:**
- Modify: `frontend/src/pages/PaymentPage.tsx`

- [ ] **Step 1: Update imports**

Current imports (lines 1-36):
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useBlocker,
} from "react-router-dom";
import { useCountdownTimer } from "use-countdown-timer";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePaymentById,
  usePaymentStatus,
  useCancelPayment,
} from "@/src/hooks/usePayment";
import { useRemoveCartItemsBulk } from "@/src/hooks/useCart";
import {
  useUserOrderDetail,
  useCancelOrder,
  userOrderKeys,
} from "@/src/hooks/useUserOrders";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import { buildCancelPaymentUrl } from "@/src/services/paymentApi";
import {
  ArrowLeft,
  Loader2,
  QrCode,
  XCircle,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
```

Replace with:
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useBlocker,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CountdownTimer from "@/src/components/CountdownTimer";
import {
  usePaymentById,
  usePaymentStatus,
  useCancelPayment,
} from "@/src/hooks/usePayment";
import { useRemoveCartItemsBulk } from "@/src/hooks/useCart";
import {
  useUserOrderDetail,
  useCancelOrder,
  userOrderKeys,
} from "@/src/hooks/useUserOrders";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import { buildCancelPaymentUrl } from "@/src/services/paymentApi";
import {
  ArrowLeft,
  Loader2,
  QrCode,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
```

Changes:
- Remove `useCountdownTimer` import
- Add `Alert, AlertDescription` from shadcn/ui
- Add `CountdownTimer` component import
- Remove `Clock` from lucide-react (used by CountdownTimer internally)
- Add `AlertTriangle` for expired banner icon

- [ ] **Step 2: Remove old countdown logic (lines 114-128)**

Current code (lines 114-128):
```typescript
  const timerMs = payment?.expiresAt
    ? Math.max(0, new Date(payment.expiresAt).getTime() - Date.now())
    : 0;
  const { countdown, start } = useCountdownTimer({
    timer: timerMs,
    autostart: false,
    onExpire: () => handleCancelPayment("expired"),
  });

  // Start countdown only after payment data is loaded
  useEffect(() => {
    if (payment && !paymentCompletedRef.current) {
      start();
    }
  }, [payment]);
```

Remove entirely. Replace with:
```typescript
  const handleExpire = useCallback(() => {
    handleCancelPayment("expired");
  }, [handleCancelPayment]);
```

This provides a stable callback for the CountdownTimer's `onExpire` prop.

- [ ] **Step 3: Replace countdown JSX with CountdownTimer and expired/cancelled banners (lines 285-297)**

Current code (lines 285-297):
```typescript
          {countdown > 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-semibold text-lg">
                {`${Math.floor(countdown / 60000)
                  .toString()
                  .padStart(2, "0")}:${Math.floor((countdown % 60000) / 1000)
                  .toString()
                  .padStart(2, "0")}`}
              </span>
              <span className="text-sm">còn lại để thanh toán</span>
            </div>
          )}
```

Replace with:
```typescript
          {payment.status === "EXPIRED" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Mã QR đã hết hạn. Vui lòng tạo đơn hàng mới.
              </AlertDescription>
            </Alert>
          )}

          {payment.status === "CANCELLED" && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Thanh toán đã bị hủy.
              </AlertDescription>
            </Alert>
          )}

          {payment.status === "PENDING" && (
            <CountdownTimer
              expiresAt={payment.expiresAt}
              onExpire={handleExpire}
            />
          )}
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run lint**

Run: `cd frontend && npm run lint`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop
git add frontend/src/pages/PaymentPage.tsx
git commit -m "feat: integrate CountdownTimer, add expired/cancelled banners to PaymentPage"
```

---

### Task 5: Verify backend idempotency for cancel endpoints

**Files:**
- Read: `PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java`
- Read: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`
- Read: `OrderService/src/main/java/com/iuh/fit/controller/OrderController.java`
- Read: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Check cancel payment endpoint idempotency**

Read the payment cancel endpoint and service method. Verify that calling cancel on an already-EXPIRED or already-CANCELLED payment does not throw an unhandled exception. If it returns a proper HTTP error (400/409) or is idempotent (no-op), the frontend is safe.

If the cancel endpoint throws an exception for already-cancelled payments, the frontend `handleCancelPayment` already has a try/catch that resets `paymentCompletedRef.current = false` on error, which could cause a retry loop. We need to verify this behavior.

- [ ] **Step 2: Check cancel order endpoint idempotency**

Same analysis for the order cancel endpoint.

- [ ] **Step 3: If either endpoint is NOT idempotent, add error handling in PaymentPage**

If the backend throws on double-cancel, update `handleCancelPayment` to catch the error and still proceed with navigation:

```typescript
  const handleCancelPayment = useCallback(
    async (reason: "user" | "expired", skipNavigate = false) => {
      if (paymentCompletedRef.current || !paymentId) return;
      paymentCompletedRef.current = true;

      try {
        await cancelPaymentMutation.mutateAsync(parseInt(paymentId, 10));
      } catch (error) {
        // Already expired/cancelled — proceed anyway
        console.error("Cancel payment error (may be idempotent):", error);
      }

      try {
        if (order) {
          await cancelOrderMutation.mutateAsync(order.id);
        }
      } catch (error) {
        console.error("Cancel order error (may be idempotent):", error);
      }

      if (reason === "expired") {
        toast.info("Hết thời gian thanh toán, đơn hàng đã bị hủy");
      }
      if (!skipNavigate) {
        navigate("/orders");
      }
    },
    [paymentId, order, cancelPaymentMutation, cancelOrderMutation, navigate],
  );
```

This ensures that even if the backend rejects a duplicate cancel, the user still gets the toast and navigation.

- [ ] **Step 4: Commit any changes**

```bash
cd C:\Users\Admin\Desktop\D4C_Clothing_Shop
git add frontend/src/pages/PaymentPage.tsx
git commit -m "fix: handle non-idempotent cancel endpoints gracefully"
```

(Only commit if changes were made in Step 3)

---

### Task 6: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full lint check**

Run: `cd frontend && npm run lint`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `cd frontend && npm run build`
Expected: Successful build

- [ ] **Step 4: Verify all changes are committed**

Run: `cd C:\Users\Admin\Desktop\D4C_Clothing_Shop && git status`
Expected: Clean working tree

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-----------------|------|
| Extract countdown to separate component | Task 3 |
| Only mount when payment data available | Task 4 (conditional render by status) |
| Server time offset via Date header | Task 1, Task 2 |
| Fallback if Date header missing | Task 1 (defaults to 0) |
| Offset capped at ±30s | Task 1 (MAX_OFFSET_MS) |
| No negative countdown values | Task 3 (Math.max + countdown <= 0 guard) |
| EXPIRED state shows banner | Task 4 |
| CANCELLED state shows banner | Task 4 |
| PENDING state shows countdown | Task 4 |
| Race condition prevention via ref | Task 4 (existing paymentCompletedRef) |
| Backend expiry guarantee (no FE changes) | Verified — already exists |
| F5 at timer=0 handled | Task 4 (status check before render) |
| Idempotent cancel handling | Task 5 |

## Placeholder Scan

No TBD, TODO, or incomplete sections found. All code blocks are complete.

## Type Consistency Check

- `CountdownTimerProps.expiresAt: string` matches `PaymentResponse.expiresAt: string` ✓
- `onExpire: () => void` matches `handleExpire` callback signature ✓
- `getAdjustedNow(): number` returns milliseconds, compatible with `useCountdownTimer.timer` ✓
- Alert component imports match existing shadcn/ui exports (`Alert`, `AlertDescription`) ✓

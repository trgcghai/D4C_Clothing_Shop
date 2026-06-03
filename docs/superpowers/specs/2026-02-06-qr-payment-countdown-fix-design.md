# QR Payment Countdown Fix - Design Spec

**Date:** 2026-02-06
**Author:** opencode
**Status:** Revised

## Problem

The QR payment page (`PaymentPage.tsx`) does not display the 5-minute countdown timer. The backend correctly sets `expiresAt = now + 5 minutes` and the `use-countdown-timer` library is installed, but the countdown never starts because:

1. `useCountdownTimer` is called during initial render when `payment` is null
2. `timerMs` evaluates to `0` (falsy fallback)
3. The library's reducer initializes `countdown: 0`
4. When `start()` is called after payment loads, the library checks `state.countdown !== 0` to set `canStart`
5. Since countdown is already `0`, `canStart` stays `false`, timer never runs

## Solution

Extract countdown into a separate component `CountdownTimer` that only mounts when `payment` data is available. Address three critical issues:

1. **Client clock drift** — use server time from response headers to offset `Date.now()`
2. **Browser close before expiry** — backend `PaymentExpiryJob` handles guaranteed expiry; FE countdown is UX-only
3. **F5 at timer=0 race** — check payment status before rendering countdown; if already EXPIRED/CANCELLED, show expired state instead

## Architecture

### Server Time Sync: `frontend/src/services/api.ts` (or existing axios instance)

- Extract `Date` header from API responses (server time)
- Calculate `clockOffset = serverTime - clientTime` on each response
- Store in a module-level variable or Zustand store
- Countdown uses `Date.now() + clockOffset` instead of raw `Date.now()`

### New Component: `frontend/src/components/CountdownTimer.tsx`

**Props:**

- `expiresAt: string` — ISO timestamp from payment response
- `onExpire: () => void` — callback fired when countdown reaches 0

**Behavior:**

- Calculates `timerMs = Math.max(0, new Date(expiresAt).getTime() - (Date.now() + clockOffset))` at render time
- Uses `useCountdownTimer({ timer: timerMs, autostart: true, onExpire })`
- `autostart: true` means timer begins immediately on mount — no stale zero issue
- Displays `MM:SS` with Clock icon, amber styling
- Hides when `countdown <= 0` (already expired or just expired)
- No negative values: `Math.max(0, ...)` guards the initial calculation; library's `TICK` logic decrements by fixed `interval` and stops at 0

**Race condition prevention:**

- The `onExpire` callback is a stable reference passed from parent
- Parent controls `paymentCompletedRef` — if expiry fires after manual cancel, the ref guard returns early
- If manual cancel fires after expiry, same ref guard prevents double API call

### Modified: `frontend/src/pages/PaymentPage.tsx`

**Changes:**

1. Remove `useCountdownTimer` import and all countdown-related state/logic
2. Remove `timerMs`, `{ countdown, start }`, and the `useEffect` that calls `start()`
3. Add `handleExpire` callback that wraps `handleCancelPayment("expired")` with ref guard
4. **Before rendering CountdownTimer, check `payment.status`:**
   - If `payment.status === "EXPIRED"` → show expired banner: "Mã QR đã hết hạn" with button to go back to orders
   - If `payment.status === "CANCELLED"` → show cancelled banner: "Thanh toán đã bị hủy" with button to go back to orders
   - If `payment.status === "PENDING"` → render `<CountdownTimer expiresAt={payment.expiresAt} onExpire={handleExpire} />`
5. The existing `usePaymentStatus` polling (every 3s) will update `paymentStatus` — on status change to EXPIRED/CANCELLED, the page re-renders and replaces CountdownTimer with the appropriate banner

**Expiry flow (FE countdown reaches 0):**

1. Countdown reaches 0 → `onExpire` fires → `handleExpire()`
2. `paymentCompletedRef` checked — if already set, return early (prevents double-cancel)
3. `paymentCompletedRef.current = true`
4. `cancelPaymentMutation.mutateAsync(paymentId)` → backend marks payment EXPIRED (idempotent — if already expired, returns safely)
5. `cancelOrderMutation.mutateAsync(order.id)` → backend marks order CANCELLED (idempotent — if already cancelled, returns safely)
6. Toast: "Hết thời gian thanh toán, đơn hàng đã bị hủy"
7. `navigate("/orders")`

**Backend guarantee (already exists, no changes needed):**

- `PaymentExpiryJob` runs every 60 seconds, marks PENDING payments past `expiresAt` as EXPIRED
- `PaymentExpiredEvent` published via outbox to RabbitMQ
- `OrderService` listens, sets order to CANCELLED, restocks inventory, sends cancellation email
- This works regardless of whether the browser is open — FE countdown is UX-only

## Race Conditions Addressed

| Scenario | Prevention |
| --- | --- |
| Expiry fires after user clicks cancel | `paymentCompletedRef` guard in `handleCancelPayment` |
| User clicks cancel after expiry fires | Same ref guard — first one wins |
| Payment status polling detects PAID during countdown | `paymentCompletedRef` set in status effect, blocks expiry |
| Component unmounts before expiry | `useCountdownTimer` cleanup clears interval |
| `expiresAt` already past when page loads | `Math.max(0, ...)` → timerMs = 0 → `onExpire` fires immediately |
| Negative countdown display | `countdown > 0` JSX guard + `Math.max(0, ...)` calculation |
| **Client clock drift** | Server `Date` header offset applied to `Date.now()` |
| **Browser closed before expiry** | Backend `PaymentExpiryJob` guarantees expiry regardless of FE |
| **F5 at timer=0** | Payment status checked before rendering CountdownTimer; if EXPIRED, show expired banner instead |
| **Double cancel on F5 at expiry boundary** | `cancelPaymentMutation` and `cancelOrderMutation` are idempotent; backend returns 400/409 for already-expired/cancelled, frontend catches and proceeds |

## Files Changed

- `frontend/src/components/CountdownTimer.tsx` — **new**
- `frontend/src/pages/PaymentPage.tsx` — **modified** (remove countdown logic, add CountdownTimer import and usage, add expired/cancelled state rendering)
- `frontend/src/services/api.ts` (or existing axios instance) — **modified** (add server time offset tracking)
# QR Payment Countdown Fix - Design Spec

**Date:** 2026-02-06
**Author:** opencode
**Status:** Approved

## Problem

The QR payment page (`PaymentPage.tsx`) does not display the 5-minute countdown timer. The backend correctly sets `expiresAt = now + 5 minutes` and the `use-countdown-timer` library is installed, but the countdown never starts because:

1. `useCountdownTimer` is called during initial render when `payment` is null
2. `timerMs` evaluates to `0` (falsy fallback)
3. The library's reducer initializes `countdown: 0`
4. When `start()` is called after payment loads, the library checks `state.countdown !== 0` to set `canStart`
5. Since countdown is already `0`, `canStart` stays `false`, timer never runs

## Solution

Extract countdown into a separate component `CountdownTimer` that only mounts when `payment` data is available, ensuring `expiresAt` is always defined at hook initialization time.

## Architecture

### New Component: `frontend/src/components/CountdownTimer.tsx`

**Props:**
- `expiresAt: string` — ISO timestamp from payment response
- `onExpire: () => void` — callback fired when countdown reaches 0

**Behavior:**
- Calculates `timerMs = Math.max(0, new Date(expiresAt).getTime() - Date.now())` at render time
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
3. Replace inline countdown JSX with `<CountdownTimer expiresAt={payment.expiresAt} onExpire={handleExpire} />`
4. Add `handleExpire` callback that wraps `handleCancelPayment("expired")` with ref guard

**Expiry flow:**
1. Countdown reaches 0 → `onExpire` fires → `handleExpire()`
2. `paymentCompletedRef` checked — if already set, return early (prevents double-cancel)
3. `paymentCompletedRef.current = true`
4. `cancelPaymentMutation.mutateAsync(paymentId)` → backend marks payment EXPIRED
5. `cancelOrderMutation.mutateAsync(order.id)` → backend marks order CANCELLED
6. Toast: "Hết thời gian thanh toán, đơn hàng đã bị hủy"
7. `navigate("/orders")`

## Race Conditions Addressed

| Scenario | Prevention |
|----------|-----------|
| Expiry fires after user clicks cancel | `paymentCompletedRef` guard in `handleCancelPayment` |
| User clicks cancel after expiry fires | Same ref guard — first one wins |
| Payment status polling detects PAID during countdown | `paymentCompletedRef` set in status effect, blocks expiry |
| Component unmounts before expiry | `useCountdownTimer` cleanup clears interval |
| `expiresAt` already past when page loads | `Math.max(0, ...)` → timerMs = 0 → `onExpire` fires immediately |
| Negative countdown display | `countdown > 0` JSX guard + `Math.max(0, ...)` calculation |

## Files Changed

- `frontend/src/components/CountdownTimer.tsx` — **new**
- `frontend/src/pages/PaymentPage.tsx` — **modified** (remove countdown logic, add CountdownTimer import and usage)

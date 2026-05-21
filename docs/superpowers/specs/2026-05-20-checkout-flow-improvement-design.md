# Checkout Flow Improvement Design

**Date:** 2026-05-20
**Status:** Draft
**Author:** opencode

## Overview

Fix critical gaps and migrate synchronous REST calls to event-driven communication in the checkout/payment flow across PaymentService, OrderService, ProductService, CartService, and NotificationService.

## Problems Addressed

| # | Gap | Severity |
|---|-----|----------|
| 1 | `ORDER_PAID` / `ORDER_CANCELLED` events never published; email handlers are stubs | High |
| 2 | Stock deducted by frontend before order creation (race condition, permanent stock loss on crash) | Critical |
| 3 | Cart clearing deferred to frontend polling; items remain if browser closes | Medium |
| 4 | No background job to expire pending payments and restore stock | High |
| 5 | Order status update in webhook is fire-and-forget (no retry) | High |
| 7 | Frontend bypasses gateway for payment cancellation | Medium |
| 8 | Payment webhook uses fuzzy amount matching (could accept wrong amounts) | High |

## Architecture

### New Exchanges

| Exchange | Type | Publisher | Consumers | Purpose |
|---|---|---|---|---|
| `email.exchange` | Topic | UserService, OrderService | NotificationService | Email notifications only (existing, unchanged) |
| `payment.exchange` | Topic | PaymentService | OrderService | Payment lifecycle events |
| `order.exchange` | Topic | OrderService | ProductService, CartService | Order lifecycle events |
| `cart.exchange` | Topic | CartService | (future) | Cart events (created for future use) |

### Events

| Exchange | Routing Key | Event Class | Publisher → Consumer | Trigger |
|---|---|---|---|---|
| `payment.exchange` | `payment.confirmed` | `PaymentConfirmedEvent` | PaymentService → OrderService | SePay webhook marks payment PAID |
| `payment.exchange` | `payment.expired` | `PaymentExpiredEvent` | PaymentService → OrderService | Scheduled job finds expired payments |
| `order.exchange` | `order.cancelled` | `OrderCancelledEvent` | OrderService → ProductService, CartService | Order cancelled (user, expiry, or payment failed) |
| `order.exchange` | `order.paid` | `OrderPaidEvent` | OrderService → CartService, NotificationService | Order marked PAID |
| `email.exchange` | `email.order.paid` | `OrderStatusEvent` | OrderService → NotificationService | Order marked PAID (activated) |
| `email.exchange` | `email.order.cancelled` | `OrderStatusEvent` | OrderService → NotificationService | Order cancelled (activated) |

## Component Changes

### PaymentService

1. **Add RabbitMQ** — dependency, `payment.exchange` config, message converter
2. **WebhookService** — after `markAsPaid()`, publish `PaymentConfirmedEvent` instead of calling `orderClient.updateOrderStatus()`
3. **Scheduled expiry job** — `@Scheduled(fixedRate = 60000)`:
   - Query `payments` where `status = PENDING` AND `expiryTime < now`
   - Update each to `EXPIRED`
   - Publish `PaymentExpiredEvent` per expired payment
4. **New endpoint** — `POST /api/payments/{id}/cancel` (replaces frontend direct URL bypass)
5. **Strict amount validation** — reject webhook if `receivedAmount < expectedAmount`
6. **Keep** `POST /api/public/orders/{orderId}/status` as reconciliation endpoint

### OrderService

1. **Add RabbitMQ** — dependency, `payment.exchange`, `order.exchange` config
2. **New consumers:**
   - `PaymentConfirmedEventConsumer` — consumes `payment.confirmed`, updates order to `PAID`, publishes `OrderPaidEvent` + `OrderStatusEvent` (email)
   - `PaymentExpiredEventConsumer` — consumes `payment.expired`, cancels order, publishes `OrderCancelledEvent` + `OrderStatusEvent` (email)
3. **Activate dead publishers** — call `publishOrderPaid()` and `publishOrderCancelled()` in `OrderEventPublisher`
4. **Stock deduction in createOrder** — call `ProductClient.deductStock()` synchronously before saving order; if fails, roll back
5. **OrderCancelledEvent payload** — `{orderId, userId, items: [{variantId, quantity}]}`

### ProductService

1. **Add RabbitMQ** — dependency, `order.exchange` config
2. **New consumer** — `OrderCancelledEventConsumer`: consumes `order.cancelled`, restores stock for each item
3. **Keep** existing `deduct-stock` and `restore-stock` REST endpoints (called by OrderService for deduction, fallback for restore)

### CartService

1. **Add RabbitMQ** — dependency, `order.exchange` config
2. **New consumer** — `OrderPaidEventConsumer`: consumes `order.paid`, removes items associated with the order

### NotificationService

1. **Implement `sendOrderPaidEmail()`** — was stub (just logging), now sends actual email using `order-created` template or dedicated paid template
2. **Implement `sendOrderCancelledEmail()`** — was stub, now sends actual email

### Frontend

1. **Remove** `deduct-stock` call from `CheckoutPage.tsx` (OrderService handles it)
2. **Remove** `restore-stock` call from checkout error handler
3. **Change** payment cancellation to `POST /api/payments/{id}/cancel` via Gateway
4. **Remove** `VITE_PAYMENT_SERVICE_URL` env var usage
5. **Keep** polling for payment status (UX), but cart clearing is server-side

## Error Handling & Resilience

| Scenario | Handling |
|---|---|
| PaymentConfirmedEvent — OrderService down | RabbitMQ DLQ retries automatically. Existing REST endpoint for manual reconciliation |
| OrderCancelledEvent — ProductService down | DLQ retries. Stock restoration is idempotent (safe to retry) |
| OrderPaidEvent — CartService down | DLQ retries. Stale cart items cleaned up on next validation |
| Stock deduction during order creation fails | Order creation rolls back (same transaction). Frontend receives error |
| Duplicate webhook | `webhook_logs` table prevents re-processing (transaction ID check) |
| Webhook amount mismatch | Strict validation: `receivedAmount < expectedAmount` → reject 400 |
| Expiry job races with late webhook | Webhook checks status; if EXPIRED, still honors payment (user paid late) |

## Implementation Phases

### Phase 1: Critical Fixes
- Move stock deduction into OrderService (sync REST during order creation)
- Add PaymentService expiry scheduled job
- Fix frontend cancellation to use Gateway
- Add strict amount validation in webhook
- Activate `ORDER_PAID` / `ORDER_CANCELLED` publishers on `email.exchange`

### Phase 2: Event Migration
- Create `payment.exchange`, `order.exchange`, `cart.exchange`
- Migrate PaymentService → OrderService to events (`payment.confirmed`, `payment.expired`)
- Migrate OrderService → ProductService to events (`order.cancelled`)
- Add CartService consumer for `order.paid`
- Implement email handler stubs in NotificationService

## New Flow (After Implementation)

```
Frontend → POST /api/orders → OrderService
  OrderService:
    1. Call ProductService.deductStock() (sync REST)
    2. Save order (PENDING_PAYMENT)
    3. Publish ORDER_CREATED (email.exchange)

Frontend → POST /api/payments → PaymentService
  PaymentService: creates payment, returns QR

SePay → POST /api/webhooks/sepay → PaymentService
  PaymentService:
    1. Verify HMAC, validate amount (strict)
    2. Mark payment PAID
    3. Publish PaymentConfirmedEvent (payment.exchange)

OrderService consumes PaymentConfirmedEvent:
  1. Update order to PAID
  2. Publish OrderPaidEvent (order.exchange)
  3. Publish OrderStatusEvent (email.exchange) → NotificationService sends email

CartService consumes OrderPaidEvent:
  1. Remove items for this order

ProductService consumes OrderCancelledEvent:
  1. Restore stock for each item

Scheduled job (PaymentService):
  1. Find expired payments
  2. Mark EXPIRED
  3. Publish PaymentExpiredEvent (payment.exchange)

OrderService consumes PaymentExpiredEvent:
  1. Cancel order
  2. Publish OrderCancelledEvent (order.exchange) → restores stock + sends email
```

# Checkout Flow Gaps Fix Design

**Date:** 2026-05-20
**Status:** Draft
**Author:** opencode

## Overview

Fix 9 critical and medium-severity gaps in the event-driven checkout/payment flow across OrderService, PaymentService, ProductService, CartService, and NotificationService.

## Gaps Summary

| # | Gap | Severity | Component |
|---|-----|----------|-----------|
| 1 | RabbitMQ queue bindings missing (payment.exchange → queues) | Critical | OrderService |
| 2 | Payment cancel does not cancel order or send email | High | PaymentService + OrderService |
| 3 | PaymentExpiryJob race with late webhook | High | PaymentService + OrderService |
| 4 | ProductService nack(requeue=false) loses failed messages | Medium | ProductService |
| 5 | OrderService consumers ack on missing order | Medium | OrderService |
| 6 | CartService uses raw Map instead of typed DTO | Low | CartService |
| 7 | NotificationService throws RuntimeException on email failure | Low | NotificationService |
| 8 | No DLQ on new RabbitMQ queues | High | OrderService, ProductService, CartService |
| 9 | PaymentExpiryJob no distributed lock | Medium | PaymentService |

## Architecture Changes

### Section 1: OrderService — Queue Bindings + DLQ

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventBindingConfig.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java`

**Changes:**
- Create `PaymentEventBindingConfig` with `@Bean` methods for:
  - `Binding` `payment.confirmed` → `payment.confirmed.queue`
  - `Binding` `payment.expired` → `payment.expired.queue`
- Add DLQ config to both queues: `x-dead-letter-exchange`, `x-dead-letter-routing-key`, `x-message-ttl=300000`
- Create DLQ exchange (`payment.dlx`) and DLQ queues (`payment.confirmed.dlq`, `payment.expired.dlq`)

### Section 2: PaymentService — Cancel Event

**Files:**
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentCancelledEvent.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`

**Changes:**
- Create `PaymentCancelledEvent` DTO with fields: `paymentId`, `orderId`, `checkoutOrderId`, `paymentCode`, `amount`, `cancelledAt`
- Add `PAYMENT_CANCELLED_ROUTING_KEY = "payment.cancelled"` to `RabbitMQConfig`
- In `PaymentService.cancelPayment()`, after successful cancel, publish `PaymentCancelledEvent` to `payment.exchange`

### Section 3: OrderService — Cancel Consumer + Expiry Race Fix

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentCancelledEventConsumer.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventBindingConfig.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java`

**Changes:**
- Create `PaymentCancelledEventConsumer` (same logic as `PaymentExpiredEventConsumer`):
  - Cancel order if `PENDING_PAYMENT`
  - Publish `OrderCancelledEvent` with item snapshots
  - Publish `OrderStatusEvent` for email
- Add binding for `payment.cancelled` → `payment.cancelled.queue`
- Add `payment.cancelled.queue` with DLQ config
- **Expiry race fix:** In `PaymentExpiryJob`, after marking payments EXPIRED, re-fetch each payment and check status. If PAID, skip publishing event.
- **Idempotency fix:** In both `PaymentExpiredEventConsumer` and `PaymentCancelledEventConsumer`, add check: if order status is `PAID`, log warning and skip (don't cancel paid order).

### Section 4: ProductService — Nack Retry + DLQ

**Files:**
- Modify: `ProductService/src/config/rabbitmq.consumer.js`
- Modify: `ProductService/src/consumers/orderCancelled.consumer.js`

**Changes:**
- Change `channel.nack(msg, false, false)` to `channel.nack(msg, false, true)` (requeue on failure)
- Add DLQ config to `order.cancelled.queue`: `x-dead-letter-exchange`, `x-dead-letter-routing-key`, `x-message-ttl`
- Add DLQ exchange and queue setup in `connectConsumer()`

### Section 5: OrderService — Missing Order Handling

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentCancelledEventConsumer.java`

**Changes:**
- Replace `if (order == null) { return; }` with `throw new ResourceNotFoundException(...)` to nack and retry
- Add `@RabbitListener` with `defaultRequeueRejected = false` to send to DLQ after max retries (Spring AMQP default behavior with DLQ config)

### Section 6: CartService — Typed DTO

**Files:**
- Create: `CartService/src/main/java/iuh/fit/CartService/domain/dto/OrderPaidEvent.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java`

**Changes:**
- Create `OrderPaidEvent` DTO with fields: `orderId`, `userId`, `checkoutOrderId`
- Update consumer to accept `OrderPaidEvent` instead of `Map<String, Object>`

### Section 7: NotificationService — Email Failure Handling

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java`

**Changes:**
- In `sendOrderPaidEmail()` and `sendOrderCancelledEmail()`: catch `MessagingException`, mark notification as FAILED, do NOT throw exception
- In `OrderEventConsumer`: on success OR handled failure, `basicAck` the message (don't requeue on email failure)

### Section 8: PaymentService — Expiry Job Distributed Lock

**Files:**
- Modify: `PaymentService/pom.xml`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`
- Modify: `PaymentService/src/main/resources/application.properties`

**Changes:**
- Add `net.javacrumbs.shedlock:shedlock-spring` and `shedlock-provider-jdbc-template` dependencies (use MariaDB as lock store, already available)
- Add `@EnableSchedulerLock` to `PaymentServiceApplication`
- Add `@SchedulerLock(name = "paymentExpiryJob", lockAtMostFor = "55s", lockAtLeastFor = "30s")` to `expirePendingPayments()` method
- Configure `LockProvider` bean using `JdbcTemplateLockProvider`

## Error Handling Summary

| Scenario | Before | After |
|---|---|---|
| Queue binding missing | Events silently dropped | Events delivered to consumers |
| Payment cancelled by user | Order stuck PENDING | Order cancelled, email sent |
| Expiry job races with webhook | Paid order cancelled | Status check prevents cancellation |
| Stock restore fails | Message lost forever | Retries, then DLQ |
| Order not found | Message acked, lost | Retries, then DLQ |
| Email send fails | Infinite requeue | Mark FAILED, ack message |
| Multiple PaymentService instances | Duplicate expiry events | Distributed lock prevents |

## Testing Strategy

1. **Unit tests:** Consumer logic, event publishing, lock acquisition
2. **Integration tests:** RabbitMQ bindings, DLQ routing, ShedLock behavior
3. **Manual testing:** Full checkout flow with QR payment, cancel, expiry scenarios

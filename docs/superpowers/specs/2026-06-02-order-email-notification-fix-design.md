# Design: Fix Order Email Notifications (Outbox Pattern)

**Date:** 2026-06-02
**Branch:** fix/fix-send-mail

## Problem

1. **Outbox events never persist to DB** — `saveToOutbox()` is called from an `afterCommit` callback, which runs outside the main transaction and has no `@Transactional` annotation. The `OutboxEvent` is created but never flushed/committed to the database. The `OutboxPublisherJob` polls every 5 seconds and finds zero PENDING events.

2. **User/Admin cancellation emails never sent** — `updateOrderStatus()` and `updateOrderStatusAsAdmin()` update the order status and restore stock, but do not call `publishOrderCancelledEmail()`. Only payment-driven cancellations (PaymentCancelledEventConsumer, PaymentExpiredEventConsumer) send cancellation emails.

## Architecture

### Current Flow (Broken)

```
OrderService.createOrderFromCheckout() [@Transactional]
  ├── save order to DB
  ├── register afterCommit callback
  └── transaction commits

afterCommit callback fires (NO transaction)
  └── orderEventPublisher.publishOrderCreated()
       └── saveToOutbox() ← no @Transactional, event never persists
```

### Target Flow (Fixed)

```
OrderService.createOrderFromCheckout() [@Transactional]
  ├── save order to DB
  ├── saveToOutbox() ← inside transaction, atomically committed
  └── transaction commits (both order + outbox event persisted)

OutboxPublisherJob [@Scheduled, @SchedulerLock]
  └── find PENDING events → publish to RabbitMQ → mark PUBLISHED
```

## Components

### 1. OrderEventPublisher.java

**Change:** Expose `saveToOutbox()` as a public method so `OrderService` can call it within its transaction.

**Current:**
```java
private void saveToOutbox(Object event, String eventType, Long aggregateId, String exchange, String routingKey) { ... }
```

**New:**
```java
public void saveOrderCreatedToOutbox(Long orderId, Long userId, String email) {
    OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
    saveToOutbox(event, "ORDER_CREATED", orderId, EMAIL_EXCHANGE, ORDER_CREATED_ROUTING_KEY);
}

public void saveOrderPaidEmailToOutbox(Long orderId, Long userId, String email) { ... }
public void saveOrderCancelledEmailToOutbox(Long orderId, Long userId, String email) { ... }
```

The private `saveToOutbox()` remains unchanged. New public wrapper methods provide typed entry points.

### 2. OrderService.java — createOrderFromCheckout()

**Change:** Replace `afterCommit` callback with direct `saveToOutbox()` call inside the transaction.

**Current:**
```java
Order saved = orderRepository.save(order);
publishOrderCreatedEvent(saved);  // registers afterCommit
return toResponse(saved);
```

**New:**
```java
Order saved = orderRepository.save(order);
if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
    orderEventPublisher.saveOrderCreatedToOutbox(saved.getId(), saved.getUserId(), saved.getEmail());
} else {
    log.warn("Order {} has no email, skipping outbox save", saved.getId());
}
return toResponse(saved);
```

Remove the `publishOrderCreatedEvent()` method entirely (no longer needed).

### 3. OrderService.java — updateOrderStatus() (User cancellation)

**Change:** Add direct `saveToOutbox()` call inside the transaction for cancellation emails.

**Current (L174-192):**
```java
if (OrderStatus.valueOf(request.getStatus()) == OrderStatus.CANCELLED && prev != null) {
    restoreStockForOrder(saved);
}
return toResponse(saved);
```

**New:**
```java
if (OrderStatus.valueOf(request.getStatus()) == OrderStatus.CANCELLED && prev != null) {
    restoreStockForOrder(saved);
    if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
        orderEventPublisher.saveOrderCancelledEmailToOutbox(saved.getId(), saved.getUserId(), saved.getEmail());
    } else {
        log.warn("Order {} has no email, skipping cancellation outbox save", saved.getId());
    }
}
return toResponse(saved);
```

### 4. OrderService.java — updateOrderStatusAsAdmin() (Admin cancellation)

**Change:** Add direct `saveToOutbox()` call inside the transaction for cancellation emails.

**Current (L321-333):**
```java
order.setStatus(requestedStatus);
Order saved = orderRepository.save(order);
auditService.record(orderId, adminUserId, prev, requestedStatus.name(), request.getNote());
return toResponse(saved);
```

**New:**
```java
order.setStatus(requestedStatus);
Order saved = orderRepository.save(order);
auditService.record(orderId, adminUserId, prev, requestedStatus.name(), request.getNote());

if (requestedStatus == OrderStatus.CANCELLED && saved.getEmail() != null && !saved.getEmail().isBlank()) {
    orderEventPublisher.saveOrderCancelledEmailToOutbox(saved.getId(), saved.getUserId(), saved.getEmail());
}
return toResponse(saved);
```

### 5. OrderService.java — Cleanup

Remove the `publishOrderCreatedEvent()` method entirely (replaced by direct outbox save).

No new helper methods needed — all outbox saves happen directly inside `@Transactional` methods.

## Data Flow Summary

| Event | Trigger | Outbox Save | Email Send |
|---|---|---|---|
| ORDER_CREATED | createOrderFromCheckout() | Inside main transaction | OutboxPublisherJob → RabbitMQ → NotificationService |
| ORDER_PAID | PaymentConfirmedEventConsumer | Inside consumer transaction | OutboxPublisherJob → RabbitMQ → NotificationService |
| ORDER_CANCELLED | PaymentCancelledEventConsumer | Inside consumer transaction | OutboxPublisherJob → RabbitMQ → NotificationService |
| ORDER_CANCELLED | PaymentExpiredEventConsumer | Inside consumer transaction | OutboxPublisherJob → RabbitMQ → NotificationService |
| ORDER_CANCELLED | updateOrderStatus() (user) | Inside main transaction | OutboxPublisherJob → RabbitMQ → NotificationService |
| ORDER_CANCELLED | updateOrderStatusAsAdmin() (admin) | Inside main transaction | OutboxPublisherJob → RabbitMQ → NotificationService |

## Error Handling

- Null/blank email check before saving to outbox
- OutboxPublisherJob handles publish failures with exponential backoff + max retries
- Failed outbox events marked as FAILED after max retries
- All outbox saves are inside `@Transactional` methods — if the transaction rolls back, the outbox event is also rolled back (atomicity)

## Testing

- Create order → verify outbox_events row inserted with PENDING status
- Create order → verify OutboxPublisherJob picks up and publishes event
- User cancel order → verify cancellation email sent
- Admin cancel order → verify cancellation email sent
- Payment cancelled → verify cancellation email sent (existing path)
- Payment expired → verify cancellation email sent (existing path)

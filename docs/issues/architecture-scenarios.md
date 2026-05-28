# Architecture Issues — Scenario Analysis

**Date:** 2026-05-28
**Source:** Microservices architecture review
**Scope:** Real-world scenarios that trigger each architectural gap and their business consequences

---

## 1. Stock Lost on Order Creation Failure (Saga Gap)

**Trigger:**
```
User clicks "checkout"
  → OrderService calls ProductService.batchDeductStock() → DynamoDB ✅ (stock -1)
  → OrderService tries to INSERT order into MariaDB
  → DB constraint violation (duplicate key, invalid FK, DB full)
  → @Transactional rolls back
  → batchRestoreStock() called as fallback → ProductService is DOWN or times out
  → Fallback swallows error silently
```

**How likely:** Low but real. Happens during DB maintenance, network blips between OrderService and MariaDB, or when MariaDB disk is full.

**Consequence:** Product stock permanently shows -1 less than reality. Over time, products appear "out of stock" when they're not → lost sales. If this happens on popular items, customers see false "sold out" messages.

---

## 2. Payment Expired but Order Never Cancelled (Direct Publish)

**Trigger:**
```
User creates order + payment, then closes browser
  → 5 min passes, PaymentExpiryJob fires
  → Marks payment as EXPIRED in DB
  → Calls rabbitTemplate.convertAndSend(PAYMENT_EXPIRED)
  → RabbitMQ is restarting / network partition
  → Event is LOST (no outbox, no retry)
  → OrderService never receives PAYMENT_EXPIRED
  → Order stays PENDING_PAYMENT forever
```

**How likely:** Medium. RabbitMQ restarts during deployments, brief network partitions in Docker.

**Consequence:** Order stuck in `PENDING_PAYMENT` indefinitely. Stock is reserved but never released. Admin sees "pending" orders that will never complete. No automatic cleanup.

---

## 3. Dead Letters Accumulate Forever (No DLQ Consumer)

**Trigger:**
```
PaymentConfirmedEvent arrives at OrderService
  → OrderService consumer throws exception (e.g., Order not found, DB connection lost)
  → Message nacked → goes to payment.confirmed.dlq
  → DLQ has NO @RabbitListener to process it
  → Message sits in DLQ forever
  → Order stays PENDING, user paid but order never marked PAID
```

**How likely:** Medium. Any transient DB error during event processing sends the message to DLQ. Without a consumer, it's a black hole.

**Consequence:** Customer paid money but order never progresses. No email sent, cart not cleared, inventory reserved indefinitely. Customer support gets complaints: "I paid but my order isn't confirmed."

---

## 4. Events Lost When RabbitMQ is Down (Outbox Disabled)

**Trigger:**
```
OrderService creates order successfully
  → Calls publishDirect() → rabbitTemplate.convertAndSend(ORDER_CREATED)
  → RabbitMQ is down for maintenance
  → Event is LOST (no outbox queue to retry)
  → NotificationService never sends order confirmation email
  → ProductService never receives order event for its own tracking
  → CartService never clears the cart
```

**How likely:** Low but catastrophic. RabbitMQ downtime during deployments or crashes.

**Consequence:** Order exists in DB but downstream services never know about it. No confirmation email → customer thinks order failed. Cart still has items → customer might double-order.

---

## 5. Silent Data Drift (No Reconciliation)

**Scenario A — Stock vs Orders:**
```
Over weeks, some stock deductions succeed but order events are lost
  → ProductService shows 50 units in stock
  → OrderService has 60 orders for this product
  → No job detects the mismatch
  → Customers order "in stock" items that are actually sold out
```

**Scenario B — Search vs Products:**
```
Product updated in DynamoDB, but product.updated event lost
  → SearchService shows old price/stock
  → Customer sees $100 in search, $120 at checkout
  → Confusion, cart abandonment
```

**How likely:** High over time. Every lost event creates a small inconsistency. Without reconciliation, they accumulate silently.

**Consequence:** Customers see wrong data. Orders fail at checkout due to stock mismatch. Trust erodes. Admin has no way to know data is wrong.

---

## Summary: Likelihood vs Impact

| Issue | Likelihood | Impact | Business Risk |
|---|---|---|---|
| Stock lost on order failure | Low | High | Lost sales, wrong inventory |
| Payment expired, order stuck | Medium | High | Customer pays, order never completes |
| DLQ black hole | Medium | Critical | Paid orders never confirmed |
| Events lost (RabbitMQ down) | Low | Critical | Silent order/notification loss |
| Data drift | High (over time) | Medium | Wrong prices/stock shown to customers |

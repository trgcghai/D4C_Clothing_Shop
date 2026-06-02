# Fix Order Email Notifications (Outbox Pattern) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix order email notifications by moving outbox saves into transactions and adding cancellation email support for user/admin cancellation paths.

**Architecture:** Move `saveToOutbox()` calls from `afterCommit` callbacks into the main `@Transactional` methods so outbox events are atomically committed with order data. Add cancellation email outbox saves to user and admin cancellation methods.

**Tech Stack:** Java 21, Spring Boot 3.3, Spring Data JPA, RabbitMQ, JUnit 5

---

### Task 1: Expose outbox save methods in OrderEventPublisher

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`

- [ ] **Step 1: Add public outbox save wrapper methods**

Add three public methods that wrap the private `saveToOutbox()` so `OrderService` can call them directly within its transaction:

```java
// Add after line 55 (after publishOrderCancelledEmail method)

public void saveOrderCreatedToOutbox(Long orderId, Long userId, String email) {
    OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
    saveToOutbox(event, "ORDER_CREATED", orderId, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY);
}

public void saveOrderPaidEmailToOutbox(Long orderId, Long userId, String email) {
    OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
    saveToOutbox(event, "ORDER_PAID", orderId, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_PAID_ROUTING_KEY);
}

public void saveOrderCancelledEmailToOutbox(Long orderId, Long userId, String email) {
    OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
    saveToOutbox(event, "ORDER_CANCELLED", orderId, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY);
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd OrderService && ./mvnw compile -q`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java
git commit -m "refactor: expose outbox save methods for transactional use"
```

---

### Task 2: Fix order creation to save outbox inside transaction

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Replace `publishOrderCreatedEvent()` call with direct outbox save in `createOrderFromCheckout()`**

In `createOrderFromCheckout()`, replace line 110:

**Before (line 108-111):**
```java
try {
    Order saved = orderRepository.save(order);
    publishOrderCreatedEvent(saved);
    return toResponse(saved);
```

**After:**
```java
try {
    Order saved = orderRepository.save(order);
    if (saved.getEmail() != null && !saved.getEmail().isBlank()) {
        orderEventPublisher.saveOrderCreatedToOutbox(saved.getId(), saved.getUserId(), saved.getEmail());
    } else {
        log.warn("Order {} has no email, skipping outbox save", saved.getId());
    }
    return toResponse(saved);
```

- [ ] **Step 2: Remove the `publishOrderCreatedEvent()` method**

Delete the entire method at lines 373-389:

```java
// DELETE these lines entirely:
private void publishOrderCreatedEvent(Order saved) {
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override
        public void afterCommit() {
            try {
                String userEmail = saved.getEmail();
                if (userEmail != null && !userEmail.isBlank()) {
                    orderEventPublisher.publishOrderCreated(saved.getId(), saved.getUserId(), userEmail);
                } else {
                    log.warn("Order {} has no email, skipping order created event", saved.getId());
                }
            } catch (Exception e) {
                log.error("Failed to publish order created event for orderId {}: {}", saved.getId(), e.getMessage(), e);
            }
        }
    });
}
```

- [ ] **Step 3: Remove unused imports**

Remove these imports if no longer used (check if `TransactionSynchronization` and `TransactionSynchronizationManager` are used elsewhere — they won't be after this change):

```java
// DELETE these lines:
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
```

- [ ] **Step 4: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git commit -m "fix: save order created event to outbox inside transaction"
```

---

### Task 3: Add cancellation email for user-initiated cancellation

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Add outbox save for user cancellation in `updateOrderStatus()`**

In `updateOrderStatus()`, replace the cancellation block at lines 187-189:

**Before:**
```java
if (OrderStatus.valueOf(request.getStatus()) == OrderStatus.CANCELLED && prev != null) {
    restoreStockForOrder(saved);
}

return toResponse(saved);
```

**After:**
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

- [ ] **Step 2: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git commit -m "feat: add cancellation email outbox save for user cancellation"
```

---

### Task 4: Add cancellation email for admin-initiated cancellation

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Add outbox save for admin cancellation in `updateOrderStatusAsAdmin()`**

In `updateOrderStatusAsAdmin()`, add cancellation email after the audit record at line 331:

**Before:**
```java
auditService.record(orderId, adminUserId, prev, requestedStatus.name(), request.getNote());
return toResponse(saved);
```

**After:**
```java
auditService.record(orderId, adminUserId, prev, requestedStatus.name(), request.getNote());

if (requestedStatus == OrderStatus.CANCELLED && saved.getEmail() != null && !saved.getEmail().isBlank()) {
    orderEventPublisher.saveOrderCancelledEmailToOutbox(saved.getId(), saved.getUserId(), saved.getEmail());
}

return toResponse(saved);
```

- [ ] **Step 2: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git commit -m "feat: add cancellation email outbox save for admin cancellation"
```

---

### Task 5: Verify end-to-end with Docker

**Files:**
- No code changes

- [ ] **Step 1: Rebuild and restart OrderService**

```bash
docker compose build orderservice && docker compose up -d orderservice
```

- [ ] **Step 2: Verify outbox table is populated after creating an order**

Create an order via the frontend or API, then check:

```bash
docker compose exec mariadb mariadb -u user -ppassword order_db -e "SELECT id, event_type, status, exchange, routing_key FROM outbox_events ORDER BY created_at DESC LIMIT 5;"
```

Expected: Rows with `ORDER_CREATED` event, status `PENDING`

- [ ] **Step 3: Verify OutboxPublisherJob processes events**

Wait 5-10 seconds, then check again:

```bash
docker compose exec mariadb mariadb -u user -ppassword order_db -e "SELECT id, event_type, status, published_at FROM outbox_events ORDER BY created_at DESC LIMIT 5;"
```

Expected: Status changed to `PUBLISHED` with a `published_at` timestamp

- [ ] **Step 4: Verify email received**

Check the email inbox for the order creation confirmation email.

- [ ] **Step 5: Test user cancellation email**

Cancel an order as a user, then verify:
1. Outbox has `ORDER_CANCELLED` event
2. Cancellation email received

- [ ] **Step 6: Check OrderService logs for errors**

```bash
docker compose logs --tail=100 orderservice | grep -i -E "error|exception|warn|outbox|cancel"
```

Expected: No errors related to outbox or email publishing

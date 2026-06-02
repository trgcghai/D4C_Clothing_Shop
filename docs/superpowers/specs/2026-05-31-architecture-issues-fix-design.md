# Design: Architecture Issues Fix — Saga, Outbox, Idempotency, Cleanup

**Date:** 2026-05-31
**Source:** `docs/issues/2026-31-05-issues.md`
**Scope:** 6 architecture gaps + 1 bonus (ShedLock) with automated tests

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OrderService                              │
│                                                              │
│  createOrderFromCheckout()                                   │
│    ├─ deductStockForOrder() ──Feign──► ProductService       │
│    │                                    batchDeductStock()   │
│    │                                    [idempotency key]    │
│    ├─ orderRepository.save()                                 │
│    │   ├─ Success → publishOrderCreatedEvent (outbox)        │
│    │   └─ Fail    → restoreStockForOrder() ──Feign──► PS    │
│    │                  ├─ Success → rethrow                    │
│    │                  └─ Fail    → save STOCK_RESTORE_FAILED  │
│    │                            to outbox for retry           │
│                                                              │
│  OutboxPublisherJob (5s, @SchedulerLock)                     │
│    ├─ findRetryableEvents() ← retry_after <= NOW()           │
│    └─ exponential backoff on failure                         │
│                                                              │
│  OutboxCleanupJob (daily 2 AM)                               │
│    ├─ DELETE PUBLISHED > 30 days                             │
│    └─ ARCHIVE FAILED > 30 days                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PaymentService                            │
│                                                              │
│  PaymentExpiryJob (60s, @SchedulerLock)                      │
│    ├─ expirePendingPayments()                                │
│    └─ save PAYMENT_EXPIRED to outbox (NOT direct publish)   │
│                                                              │
│  OutboxPublisherJob (5s, @SchedulerLock)                     │
│    └─ same as OrderService (retry_after + backoff)           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    ProductService (Node.js)                  │
│                                                              │
│  batchDeductStock(items, idempotencyKey)                     │
│    ├─ Check Redis: GET idempotency:{key}                     │
│    │   ├─ Hit → return cached result                         │
│    │   └─ Miss → TransactWriteItems + SET with TTL 3600s     │
│    └─ Returns: { success, failedItems }                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Issue #1: Stock Compensation on Order Creation Failure

### 2.1 Problem
`OrderService.createOrderFromCheckout()` deducts stock via Feign before saving order. If `orderRepository.save()` throws (non-duplicate exception), `@Transactional` rolls back the local DB but DynamoDB stock deduction is permanent.

### 2.2 Fix
Add `catch (Exception ex)` block after existing `DataIntegrityViolationException` handler:
- Call `restoreStockForOrder(request.getItems())` to compensate
- If compensation ALSO fails, publish `STOCK_RESTORE_FAILED` event to outbox for async retry

### 2.3 Files Changed
- `OrderService/src/main/java/com/iuh/fit/service/OrderService.java` — add catch block
- `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java` — add `publishStockRestoreFailed()`
- `OrderService/src/main/java/com/iuh/fit/domain/event/StockRestoreFailedEvent.java` — new event class

### 2.4 Tests
- `OrderServiceCheckoutTest.shouldRestoreStockWhenOrderSaveFails` — mock `save()` throws → verify `batchRestoreStock()` called
- `OrderServiceCheckoutTest.shouldSaveToOutboxWhenRestorationAlsoFails` — mock both throw → verify outbox row saved
- `OrderServiceCheckoutTest.shouldNotSwallowStockRestorationFailure` — mock restore throws → verify `publishStockRestoreFailed()` called

---

## 3. Issue #2: Stock Restoration Failure Event

### 3.1 Problem
`batchRestoreStock()` catches all exceptions and only logs. No retry mechanism, no alerting.

### 3.2 Fix
Publish `STOCK_RESTORE_FAILED` event to outbox when restoration fails. Consumer in ProductService retries with idempotency.

### 3.3 Files Changed
- Same as Issue #1 (shared fix)
- `ProductService/src/consumers/stockRestoreFailed.consumer.js` — new consumer

### 3.4 Tests
- Covered by Issue #1 tests

---

## 4. Issue #3: Idempotency Key on Stock Deduction

### 4.1 Problem
`ProductClient.batchDeductStock()` has no idempotency key. Resilience4j retry (3 attempts, 1s wait) can cause double deduction on network timeout.

### 4.2 Fix
- OrderService passes `checkoutOrderId` as `X-Idempotency-Key` header
- ProductService checks Redis cache before processing
- Cache TTL: 3600s (covers retry window + buffer)

### 4.3 Files Changed
- `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java` — add `@RequestHeader("X-Idempotency-Key")`
- `OrderService/src/main/java/com/iuh/fit/service/OrderService.java` — pass key to Feign call
- `ProductService/src/controllers/stock.controller.js` — extract header
- `ProductService/src/services/stock.service.js` — Redis check + cache

### 4.4 Tests
- `ProductService/src/__tests__/stock.service.test.js` — 3 tests: duplicate key returns cached, different keys deduct twice, no key works (backward compatible)

---

## 5. Issue #4: PaymentExpiryJob Bypasses Outbox

### 5.1 Problem
`PaymentExpiryJob` publishes `PAYMENT_EXPIRED` via direct `rabbitTemplate.convertAndSend()`. If RabbitMQ is down, event is lost.

### 5.2 Fix
Replace direct publish with `outboxRepository.save()`. Reuse existing `OutboxEvent` entity and `OutboxPublisherJob`.

### 5.3 Files Changed
- `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java` — inject `OutboxEventRepository` + `ObjectMapper`, replace direct publish with outbox save

### 5.4 Tests
- `PaymentExpiryJobTest.shouldSaveToOutboxWhenExpiringPayment` — verify `outboxRepository.save()` IS called
- `PaymentExpiryJobTest.shouldNotCallRabbitTemplateDirectly` — verify `rabbitTemplate.convertAndSend()` is NEVER called
- `PaymentExpiryJobTest.shouldNotLoseEventWhenRabbitMqIsDown` — mock RabbitMQ down → verify outbox row still saved

---

## 6. Issue #5: No Retry Backoff on OutboxPublisherJob

### 6.1 Problem
Failed events retry at constant 5s interval. All 5 retries burn in 20s, even if RabbitMQ needs 30s+ to recover.

### 6.2 Fix
- Add `retryAfter` column to `OutboxEvent` entity
- Query only events where `retryAfter IS NULL OR retryAfter <= CURRENT_TIMESTAMP`
- Exponential backoff: 5s × 2^(retryCount-1) + jitter(0-2s), cap at 5min

### 6.3 Files Changed
- `OrderService/src/main/java/com/iuh/fit/domain/entity/OutboxEvent.java` — add `retryAfter` field
- `OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java` — add `findRetryableEvents()` query
- `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java` — use new query + backoff logic
- `PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/OutboxEvent.java` — same
- `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java` — same
- `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java` — same

### 6.4 Tests
- `OutboxPublisherJobTest.shouldSetRetryAfterWithExponentialDelay` — verify ~5s, ~10s, ~20s progression
- `OutboxPublisherJobTest.shouldCapRetryAfterAt5Minutes` — verify cap at 300s
- `OutboxPublisherJobTest.shouldNotRetryBeforeRetryAfterTime` — verify job skips events with future `retryAfter`
- `OutboxPublisherJobTest.shouldIncludeExceptionClassInErrorMessage` — verify error message format

---

## 7. Issue #6: No Cleanup of Old Outbox Events

### 7.1 Problem
`outbox_events` table grows unbounded. No job deletes or archives old events.

### 7.2 Fix
- `OutboxCleanupJob` runs daily at 2 AM
- DELETE `PUBLISHED` events older than 30 days
- ARCHIVE `FAILED` events older than 30 days (status change to `ARCHIVED`)

### 7.3 Files Changed
- `OrderService/src/main/java/com/iuh/fit/service/OutboxCleanupJob.java` — new class
- `OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java` — add `deleteByStatusAndCreatedAtBefore()` + `archiveByStatusAndCreatedAtBefore()`
- `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxCleanupJob.java` — new class (same logic)
- `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java` — same queries

### 7.4 Tests
- `OutboxCleanupJobTest.shouldDeleteOldPublishedEvents` — seed old events → verify deleted
- `OutboxCleanupJobTest.shouldArchiveOldFailedEvents` — seed old FAILED → verify status=ARCHIVED
- `OutboxCleanupJobTest.shouldNotDeleteRecentEvents` — seed recent → verify NOT deleted
- `OutboxCleanupJobTest.shouldNotDeleteWhenEmpty` — empty table → no error

---

## 8. Bonus: ShedLock for OutboxPublisherJob

### 8.1 Problem
Both `OutboxPublisherJob` instances lack `@SchedulerLock`. Multi-instance = duplicate events.

### 8.2 Fix
- **OrderService:** Add ShedLock dependency + `ShedLockConfig` + `@EnableSchedulerLock` on application class + `@SchedulerLock` on `publishPendingEvents()`
- **PaymentService:** Already has ShedLock — just add `@SchedulerLock(name = "outboxPublisherJob", lockAtMostFor = "10s", lockAtLeastFor = "2s")` to `publishPendingEvents()`

### 8.3 Files Changed
- `OrderService/pom.xml` — add `shedlock-spring` + `shedlock-provider-jdbc-template`
- `OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java` — add `@EnableSchedulerLock`
- `OrderService/src/main/java/com/iuh/fit/config/ShedLockConfig.java` — new config
- `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java` — add `@SchedulerLock`
- `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java` — add `@SchedulerLock`

---

## 9. Test Summary

| Issue | Test File | Tests | Type |
|---|---|---|---|
| #1 Stock compensation | `OrderServiceCheckoutTest` | 3 | Unit (Mockito) |
| #2 Restore failure event | `OrderServiceCheckoutTest` | (shared with #1) | Unit (Mockito) |
| #3 Idempotency key | `ProductService/src/__tests__/stock.service.test.js` | 3 | Unit (Jest) |
| #4 PaymentExpiry outbox | `PaymentExpiryJobTest` | 3 | Unit (Mockito) |
| #5 Retry backoff | `OutboxPublisherJobTest` (both services) | 4 each | Unit (Mockito) |
| #6 Outbox cleanup | `OutboxCleanupJobTest` (both services) | 4 each | Unit (Mockito) |
| Bonus ShedLock | Existing tests + manual verification | — | Integration |

**Total: ~25 new tests across 5 test files.**

---

## 10. Implementation Order

1. Issue #1 + #2 (OrderService stock compensation) — highest business risk
2. Issue #4 (PaymentExpiryJob outbox) — medium risk, simple fix
3. Issue #5 (Retry backoff) — medium risk, schema change
4. Issue #6 (Cleanup job) — low urgency, simple
5. Issue #3 (Idempotency key) — low likelihood, cross-service change
6. Bonus (ShedLock) — infrastructure, needed before scale

---

## 11. Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| Stock compensation catch block | Low — only adds behavior on failure path | Unit tests cover all branches |
| Outbox save in PaymentExpiryJob | Low — same pattern as existing events | Unit tests verify outbox save, no direct RabbitMQ call |
| retryAfter column | Low — nullable column, backward compatible | Hibernate `ddl-auto=update` auto-creates |
| Cleanup job | Low — runs at 2 AM, only deletes PUBLISHED | FAILED events archived, not deleted |
| Idempotency key in ProductService | Low — optional header, backward compatible | Test with no key verifies backward compatibility |
| ShedLock in OrderService | Low — new dependency, isolated config | Existing PaymentService ShedLock proves pattern works |

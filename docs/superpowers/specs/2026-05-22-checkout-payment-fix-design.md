# Checkout/Payment Flow — Fix Design Spec

**Date:** 2026-05-22
**Author:** AI Assistant
**Status:** Revised — review findings incorporated
**Approach:** Event-driven overhaul (Approach B)

---

## 1. Problem Summary

The checkout/payment flow has 15 identified issues across 3 severity levels:

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 6 | Stock deduction no rollback, late webhook rejected, duplicate orders, WebhookLog ordering, RabbitMQ event loss, no payment ownership check |
| HIGH | 8 | Stock restoration silent failure, price drift, overpayment accepted, fuzzy matching too loose, no circuit breakers, JWT expiry mid-checkout, unmatched webhook ignored, cancelPayment no try-catch |
| MEDIUM | 1 | PaymentPage no navigation blocker |

Full issue list: `docs/2026-22-05-issues.md`

---

## 2. Architecture Overview

### 2.1 New Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  • JWT auto-refresh + proactive check before checkout           │
│  • Idempotent checkout button (disabled after click)            │
│  • PaymentPage navigation blocker (useBlocker + cancel on leave)│
│  • Price change confirmation dialog                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API GATEWAY                               │
│  • JWT validation, header forwarding                            │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│ Cart │ │ Order  │ │Payment │ │Product │ │Notification│
│Service│ │Service │ │Service │ │Service │ │ Service   │
│      │ │        │ │        │ │        │ │           │
│      │ │Outbox  │ │Outbox  │ │        │ │           │
│      │ │Table   │ │Table   │ │        │ │           │
│      │ │        │ │        │ │        │ │           │
│      │ │Saga    │ │        │ │        │ │           │
│      │ │Coord   │ │        │ │        │ │           │
└──┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └───────────┘
   │         │          │          │
   │         │  ┌───────┴───────┐  │
   │         │  │  RabbitMQ +   │  │
   │         │  │  DLQ Config   │  │
   │         │  └───────┬───────┘  │
   │         │          │          │
   │         ▼          ▼          ▼
   │    ┌──────────────────────────────┐
   │    │  Resilience4j Circuit Breaker│
   │    │  (all inter-service calls)   │
   │    └──────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DynamoDB (ProductService)                   │
│  • Batch atomic stock deduction endpoint                        │
│  • Transaction-based stock operations                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Changes

1. **Outbox tables** in OrderService and PaymentService — events saved in same transaction as business data, background job polls and publishes to RabbitMQ
2. **SAGA pattern** for stock management — `deductStock` is step 1, if fail then compensation `restoreStock` automatically
3. **Resilience4j** on all inter-service calls — circuit breaker + retry + bulkhead isolation
4. **Batch atomic stock endpoint** in ProductService — DynamoDB transaction ensures all-or-nothing
5. **Late webhook grace period** — allow mark PAID if webhook arrives within 1 hour after expiry
6. **PaymentPage navigation blocker** — confirm dialog + auto-cancel on leave
7. **Price validation with confirm** — warn user if price changed, require confirmation

---

## 3. Outbox Pattern

### 3.1 Schema

Each service with event publishing (OrderService, PaymentService) gets its own `outbox_events` table:

```sql
CREATE TABLE outbox_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    payload JSON NOT NULL,
    exchange VARCHAR(100) NOT NULL,
    routing_key VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,
    error_message TEXT NULL,
    INDEX idx_status_created (status, created_at)
);
```

### 3.2 Flow

1. **Save phase** (inside `@Transactional`):
   ```java
   orderRepository.save(order);
   outboxRepository.save(new OutboxEvent("ORDER_CREATED", order.getId(), payload, EMAIL_EXCHANGE, ORDER_CREATED_ROUTING_KEY));
   // Both committed in same transaction
   ```

2. **Publish phase** (background job `OutboxPublisherJob`):
   - Poll `status='PENDING'` events every 5 seconds, batch size 100
   - For each event: `rabbitTemplate.convertAndSend(event.getExchange(), event.getRoutingKey(), event.getPayload())`
   - On success: `status='PUBLISHED'`, `published_at=now`
   - On failure: `retry_count++`, `error_message=e.getMessage()`
   - If `retry_count >= max_retries`: `status='FAILED'` + log alert

3. **Idempotency**: If background job crashes mid-publish, next run retries. RabbitMQ publisher confirms ensure no duplicates (idempotent consumers check status before processing).

### 3.3 Services Using Outbox

| Service | Events Published | Outbox Table |
|---------|-----------------|--------------|
| OrderService | ORDER_CREATED, ORDER_PAID, ORDER_CANCELLED | `order_db.outbox_events` |
| PaymentService | PAYMENT_CONFIRMED, PAYMENT_EXPIRED, PAYMENT_CANCELLED | `payment_db.outbox_events` |

### 3.4 Transition Plan

Use a feature flag to switch atomically between direct publish and outbox publish. **Do NOT run both paths in parallel** — this would cause duplicate events since consumers only check aggregate status, not event-level dedup.

```properties
# application.properties
feature.outbox.enabled=true
```

```java
if (outboxEnabled) {
    outboxRepository.save(new OutboxEvent(...));
} else {
    rabbitTemplate.convertAndSend(exchange, routingKey, event);
}
```

After verification that outbox publishing works correctly in production, remove the old direct publish code path entirely. Each event type gets a unique `event_id` (UUID) stored in the outbox record for future auditability.

---

## 4. SAGA Pattern for Stock Management

### 4.1 Problem

Current flow: `deductStock()` called sequentially per item via Feign. If item #3 fails, items #1 and #2 stock is already deducted in DynamoDB with no rollback.

### 4.2 Solution: Batch Atomic Endpoint

**New ProductService endpoints:**

```
POST /api/products/stock/deduct-batch
POST /api/products/stock/restore-batch
```

**Auth:** Internal only via `GatewayIdentityFilter` (same as existing internal endpoints).

**Request body:**
```json
[
  { "variantId": "var_123", "quantity": 2 },
  { "variantId": "var_456", "quantity": 1 }
]
```

**Response:**
```json
{ "success": true }
// or
{ "success": false, "failedItems": [{ "variantId": "var_123", "reason": "INSUFFICIENT_STOCK" }] }
```

### 4.3 DynamoDB Implementation

Use `TransactWriteItems` API:

```javascript
// ProductService variant.model.js
async function batchDeductStock(items) {
  const transactItems = items.map(item => ({
    Update: {
      TableName: process.env.VARIANT_TABLE_NAME,
      Key: { variant_id: item.variantId },
      UpdateExpression: 'SET quantity = quantity - :qty',
      ConditionExpression: 'quantity >= :qty',
      ExpressionAttributeValues: { ':qty': item.quantity }
    }
  }));

  try {
    await dynamoDb.transactWrite({ TransactItems: transactItems });
    return { success: true };
  } catch (e) {
    if (e.code === 'TransactionCanceledException') {
      // Parse cancellation reasons to identify failed items
      return { success: false, failedItems: parseCancellationReasons(e) };
    }
    throw e;
  }
}
```

**Guarantee:** DynamoDB transaction is all-or-nothing. If any item fails condition check, entire transaction rolls back.

### 4.4 SAGA Compensation Flow

```
Step 1: OrderService calls ProductService.batchDeductStock(items)
        → DynamoDB transaction: all-or-nothing
        → If fail: throw BadRequestException with details, no order created

Step 2: If success → create order (PENDING_PAYMENT) → save to outbox ORDER_CREATED event

Step 3: If order cancelled (user cancel, payment expired, payment cancelled):
        → OrderService saves ORDER_CANCELLED event to outbox
        → OutboxPublisherJob publishes to order.exchange
        → ProductService consumer receives event → batchRestoreStock(items)
        → DynamoDB transaction: restore all items atomically

Compensation guarantees:
        → Outbox table ensures ORDER_CANCELLED event is never lost
        → ProductService consumer has idempotency check (skip if already restored)
        → DLQ for failed messages → manual retry
```

---

## 5. Resilience4j Configuration

### 5.1 Dependencies

Add to all Java services that make inter-service calls (OrderService, PaymentService, CartService):

```groovy
implementation 'org.springframework.cloud:spring-cloud-starter-circuitbreaker-resilience4j'
implementation 'org.springframework.boot:spring-boot-starter-actuator'
```

### 5.2 Circuit Breaker Config

```properties
# Circuit Breaker - ProductService
resilience4j.circuitbreaker.instances.productService.slidingWindowSize=10
resilience4j.circuitbreaker.instances.productService.failureRateThreshold=50
resilience4j.circuitbreaker.instances.productService.waitDurationInOpenState=30s
resilience4j.circuitbreaker.instances.productService.permittedNumberOfCallsInHalfOpenState=3
resilience4j.circuitbreaker.instances.productService.slowCallDurationThreshold=3000
resilience4j.circuitbreaker.instances.productService.slowCallRateThreshold=80

# Circuit Breaker - OrderService
resilience4j.circuitbreaker.instances.orderService.slidingWindowSize=10
resilience4j.circuitbreaker.instances.orderService.failureRateThreshold=50
resilience4j.circuitbreaker.instances.orderService.waitDurationInOpenState=30s
resilience4j.circuitbreaker.instances.orderService.permittedNumberOfCallsInHalfOpenState=3

# Retry
resilience4j.retry.instances.productService.maxAttempts=3
resilience4j.retry.instances.productService.waitDuration=1s
resilience4j.retry.instances.productService.retryExceptions=FeignException.ServiceUnavailable,FeignException.GatewayTimeout

resilience4j.retry.instances.orderService.maxAttempts=3
resilience4j.retry.instances.orderService.waitDuration=1s
resilience4j.retry.instances.orderService.retryExceptions=FeignException.ServiceUnavailable,FeignException.GatewayTimeout

# Bulkhead (semaphore for synchronous calls)
resilience4j.bulkhead.instances.productService.maxConcurrentCalls=10
resilience4j.bulkhead.instances.productService.maxWaitDuration=2000

resilience4j.bulkhead.instances.orderService.maxConcurrentCalls=10
resilience4j.bulkhead.instances.orderService.maxWaitDuration=2000
```

### 5.3 Feign Timeout Config

```properties
feign.client.config.default.connectTimeout=2000
feign.client.config.default.readTimeout=5000
feign.client.config.default.loggerLevel=BASIC
```

### 5.4 Fallback Strategies

| Call | Fallback Behavior |
|------|-------------------|
| `batchDeductStock` | Throw `BadRequestException("Không thể xử lý đặt hàng, vui lòng thử lại")` |
| `batchRestoreStock` | Log error + save to outbox as `STOCK_RESTORATION_FAILED` event for retry |
| `validateCart` | Return cached validation result (stale data acceptable for 30s) |
| `getOrderUserId` | Throw `BadRequestException("Không thể xác thực đơn hàng")` — payment creation blocked |

### 5.5 Usage Pattern

```java
@Service
public class OrderService {

    @CircuitBreaker(name = "productService", fallbackMethod = "deductStockFallback")
    @Retry(name = "productService")
    @Bulkhead(name = "productService")  // SEMAPHORE is default for sync methods
    public void deductStockForOrder(List<CheckoutItemDto> items) {
        productClient.batchDeductStock(items);
    }

    public void deductStockFallback(List<CheckoutItemDto> items, Throwable t) {
        log.error("Stock deduction failed for order: {}", t.getMessage());
        throw new BadRequestException("Không thể xử lý đặt hàng, vui lòng thử lại");
    }
}
```

Note: `@Bulkhead` on synchronous methods defaults to `Bulkhead.Type.SEMAPHORE`. Use `THREADPOOL` only for methods returning `CompletableFuture` or other async types.

---

## 6. Targeted Fixes

### 6.1 Late Webhook Grace Period + Reconciliation (Issue #2)

**File:** `PaymentService/service/PaymentService.java`

```java
@Transactional
public PaymentStatusResponse markAsPaid(String paymentCode, Long sepayTxId, String gateway) {
    Instant now = Instant.now();
    int updated = paymentRepository.markAsPaid(paymentCode, sepayTxId, gateway, now);
    if (updated == 0) {
        Payment payment = paymentRepository.findByPaymentCode(paymentCode)
                .orElseThrow(() -> new PaymentException("Payment not found: " + paymentCode));

        if (payment.getStatus() == PaymentStatus.PAID) {
            return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, payment.getPaidAt());
        }

        // Grace period: allow late webhook if within 1 hour of expiry
        if (payment.getStatus() == PaymentStatus.EXPIRED) {
            Instant gracePeriodEnd = payment.getExpiresAt().plusSeconds(3600);
            if (now.isBefore(gracePeriodEnd)) {
                payment.setStatus(PaymentStatus.PAID);
                payment.setSepayTransactionId(sepayTxId);
                payment.setSepayGateway(gateway);
                payment.setPaidAt(now);
                paymentRepository.save(payment);
                // Save PaymentConfirmedEvent to outbox
                outboxRepository.save(new OutboxEvent("PAYMENT_CONFIRMED", payment.getId(), buildPayload(payment), PAYMENT_EXCHANGE, PAYMENT_CONFIRMED_ROUTING_KEY));
                log.info("Late webhook accepted for payment {} within grace period", paymentCode);

                // Check if order was already CANCELLED by PaymentExpiredEventConsumer
                OrderStatus currentOrderStatus = orderClient.getOrderStatus(payment.getOrderId());
                if (currentOrderStatus == OrderStatus.CANCELLED) {
                    // Order was cancelled + stock restored, but user actually paid.
                    // Mark as PAID_NEEDS_RECONCILE — requires admin action:
                    // Option A: Reopen order + re-deduct stock via compensation saga
                    // Option B: Auto-refund + keep order cancelled
                    payment.setReconciliationStatus("PAID_NEEDS_RECONCILE");
                    paymentRepository.save(payment);
                    log.error("Payment {} PAID but order {} already CANCELLED — requires reconciliation",
                        paymentCode, payment.getOrderId());
                }
                return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, now);
            }
        }

        throw new PaymentException("Payment already " + payment.getStatus());
    }

    Payment payment = paymentRepository.findByPaymentCode(paymentCode).orElseThrow();
    outboxRepository.save(new OutboxEvent("PAYMENT_CONFIRMED", payment.getId(), buildPayload(payment), PAYMENT_EXCHANGE, PAYMENT_CONFIRMED_ROUTING_KEY));
    return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, now);
}
```

**Reconciliation policy for PAID_NEEDS_RECONCILE:**

When late webhook marks payment PAID but order was already CANCELLED (stock restored):

1. Payment status = `PAID`, but `reconciliation_status = 'PAID_NEEDS_RECONCILE'`
2. Outbox publishes `PaymentConfirmedEvent` with a `reconciliationRequired=true` flag
3. `PaymentConfirmedEventConsumer` in OrderService detects the flag:
   - If order is `CANCELLED`: **Do NOT reopen automatically.** Instead, save to `reconciliation_queue` table and alert admin.
   - Admin dashboard shows: "Payment PAID but order CANCELLED — user paid after expiry. Choose: (A) Reopen order + re-deduct stock, (B) Issue refund."
4. Admin action triggers either:
   - **Reopen:** Set order back to `PAID`, call `batchDeductStock` to re-deduct, send confirmation email to user.
   - **Refund:** Keep order `CANCELLED`, trigger refund workflow via SePay (manual or API).

**New table:**
```sql
CREATE TABLE reconciliation_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    issue_type VARCHAR(50) NOT NULL,  -- 'PAID_AFTER_CANCEL', 'AMOUNT_MISMATCH', etc.
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, RESOLVED, ESCALATED
    resolution_action VARCHAR(50) NULL,    -- 'REOPEN_ORDER', 'ISSUE_REFUND'
    resolved_by BIGINT NULL,              -- admin user ID
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pending (status, created_at)
);
```

### 6.2 Duplicate Order Prevention (Issue #3)

**Frontend:** `CheckoutPage.tsx`

```tsx
const [isProcessing, setIsProcessing] = useState(false);

const handleConfirm = async () => {
  if (isProcessing) return;
  setIsProcessing(true);
  try {
    // ... existing checkout flow
  } finally {
    setIsProcessing(false);
  }
};

// Disable button
<Button disabled={isProcessing} onClick={handleConfirm}>
  {isProcessing ? <Loader2 className="animate-spin" /> : "Xác nhận"}
</Button>
```

**Backend:** Stable idempotency key from client

The frontend generates a UUID for each checkout attempt and sends it as `idempotencyKey` in the partial checkout request. This key is stable across retries within the same checkout session.

```tsx
// CheckoutPage.tsx
const [idempotencyKey] = useState(() => crypto.randomUUID());

const handleConfirm = async () => {
  if (isProcessing) return;
  setIsProcessing(true);
  try {
    const partialResponse = await partialCheckoutMutation.mutateAsync({
      selectedIds,
      idempotencyKey,  // ← stable across retries
    });
    // ... rest of flow
  } finally {
    setIsProcessing(false);
  }
};
```

```java
// CartService.java - partialCheckout
public CheckoutResponse partialCheckout(Long userId, PartialCheckoutRequest request) {
    // Use client-provided idempotency key directly
    String checkoutOrderId = "ORD-" + request.getIdempotencyKey().substring(0, 16);

    // Idempotency: if same key was already processed, return cached result
    CheckoutResponse cached = checkoutCache.get(checkoutOrderId);
    if (cached != null) return cached;

    // ... validation, snapshot, response creation
    checkoutCache.put(checkoutOrderId, response);
    return response;
}
```

The `checkoutCache` is a short-lived in-memory map (or Redis with 10-min TTL) keyed by `checkoutOrderId`. This ensures that even if the user retries with the same key, they get the same response without creating a new order draft.

### 6.3 WebhookLog Ordering (Issue #4)

**File:** `PaymentService/service/WebhookService.java`

Save WebhookLog AFTER markAsPaid succeeds:

```java
@Transactional(noRollbackFor = PaymentException.class)
public boolean processWebhook(SePayWebhookPayload payload) {
    // 1. HMAC verification
    verifyHmac(payload);

    // 2. Replay attack check
    if (isReplayAttack(payload)) return true;

    // 3. Resolve payment code
    String paymentCode = resolvePaymentCode(payload);
    if (paymentCode == null) {
        log.warn("Unmatched webhook: {}", payload);
        // Save to unmatched_payments table for reconciliation
        unmatchedPaymentRepository.save(new UnmatchedPayment(payload, Instant.now()));
        return true;
    }

    // 4. Mark as paid (includes grace period logic)
    markAsPaid(paymentCode, payload.getId(), payload.getGateway());

    // 5. Save webhook log AFTER success
    webhookLogRepository.save(new WebhookLog(payload.getId(), payload, Instant.now()));

    return true;
}
```

### 6.4 Payment Ownership Check (Issue #6)

**File:** `PaymentService/controller/PaymentController.java`

The codebase uses `@RequestHeader("X-User-Id")` forwarded by the API Gateway (see `OrderController.java:38`, `CartController.java`). The `createPayment` endpoint currently has no user ID extraction. Add the header parameter:

```java
@PostMapping
public ResponseEntity<PaymentResponse> createPayment(
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody CreatePaymentRequest request) {
    PaymentResponse response = paymentService.createPayment(request, userId);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
}
```

**File:** `PaymentService/service/PaymentService.java`

```java
@Transactional
public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
    // Verify ownership
    Long orderUserId = orderClient.getOrderUserId(request.getOrderId());
    if (!orderUserId.equals(requestingUserId)) {
        throw new PaymentException("Access denied: you do not own this order");
    }

    // ... existing idempotency check and payment creation
}
```

Note: The `X-User-Id` header is set by `JwtValidationFilter` in the API Gateway and forwarded to downstream services by `FeignHeaderForwardingInterceptor`. If the header is missing, Spring will return 400 before the controller method is reached.

### 6.5 Price Validation with Confirm (Issue #8)

**CartService:** Add price check in `validateCartItems()`:

```java
public List<PriceWarning> validateCartItems(List<CartItem> items) {
    List<PriceWarning> warnings = new ArrayList<>();
    for (CartItem item : items) {
        ProductDto product = productServiceClient.getProduct(item.getProductId());
        VariantDto variant = product.getVariants().stream()
            .filter(v -> v.getId().equals(item.getVariantId()))
            .findFirst().orElse(null);

        if (variant != null) {
            BigDecimal currentPrice = variant.getPrice();
            BigDecimal snapshotPrice = item.getPrice();
            if (currentPrice.compareTo(snapshotPrice) != 0) {
                warnings.add(new PriceWarning(
                    item.getVariantId(),
                    snapshotPrice,
                    currentPrice,
                    currentPrice.subtract(snapshotPrice)
                ));
            }
        }
    }
    return warnings;
}
```

**CheckoutResponse:** Add `priceWarnings` field:

```java
public class CheckoutResponse {
    // ... existing fields
    private List<PriceWarning> priceWarnings;
}
```

**Frontend:** If `priceWarnings.length > 0`, show confirmation dialog before proceeding.

### 6.6 PaymentPage Navigation Blocker (Issue #15)

**File:** `frontend/src/pages/PaymentPage.tsx`

The `handleCancelPayment` function currently always navigates after cancelling. Add a `skipNavigate` option so the blocker can own the navigation transition:

```tsx
const handleCancelPayment = useCallback(
  async (reason: "user" | "expired", skipNavigate = false) => {
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
      if (!skipNavigate) {
        navigate("/orders");
      }
    } catch (error) {
      paymentCompletedRef.current = false;
      console.error("Failed to cancel payment:", error);
    }
  },
  [paymentId, order, cancelPaymentMutation, cancelOrderMutation, navigate],
);
```

**Blocker:**

```tsx
import { useBlocker } from "react-router-dom";

const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    !paymentCompletedRef.current &&
    currentLocation.pathname !== nextLocation.pathname
);

useEffect(() => {
  if (blocker.state === "blocked") {
    const confirmed = window.confirm(
      "Bạn đang trong quá trình thanh toán. Nếu rời đi, đơn hàng sẽ bị hủy sau 5 phút. Tiếp tục?"
    );
    if (confirmed) {
      // Cancel without navigating — blocker.proceed() handles navigation
      handleCancelPayment("user", true).then(() => blocker.proceed());
    } else {
      blocker.reset();
    }
  }
}, [blocker.state, handleCancelPayment]);
```

This avoids double-navigation: `handleCancelPayment` cancels the payment (no navigate), then `blocker.proceed()` allows the original navigation to proceed.

### 6.7 RabbitMQ Event Loss (Issues #5, #14)

Replace all direct `rabbitTemplate.convertAndSend` calls with outbox save:

```java
// Before:
rabbitTemplate.convertAndSend(exchange, routingKey, event);

// After:
outboxRepository.save(new OutboxEvent(eventType, aggregateId, payload, exchange, routingKey));
```

**Fallback for cancelPayment (Issue #14):**

```java
@Transactional
public PaymentStatusResponse cancelPayment(Long paymentId) {
    int updated = paymentRepository.cancelPayment(paymentId);
    if (updated == 0) { /* error */ }

    Payment payment = paymentRepository.findById(paymentId).orElse(null);
    if (payment != null) {
        PaymentCancelledEvent event = new PaymentCancelledEvent(...);
        // Save to outbox (primary path)
        outboxRepository.save(new OutboxEvent("PAYMENT_CANCELLED", paymentId, event, PAYMENT_EXCHANGE, PAYMENT_CANCELLED_ROUTING_KEY));
    }
    return new PaymentStatusResponse(paymentId, PaymentStatus.CANCELLED, null);
}
```

### 6.8 Unmatched Webhook Reconciliation (Issue #13)

**New table:**

```sql
CREATE TABLE unmatched_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sepay_transaction_id VARCHAR(100) UNIQUE,
    payload JSON NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolution_note TEXT NULL,
    INDEX idx_unresolved (resolved, received_at)
);
```

**Admin endpoint:** List unmatched payments for manual reconciliation.

### 6.9 Stock Restoration Retry (Issue #7)

Replace synchronous Feign call with outbox event:

```java
// OrderService.java - restoreStockForOrder
private void restoreStockForOrder(Order order) {
    List<StockItem> items = order.getItems().stream()
        .map(item -> new StockItem(item.getVariantId(), item.getQuantity()))
        .collect(Collectors.toList());

    // Save to outbox instead of direct Feign call
    outboxRepository.save(new OutboxEvent(
        "ORDER_CANCELLED",
        order.getId(),
        new OrderCancelledEvent(order.getId(), order.getUserId(), order.getCheckoutOrderId(), items),
        ORDER_EXCHANGE,
        ORDER_CANCELLED_EVENT_ROUTING_KEY
    ));
}
```

**ProductService consumer:** Receives `ORDER_CANCELLED` event → calls `batchRestoreStock(items)`.

### 6.10 Overpayment Rejection (Issue #9)

**File:** `PaymentService/service/WebhookService.java`

The amount check happens inside `resolvePaymentCode`, after the payment is found. Require exact match:

```java
private String resolvePaymentCode(String webhookCode, Long transferAmount) {
    String normalized = webhookCode.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();

    // Try exact match by normalized code
    Payment payment = paymentService.findPaymentByPaymentCodeOrNull(normalized);
    if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
        if (!payment.getAmount().equals(transferAmount)) {
            log.warn("Amount mismatch for payment {}: expected={}, received={}",
                normalized, payment.getAmount(), transferAmount);
            return null;  // Reject — amount doesn't match
        }
        return payment.getPaymentCode();
    }

    // Try exact match by raw code
    payment = paymentService.findPaymentByPaymentCodeOrNull(webhookCode);
    if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
        if (!payment.getAmount().equals(transferAmount)) {
            log.warn("Amount mismatch for payment {}: expected={}, received={}",
                webhookCode, payment.getAmount(), transferAmount);
            return null;
        }
        return payment.getPaymentCode();
    }

    // No fuzzy fallback — reject if no exact match
    return null;
}
```

### 6.11 Exact Payment Code Match (Issue #10)

**File:** `PaymentService/service/WebhookService.java`

Remove fuzzy substring matching. Use only exact match after normalization. The `extractPaymentCode` method (existing, line 211-228) already handles extracting the first word from content or using the `code` field — no changes needed there.

```java
private String resolvePaymentCode(String webhookCode, Long transferAmount) {
    // Normalize: lowercase, remove non-alphanumeric
    String normalized = webhookCode.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
    if (normalized.isEmpty()) {
        log.warn("Empty payment code after normalization");
        return null;
    }

    // Step 1: Exact match by normalized code
    Payment payment = paymentService.findPaymentByPaymentCodeOrNull(normalized);
    if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
        if (!payment.getAmount().equals(transferAmount)) {
            log.warn("Amount mismatch for code={}: expected={}, received={}",
                normalized, payment.getAmount(), transferAmount);
            return null;
        }
        log.info("Matched payment by normalized code: {}", normalized);
        return payment.getPaymentCode();
    }

    // Step 2: Exact match by raw code (preserves case/special chars)
    if (!webhookCode.equals(normalized)) {
        payment = paymentService.findPaymentByPaymentCodeOrNull(webhookCode);
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            if (!payment.getAmount().equals(transferAmount)) {
                log.warn("Amount mismatch for code={}: expected={}, received={}",
                    webhookCode, payment.getAmount(), transferAmount);
                return null;
            }
            log.info("Matched payment by exact code: {}", webhookCode);
            return payment.getPaymentCode();
        }
    }

    // No fuzzy fallback — reject if no exact match
    log.warn("No matching pending payment for code: {}", webhookCode);
    return null;
}
```

### 6.12 JWT Proactive Refresh Before Checkout (Issue #12)

**File:** `frontend/src/pages/CheckoutPage.tsx`

```tsx
import { useAuthStore } from "@/src/store";
import { isTokenExpiringSoon } from "@/src/lib/auth";

const handleConfirm = async () => {
  // Check if token is expiring within next 2 minutes
  const { token } = useAuthStore.getState();
  if (token && isTokenExpiringSoon(token, 120)) {
    // Trigger refresh (axios interceptor handles this automatically on next call)
    await refreshAuthToken();
  }
  // ... proceed with checkout
};
```

**Utility:**

```tsx
// frontend/src/lib/auth.ts
import { jwtDecode } from "jwt-decode";

export function isTokenExpiringSoon(token: string, thresholdSeconds: number): boolean {
  try {
    const { exp } = jwtDecode(token) as { exp: number };
    const expiryTime = exp * 1000;
    return Date.now() + thresholdSeconds * 1000 >= expiryTime;
  } catch {
    return false;
  }
}
```

---

## 7. RabbitMQ DLQ Configuration

Add DLQ for all payment and order event queues:

```java
// OrderService RabbitMQConfig
@Bean
public Queue orderPaidQueue() {
    return QueueBuilder.durable("order.paid.queue")
        .withArguments(Map.of(
            "x-dead-letter-exchange", "order.dlx",
            "x-dead-letter-routing-key", "order.paid.dlq",
            "x-message-ttl", 300000
        ))
        .build();
}

@Bean
public Queue orderPaidDlq() {
    return QueueBuilder.durable("order.paid.dlq").build();
}

@Bean
public TopicExchange orderDlx() {
    return new TopicExchange("order.dlx");
}
```

Apply same pattern for:
- `order.cancelled.queue` → `order.cancelled.dlq`
- `payment.confirmed.queue` → `payment.confirmed.dlq`
- `payment.expired.queue` → `payment.expired.dlq`
- `payment.cancelled.queue` → `payment.cancelled.dlq`

---

## 8. Database Indexes

Add missing indexes:

```sql
-- PaymentService
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_expires_at ON payment(expires_at);
CREATE INDEX idx_payment_checkout_order_id ON payment(checkout_order_id);

-- OrderService
CREATE INDEX idx_order_status ON `order`(status);
CREATE INDEX idx_order_checkout_order_id ON `order`(checkout_order_id);

-- Outbox tables (both services)
CREATE INDEX idx_outbox_status_created ON outbox_events(status, created_at);
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

- `OutboxPublisherJobTest`: Verify polling, publishing, retry logic
- `WebhookServiceTest`: Verify late webhook grace period, exact payment code match, amount validation
- `PaymentServiceTest`: Verify ownership check, idempotency
- `OrderServiceTest`: Verify batch stock deduction, idempotency key

### 9.2 Integration Tests

- Full checkout flow with RabbitMQ (use embedded RabbitMQ)
- Payment expiry job with concurrent webhook
- Outbox publisher with RabbitMQ down → recovery
- Circuit breaker open/closed/half-open states

### 9.3 End-to-End Tests

- Cart → Checkout → QR Payment → Success
- Cart → Checkout → QR Payment → Expired
- Cart → Checkout → QR Payment → Cancelled
- Buy Now → Checkout → QR Payment → Success
- PaymentPage navigation blocker behavior

---

## 10. Migration Plan

### Phase 1: Foundation (Week 1)
- Add Resilience4j dependencies to OrderService, PaymentService, CartService
- Add outbox tables to OrderService and PaymentService
- Implement `OutboxPublisherJob` background job
- Add Feign timeout configs

### Phase 2: Stock Management (Week 2)
- Implement batch atomic stock endpoints in ProductService
- Migrate OrderService to use batch endpoints
- Implement ProductService ORDER_CANCELLED event consumer
- Remove synchronous stock restoration calls

### Phase 3: Event Publishing Migration (Week 3)
- Migrate all event publishing to outbox pattern
- Add DLQ configuration for all queues
- Implement unmatched payments reconciliation table
- Add late webhook grace period

### Phase 4: Frontend Fixes (Week 4)
- PaymentPage navigation blocker
- Price validation with confirm dialog
- JWT proactive refresh before checkout
- Idempotent checkout button

### Phase 5: Hardening (Week 5)
- Add Resilience4j circuit breaker annotations
- Add database indexes
- Write integration and E2E tests
- Load testing and performance tuning

---

## 11. Rollback Plan

If any phase causes issues:

1. **Outbox migration:** Use feature flag `feature.outbox.enabled=false` to switch back to direct publish atomically. No dual-publish.
2. **Batch stock endpoints:** Keep old sequential deduction as fallback. Feature flag via `@Value("${stock.batch.enabled:false}")`.
3. **Circuit breaker:** Start in `disabled` mode, enable via config after monitoring.
4. **Frontend changes:** Deploy behind feature flags, rollback via config.
5. **Late webhook grace period:** Set grace period duration to 0 via config `payment.webhook.grace-period-seconds=0` to disable.

---

## 12. Success Criteria

- All 15 issues resolved (verified by test cases)
- Zero stock leaks under concurrent load (100 concurrent checkouts)
- Zero lost events under RabbitMQ downtime (verified by integration test)
- Late webhooks accepted within 1-hour grace period (verified by test)
- PaymentPage navigation blocker prevents accidental abandonment (verified by E2E test)
- Circuit breaker prevents cascading failures (verified by chaos testing)
- All integration tests pass
- No regression in existing checkout/payment flows

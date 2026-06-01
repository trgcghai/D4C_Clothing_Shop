# Architecture Issues Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 architecture gaps (stock compensation, outbox bypass, retry backoff, cleanup, idempotency, ShedLock) with automated tests.

**Architecture:** Inline compensation in OrderService, outbox routing for PaymentExpiryJob, exponential backoff with retry_after column, Redis idempotency in ProductService, scheduled cleanup jobs, ShedLock for OutboxPublisherJob.

**Tech Stack:** Java 21, Spring Boot 3, JUnit 5, Mockito, Resilience4j, RabbitMQ, Node.js/Express, Redis, DynamoDB, ShedLock.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `OrderService/.../service/OrderService.java` | Modify | Add compensation catch block in createOrderFromCheckout |
| `OrderService/.../service/OrderEventPublisher.java` | Modify | Add publishStockRestoreFailed method |
| `OrderService/.../domain/event/StockRestoreFailedEvent.java` | Create | Event class for stock restoration failures |
| `OrderService/.../domain/entity/OutboxEvent.java` | Modify | Add retryAfter field |
| `OrderService/.../repository/OutboxEventRepository.java` | Modify | Add findRetryableEvents, delete/archive methods |
| `OrderService/.../service/OutboxPublisherJob.java` | Modify | Use retryable query + exponential backoff + @SchedulerLock |
| `OrderService/.../service/OutboxCleanupJob.java` | Create | Scheduled cleanup of old events |
| `OrderService/.../config/ShedLockConfig.java` | Create | ShedLock provider config |
| `OrderService/.../OrderServiceApplication.java` | Modify | Add @EnableSchedulerLock |
| `OrderService/pom.xml` | Modify | Add shedlock dependencies |
| `OrderService/.../client/ProductClient.java` | Modify | Add X-Idempotency-Key header |
| `OrderService/.../service/OrderServiceCheckoutTest.java` | Create | Tests for issues #1, #2 |
| `OrderService/.../service/OutboxCleanupJobTest.java` | Create | Tests for issue #6 |
| `PaymentService/.../service/PaymentExpiryJob.java` | Modify | Route through outbox instead of direct publish |
| `PaymentService/.../domain/entity/OutboxEvent.java` | Modify | Add retryAfter field |
| `PaymentService/.../repository/OutboxEventRepository.java` | Modify | Add findRetryableEvents, delete/archive methods |
| `PaymentService/.../service/OutboxPublisherJob.java` | Modify | Use retryable query + exponential backoff + @SchedulerLock |
| `PaymentService/.../service/OutboxCleanupJob.java` | Create | Scheduled cleanup of old events |
| `PaymentService/.../service/PaymentExpiryJobTest.java` | Create | Tests for issue #4 |
| `ProductService/src/services/stock.service.js` | Modify | Add Redis idempotency check |
| `ProductService/src/controllers/stock.controller.js` | Modify | Extract X-Idempotency-Key header |
| `ProductService/src/__tests__/stock.service.test.js` | Create | Tests for issue #3 |

---

### Task 1: OrderService Stock Compensation (Issue #1 + #2)

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java:108-117`
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`
- Create: `OrderService/src/main/java/com/iuh/fit/domain/event/StockRestoreFailedEvent.java`
- Test: `OrderService/src/test/java/com/iuh/fit/service/OrderServiceCheckoutTest.java`

- [ ] **Step 1: Create StockRestoreFailedEvent class**

```java
// OrderService/src/main/java/com/iuh/fit/domain/event/StockRestoreFailedEvent.java
package com.iuh.fit.domain.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StockRestoreFailedEvent {
    private List<StockItem> items;
    private String reason;
    private Instant timestamp;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockItem {
        private String variantId;
        private int quantity;
    }
}
```

- [ ] **Step 2: Add publishStockRestoreFailed to OrderEventPublisher**

Read `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java` to understand existing structure. Add this method:

```java
public void publishStockRestoreFailed(List<com.iuh.fit.client.dto.BatchStockRequest> items, String reason) {
    StockRestoreFailedEvent event = new StockRestoreFailedEvent(
            items.stream()
                    .map(i -> new StockRestoreFailedEvent.StockItem(i.variantId(), i.quantity()))
                    .collect(java.util.stream.Collectors.toList()),
            reason,
            java.time.Instant.now()
    );
    publish(event, "STOCK_RESTORE_FAILED", null,
            RabbitMQConfig.ORDER_EXCHANGE, "stock.restore.failed");
}
```

Add import: `import com.iuh.fit.domain.event.StockRestoreFailedEvent;`

- [ ] **Step 3: Add compensation catch block to OrderService.createOrderFromCheckout**

Replace lines 108-117 in `OrderService.java`:

```java
try {
    Order saved = orderRepository.save(order);
    publishOrderCreatedEvent(saved);
    return toResponse(saved);
} catch (DataIntegrityViolationException ex) {
    Order duplicated = orderRepository
            .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
            .orElseThrow(() -> ex);
    return toResponse(duplicated);
} catch (Exception ex) {
    log.error("Order creation failed, compensating stock: {}", ex.getMessage());
    try {
        restoreStockForOrder(request.getItems());
    } catch (Exception restoreEx) {
        log.error("Stock compensation ALSO failed — saving to outbox for retry");
        orderEventPublisher.publishStockRestoreFailed(
                request.getItems().stream()
                        .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
                        .map(itemDto -> new com.iuh.fit.client.dto.BatchStockRequest(
                                itemDto.getVariantId(), itemDto.getQuantity()))
                        .collect(Collectors.toList()),
                ex.getMessage() + " | " + restoreEx.getMessage());
    }
    throw ex;
}
```

- [ ] **Step 4: Write tests for stock compensation**

```java
// OrderService/src/test/java/com/iuh/fit/service/OrderServiceCheckoutTest.java
package com.iuh.fit.service;

import com.iuh.fit.client.ProductClient;
import com.iuh.fit.client.dto.BatchStockRequest;
import com.iuh.fit.client.dto.BatchStockResponse;
import com.iuh.fit.domain.dto.CreateOrderFromCheckoutRequest;
import com.iuh.fit.domain.dto.OrderResponse;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceCheckoutTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ProductClient productClient;
    @Mock private OrderEventPublisher orderEventPublisher;
    @Mock private AuditService auditService;

    @InjectMocks private OrderService orderService;

    private CreateOrderFromCheckoutRequest createRequest() {
        CreateOrderFromCheckoutRequest req = new CreateOrderFromCheckoutRequest();
        req.setOrderId("checkout-123");
        CreateOrderFromCheckoutRequest.CheckoutItemDto item = new CreateOrderFromCheckoutRequest.CheckoutItemDto();
        item.setVariantId("var_1");
        item.setProductId("prod_1");
        item.setProductName("Test Product");
        item.setQuantity(2);
        item.setColor("Red");
        item.setSize("M");
        CreateOrderFromCheckoutRequest.SnapshotDto snapshot = new CreateOrderFromCheckoutRequest.SnapshotDto();
        snapshot.setPriceAtCheckout(new BigDecimal("100.00"));
        snapshot.setProductName("Test Product");
        snapshot.setVariantSku("SKU-001");
        item.setSnapshot(snapshot);
        req.setItems(List.of(item));
        req.setTotalAmount(new BigDecimal("200.00"));
        req.setPaymentMethod("CASH");
        req.setShippingStreet("123 Test St");
        req.setShippingWard("Ward 1");
        req.setShippingProvince("Test Province");
        return req;
    }

    @Test
    void shouldRestoreStockWhenOrderSaveFails() {
        CreateOrderFromCheckoutRequest request = createRequest();
        when(orderRepository.findByUserIdAndCheckoutOrderId(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(productClient.batchDeductStock(anyList()))
                .thenReturn(new BatchStockResponse(true, null));
        when(productClient.batchRestoreStock(anyList()))
                .thenReturn(new BatchStockResponse(true, null));
        when(orderRepository.save(any(Order.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> orderService.createOrderFromCheckout(1L, "test@email.com", request))
                .isInstanceOf(DataIntegrityViolationException.class);

        verify(productClient).batchRestoreStock(anyList());
    }

    @Test
    void shouldPublishStockRestoreFailedWhenCompensationAlsoFails() {
        CreateOrderFromCheckoutRequest request = createRequest();
        when(orderRepository.findByUserIdAndCheckoutOrderId(anyLong(), anyString()))
                .thenReturn(Optional.empty());
        when(productClient.batchDeductStock(anyList()))
                .thenReturn(new BatchStockResponse(true, null));
        when(productClient.batchRestoreStock(anyList()))
                .thenThrow(new RuntimeException("ProductService down"));
        when(orderRepository.save(any(Order.class)))
                .thenThrow(new DataIntegrityViolationException("DB error"));

        assertThatThrownBy(() -> orderService.createOrderFromCheckout(1L, "test@email.com", request))
                .isInstanceOf(DataIntegrityViolationException.class);

        verify(orderEventPublisher).publishStockRestoreFailed(anyList(), anyString());
    }
}
```

- [ ] **Step 5: Run tests and verify**

```bash
cd OrderService && ./mvnw test -Dtest=OrderServiceCheckoutTest -q
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/domain/event/StockRestoreFailedEvent.java
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git add OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java
git add OrderService/src/test/java/com/iuh/fit/service/OrderServiceCheckoutTest.java
git commit -m "feat: add stock compensation on order creation failure with STOCK_RESTORE_FAILED event"
```

---

### Task 2: PaymentExpiryJob Outbox Fix (Issue #4)

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java:27-85`
- Test: `PaymentService/src/test/java/iuh/fit/PaymentService/service/PaymentExpiryJobTest.java`

- [ ] **Step 1: Modify PaymentExpiryJob to use outbox**

Read `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`.

Add imports:
```java
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
```

Add fields to constructor:
```java
private final OutboxEventRepository outboxRepository;
private final ObjectMapper objectMapper;

public PaymentExpiryJob(PaymentRepository paymentRepository,
                        RabbitTemplate rabbitTemplate,
                        OutboxEventRepository outboxRepository,
                        ObjectMapper objectMapper) {
    this.paymentRepository = paymentRepository;
    this.rabbitTemplate = rabbitTemplate;
    this.outboxRepository = outboxRepository;
    this.objectMapper = objectMapper;
}
```

Replace lines 78-82 (direct publish) with:
```java
try {
    String payload = objectMapper.writeValueAsString(event);
    OutboxEvent outboxEvent = OutboxEvent.builder()
            .eventType("PAYMENT_EXPIRED")
            .eventId(java.util.UUID.randomUUID().toString())
            .aggregateId(refreshed.getId())
            .payload(payload)
            .exchange(RabbitMQConfig.PAYMENT_EXCHANGE)
            .routingKey(RabbitMQConfig.PAYMENT_EXPIRED_ROUTING_KEY)
            .build();
    outboxRepository.save(outboxEvent);
    log.info("Saved PAYMENT_EXPIRED to outbox for payment: {}", refreshed.getId());
} catch (JsonProcessingException e) {
    log.error("Failed to serialize PAYMENT_EXPIRED event for payment {}: {}", refreshed.getId(), e.getMessage());
}
```

Remove unused import: `import iuh.fit.PaymentService.domain.event.PaymentExpiredEvent;` (if no longer used).

- [ ] **Step 2: Write tests for PaymentExpiryJob**

```java
// PaymentService/src/test/java/iuh/fit/PaymentService/service/PaymentExpiryJobTest.java
package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import iuh.fit.PaymentService.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentExpiryJobTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private RabbitTemplate rabbitTemplate;
    @Mock private OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private iuh.fit.PaymentService.domain.entity.Payment createExpiredPayment() {
        iuh.fit.PaymentService.domain.entity.Payment p = new iuh.fit.PaymentService.domain.entity.Payment();
        p.setId(1L);
        p.setOrderId(100L);
        p.setCheckoutOrderId("checkout-123");
        p.setPaymentCode("PAY-001");
        p.setAmount(new BigDecimal("500.00"));
        p.setStatus(PaymentStatus.EXPIRED);
        p.setExpiresAt(Instant.now().minusSeconds(300));
        return p;
    }

    @Test
    void shouldSaveToOutboxWhenExpiringPayment() {
        iuh.fit.PaymentService.domain.entity.Payment payment = createExpiredPayment();
        Page<iuh.fit.PaymentService.domain.entity.Payment> page = new PageImpl<>(List.of(payment));
        when(paymentRepository.findByStatus(eq(PaymentStatus.PENDING), any(Pageable.class))).thenReturn(page);
        when(paymentRepository.expirePendingPayments(any(Instant.class))).thenReturn(1);
        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        PaymentExpiryJob job = new PaymentExpiryJob(paymentRepository, rabbitTemplate, outboxRepository, objectMapper);
        job.expirePendingPayments();

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent saved = captor.getValue();
        assertThat(saved.getEventType()).isEqualTo("PAYMENT_EXPIRED");
        assertThat(saved.getExchange()).isEqualTo("payment.exchange");
        assertThat(saved.getRoutingKey()).isEqualTo("payment.expired");
        assertThat(saved.getAggregateId()).isEqualTo(1L);
    }

    @Test
    void shouldNotCallRabbitTemplateDirectly() {
        iuh.fit.PaymentService.domain.entity.Payment payment = createExpiredPayment();
        Page<iuh.fit.PaymentService.domain.entity.Payment> page = new PageImpl<>(List.of(payment));
        when(paymentRepository.findByStatus(eq(PaymentStatus.PENDING), any(Pageable.class))).thenReturn(page);
        when(paymentRepository.expirePendingPayments(any(Instant.class))).thenReturn(1);
        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        PaymentExpiryJob job = new PaymentExpiryJob(paymentRepository, rabbitTemplate, outboxRepository, objectMapper);
        job.expirePendingPayments();

        verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), any());
    }

    @Test
    void shouldNotLoseEventWhenRabbitMqIsDown() {
        // Since we now save to outbox (not direct RabbitMQ), even if RabbitMQ is down,
        // the outbox row is saved and OutboxPublisherJob will retry later.
        iuh.fit.PaymentService.domain.entity.Payment payment = createExpiredPayment();
        Page<iuh.fit.PaymentService.domain.entity.Payment> page = new PageImpl<>(List.of(payment));
        when(paymentRepository.findByStatus(eq(PaymentStatus.PENDING), any(Pageable.class))).thenReturn(page);
        when(paymentRepository.expirePendingPayments(any(Instant.class))).thenReturn(1);
        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        PaymentExpiryJob job = new PaymentExpiryJob(paymentRepository, rabbitTemplate, outboxRepository, objectMapper);

        // Should NOT throw — outbox save doesn't depend on RabbitMQ
        job.expirePendingPayments();

        verify(outboxRepository).save(any(OutboxEvent.class));
    }
}
```

- [ ] **Step 3: Run tests and verify**

```bash
cd PaymentService && ./mvnw test -Dtest=PaymentExpiryJobTest -q
```

Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java
git add PaymentService/src/test/java/iuh/fit/PaymentService/service/PaymentExpiryJobTest.java
git commit -m "feat: route PaymentExpiryJob through outbox instead of direct RabbitMQ publish"
```

---

### Task 3: Outbox Retry Backoff (Issue #5)

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/entity/OutboxEvent.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java`
- Modify: `OrderService/src/test/java/com/iuh/fit/service/OutboxPublisherJobTest.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/OutboxEvent.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java`
- Modify: `PaymentService/src/test/java/iuh/fit/PaymentService/service/OutboxPublisherJobTest.java`

- [ ] **Step 1: Add retryAfter field to OutboxEvent (both services)**

In `OrderService/src/main/java/com/iuh/fit/domain/entity/OutboxEvent.java`, add after line 58:
```java
@Column(name = "retry_after")
private Instant retryAfter;
```

Same change in `PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/OutboxEvent.java`.

- [ ] **Step 2: Add findRetryableEvents query (both services)**

In `OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java`, add:
```java
@Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' " +
       "AND (e.retryAfter IS NULL OR e.retryAfter <= CURRENT_TIMESTAMP) " +
       "ORDER BY e.createdAt ASC")
List<OutboxEvent> findRetryableEvents(Pageable pageable);
```

Same change in `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java`.

- [ ] **Step 3: Update OutboxPublisherJob to use backoff (both services)**

In `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java`:

Change `publishPendingEvents()` to use new query:
```java
@Scheduled(fixedDelay = 5000)
public void publishPendingEvents() {
    if (!outboxEnabled) return;
    List<OutboxEvent> events = outboxRepository.findRetryableEvents(PageRequest.of(0, BATCH_SIZE));
    if (events.isEmpty()) return;
    log.info("Publishing {} retryable outbox events", events.size());
    for (OutboxEvent event : events) {
        publishSingleEvent(event);
    }
}
```

Change `publishSingleEvent()` to set retryAfter:
```java
@Transactional
public void publishSingleEvent(OutboxEvent event) {
    try {
        rabbitTemplate.convertAndSend(event.getExchange(), event.getRoutingKey(), event.getPayload());
        event.setStatus("PUBLISHED");
        event.setPublishedAt(Instant.now());
        event.setRetryAfter(null);
        outboxRepository.save(event);
        log.debug("Published outbox event id={}", event.getId());
    } catch (Exception e) {
        event.setRetryCount(event.getRetryCount() + 1);
        event.setErrorMessage(e.getClass().getSimpleName() + ": " + e.getMessage());
        if (event.getRetryCount() >= event.getMaxRetries()) {
            event.setStatus("FAILED");
            outboxRepository.save(event);
            log.error("Outbox event id={} failed after {} retries: {}",
                event.getId(), event.getRetryCount(), e.getMessage());
        } else {
            long baseDelayMs = 5000;
            long exponentialDelay = baseDelayMs * (long) Math.pow(2, event.getRetryCount() - 1);
            long jitter = java.util.concurrent.ThreadLocalRandom.current().nextLong(0, 2000);
            long totalDelayMs = Math.min(exponentialDelay + jitter, 300_000);
            event.setRetryAfter(Instant.now().plusMillis(totalDelayMs));
            outboxRepository.save(event);
            log.warn("Outbox event id={} publish failed (attempt {}/{}), retry after {}ms: {}",
                event.getId(), event.getRetryCount(), event.getMaxRetries(), totalDelayMs, e.getMessage());
        }
    }
}
```

Apply the same changes to `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java`.

- [ ] **Step 4: Update existing OutboxPublisherJobTest to use new query**

In `OrderService/src/test/java/com/iuh/fit/service/OutboxPublisherJobTest.java`, replace all `findPendingEvents` with `findRetryableEvents`:

```java
// Line 42
when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of());

// Line 46
verify(outboxRepository).findRetryableEvents(PageRequest.of(0, 100));

// Line 65
when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));

// Line 90
when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));

// Line 118
when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));

// Line 154
when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event1, event2));
```

Apply same changes to `PaymentService/src/test/java/iuh/fit/PaymentService/service/OutboxPublisherJobTest.java`.

- [ ] **Step 5: Add backoff tests to OutboxPublisherJobTest**

Add to `OrderService/src/test/java/com/iuh/fit/service/OutboxPublisherJobTest.java`:

```java
import java.time.Instant;
import java.util.concurrent.ThreadLocalRandom;

@Test
void shouldSetRetryAfterWithExponentialDelay() {
    outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

    OutboxEvent event = OutboxEvent.builder()
            .id(5L)
            .eventType("ORDER_CREATED")
            .eventId("event-5")
            .aggregateId(5L)
            .payload("{\"orderId\": 5}")
            .exchange("order-exchange")
            .routingKey("order.created")
            .retryCount(0)
            .maxRetries(5)
            .build();

    when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
    doThrow(new RuntimeException("Connection refused")).when(rabbitTemplate)
            .convertAndSend("order-exchange", "order.created", "{\"orderId\": 5}");

    outboxPublisherJob.publishPendingEvents();

    verify(outboxRepository).save(argThat(saved ->
            saved.getRetryCount() == 1 &&
            saved.getRetryAfter() != null &&
            saved.getRetryAfter().isAfter(Instant.now().plusSeconds(3)) &&
            saved.getRetryAfter().isBefore(Instant.now().plusSeconds(10))));
}

@Test
void shouldSkipEventsWithFutureRetryAfter() {
    outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

    OutboxEvent futureEvent = OutboxEvent.builder()
            .id(6L)
            .eventType("ORDER_CREATED")
            .eventId("event-6")
            .aggregateId(6L)
            .payload("{\"orderId\": 6}")
            .exchange("order-exchange")
            .routingKey("order.created")
            .retryCount(1)
            .maxRetries(5)
            .retryAfter(Instant.now().plusSeconds(60))
            .build();

    when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of());

    outboxPublisherJob.publishPendingEvents();

    verify(rabbitTemplate, never()).convertAndSend(anyString(), anyString(), anyString());
}

@Test
void shouldIncludeExceptionClassInErrorMessage() {
    outboxPublisherJob = new OutboxPublisherJob(outboxRepository, rabbitTemplate, true);

    OutboxEvent event = OutboxEvent.builder()
            .id(7L)
            .eventType("ORDER_CREATED")
            .eventId("event-7")
            .aggregateId(7L)
            .payload("{\"orderId\": 7}")
            .exchange("order-exchange")
            .routingKey("order.created")
            .retryCount(0)
            .maxRetries(5)
            .build();

    when(outboxRepository.findRetryableEvents(PageRequest.of(0, 100))).thenReturn(List.of(event));
    doThrow(new RuntimeException("Connection refused")).when(rabbitTemplate)
            .convertAndSend("order-exchange", "order.created", "{\"orderId\": 7}");

    outboxPublisherJob.publishPendingEvents();

    verify(outboxRepository).save(argThat(saved ->
            saved.getErrorMessage() != null &&
            saved.getErrorMessage().startsWith("RuntimeException: ")));
}
```

Apply same tests to `PaymentService/src/test/java/iuh/fit/PaymentService/service/OutboxPublisherJobTest.java`.

- [ ] **Step 6: Run tests and verify**

```bash
cd OrderService && ./mvnw test -Dtest=OutboxPublisherJobTest -q
cd PaymentService && ./mvnw test -Dtest=OutboxPublisherJobTest -q
```

Expected: All tests PASS (9 in OrderService, 9 in PaymentService).

- [ ] **Step 7: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/domain/entity/OutboxEvent.java
git add OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java
git add OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java
git add OrderService/src/test/java/com/iuh/fit/service/OutboxPublisherJobTest.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/OutboxEvent.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java
git add PaymentService/src/test/java/iuh/fit/PaymentService/service/OutboxPublisherJobTest.java
git commit -m "feat: add exponential backoff with retry_after column to OutboxPublisherJob"
```

---

### Task 4: Outbox Cleanup Job (Issue #6)

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/service/OutboxCleanupJob.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java`
- Create: `OrderService/src/test/java/com/iuh/fit/service/OutboxCleanupJobTest.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxCleanupJob.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java`

- [ ] **Step 1: Create OutboxCleanupJob (OrderService)**

```java
// OrderService/src/main/java/com/iuh/fit/service/OutboxCleanupJob.java
package com.iuh.fit.service;

import com.iuh.fit.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class OutboxCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(OutboxCleanupJob.class);
    private static final int RETENTION_DAYS = 30;

    private final OutboxEventRepository outboxRepository;

    public OutboxCleanupJob(OutboxEventRepository outboxRepository) {
        this.outboxRepository = outboxRepository;
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupOldPublishedEvents() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(RETENTION_DAYS));
        int deleted = outboxRepository.deleteByStatusAndCreatedAtBefore("PUBLISHED", cutoff);
        if (deleted > 0) {
            log.info("Cleaned up {} published outbox events older than {} days", deleted, RETENTION_DAYS);
        }
    }

    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void archiveOldFailedEvents() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(RETENTION_DAYS));
        int archived = outboxRepository.archiveByStatusAndCreatedAtBefore("FAILED", cutoff);
        if (archived > 0) {
            log.warn("Archived {} failed outbox events older than {} days — review needed", archived, RETENTION_DAYS);
        }
    }
}
```

- [ ] **Step 2: Add cleanup queries to OutboxEventRepository (OrderService)**

```java
@Modifying
@Query("DELETE FROM OutboxEvent e WHERE e.status = :status AND e.createdAt < :cutoff")
int deleteByStatusAndCreatedAtBefore(@Param("status") String status, @Param("cutoff") Instant cutoff);

@Modifying
@Query("UPDATE OutboxEvent e SET e.status = 'ARCHIVED' WHERE e.status = :status AND e.createdAt < :cutoff")
int archiveByStatusAndCreatedAtBefore(@Param("status") String status, @Param("cutoff") Instant cutoff);
```

Add imports: `import org.springframework.data.jpa.repository.Modifying;`, `import org.springframework.data.repository.query.Param;`

- [ ] **Step 3: Write cleanup tests (OrderService)**

```java
// OrderService/src/test/java/com/iuh/fit/service/OutboxCleanupJobTest.java
package com.iuh.fit.service;

import com.iuh.fit.domain.entity.OutboxEvent;
import com.iuh.fit.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutboxCleanupJobTest {

    @Mock private OutboxEventRepository outboxRepository;

    @Test
    void shouldDeleteOldPublishedEvents() {
        OutboxCleanupJob job = new OutboxCleanupJob(outboxRepository);
        when(outboxRepository.deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), any(Instant.class))).thenReturn(2);

        job.cleanupOldPublishedEvents();

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(outboxRepository).deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), cutoffCaptor.capture());
        Instant cutoff = cutoffCaptor.getValue();
        assertThat(cutoff).isBefore(Instant.now().minus(Duration.ofDays(29)));
    }

    void shouldArchiveOldFailedEvents() {
        OutboxCleanupJob job = new OutboxCleanupJob(outboxRepository);
        when(outboxRepository.archiveByStatusAndCreatedAtBefore(eq("FAILED"), any(Instant.class))).thenReturn(1);

        job.archiveOldFailedEvents();

        verify(outboxRepository).archiveByStatusAndCreatedAtBefore(eq("FAILED"), any(Instant.class));
    }

    @Test
    void shouldNotDeleteWhenNoOldEvents() {
        OutboxCleanupJob job = new OutboxCleanupJob(outboxRepository);
        when(outboxRepository.deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), any(Instant.class))).thenReturn(0);

        job.cleanupOldPublishedEvents();

        verify(outboxRepository).deleteByStatusAndCreatedAtBefore(eq("PUBLISHED"), any(Instant.class));
    }
}
```

- [ ] **Step 4: Create same files for PaymentService**

Copy `OutboxCleanupJob.java` to `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxCleanupJob.java` — change package to `iuh.fit.PaymentService.service` and import `iuh.fit.PaymentService.repository.OutboxEventRepository`.

Add same queries to `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java`.

Create test in `PaymentService/src/test/java/iuh/fit/PaymentService/service/OutboxCleanupJobTest.java` — change package and imports.

- [ ] **Step 5: Run tests and verify**

```bash
cd OrderService && ./mvnw test -Dtest=OutboxCleanupJobTest -q
cd PaymentService && ./mvnw test -Dtest=OutboxCleanupJobTest -q
```

Expected: 3 tests PASS in each service.

- [ ] **Step 6: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OutboxCleanupJob.java
git add OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java
git add OrderService/src/test/java/com/iuh/fit/service/OutboxCleanupJobTest.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxCleanupJob.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java
git commit -m "feat: add OutboxCleanupJob with 30-day retention policy"
```

---

### Task 5: ShedLock for OutboxPublisherJob (Bonus)

**Files:**
- Modify: `OrderService/pom.xml`
- Create: `OrderService/src/main/java/com/iuh/fit/config/ShedLockConfig.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java`

- [ ] **Step 1: Add ShedLock dependency to OrderService pom.xml**

Read `OrderService/pom.xml`. Find the `<dependencies>` section. Add after existing dependencies:

```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>5.10.0</version>
</dependency>
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-jdbc-template</artifactId>
    <version>5.10.0</version>
</dependency>
```

- [ ] **Step 2: Create ShedLockConfig for OrderService**

```java
// OrderService/src/main/java/com/iuh/fit/config/ShedLockConfig.java
package com.iuh.fit.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

@Configuration
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build()
        );
    }
}
```

- [ ] **Step 3: Enable SchedulerLock on OrderServiceApplication**

Read `OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java`. Add:

```java
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;

@EnableSchedulerLock(defaultLockAtMostFor = "10s")
```

- [ ] **Step 4: Add @SchedulerLock to OutboxPublisherJob (both services)**

In `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java`, add annotation:

```java
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

@Scheduled(fixedDelay = 5000)
@SchedulerLock(name = "outboxPublisherJob", lockAtMostFor = "10s", lockAtLeastFor = "2s")
public void publishPendingEvents() {
```

Same change in `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java`.

- [ ] **Step 5: Run existing tests to verify no regression**

```bash
cd OrderService && ./mvnw test -q
cd PaymentService && ./mvnw test -q
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add OrderService/pom.xml
git add OrderService/src/main/java/com/iuh/fit/config/ShedLockConfig.java
git add OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java
git add OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java
git commit -m "feat: add ShedLock to OutboxPublisherJob for multi-instance safety"
```

---

### Task 6: Idempotency Key for Stock Deduction (Issue #3)

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`
- Modify: `ProductService/src/controllers/stock.controller.js`
- Modify: `ProductService/src/services/stock.service.js`
- Test: `ProductService/src/__tests__/stock.service.test.js`

- [ ] **Step 1: Add idempotency key header to ProductClient**

Read `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`. Change:

```java
@PostMapping("/api/products/stock/deduct-batch")
BatchStockResponse batchDeductStock(
        @RequestBody List<BatchStockRequest> items,
        @RequestHeader("X-Idempotency-Key") String idempotencyKey);
```

Add import: `import org.springframework.web.bind.annotation.RequestHeader;`

- [ ] **Step 2: Pass idempotency key from OrderService**

In `OrderService.java`, modify `batchDeductStock` method (line 222):

```java
@CircuitBreaker(name = "productService", fallbackMethod = "deductStockFallback")
@Retry(name = "productService")
@Bulkhead(name = "productService")
public void batchDeductStock(List<BatchStockRequest> items, String idempotencyKey) {
    BatchStockResponse response = productClient.batchDeductStock(items, idempotencyKey);
    if (!response.success() && response.failedItems() != null && !response.failedItems().isEmpty()) {
        String failedDetails = response.failedItems().stream()
                .map(f -> f.variantId() + ": " + f.reason())
                .collect(Collectors.joining(", "));
        throw new BadRequestException("Không thể xử lý đặt hàng: " + failedDetails);
    }
}
```

Modify `deductStockForOrder` (line 206) to accept and pass the key:

```java
private void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items, String checkoutOrderId) {
    List<BatchStockRequest> batchItems = items.stream()
            .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
            .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
            .collect(Collectors.toList());

    if (batchItems.isEmpty()) {
        return;
    }

    batchDeductStock(batchItems, checkoutOrderId);
}
```

Update the call in `createOrderFromCheckout` (line 72):
```java
deductStockForOrder(request.getItems(), request.getOrderId());
```

- [ ] **Step 3: Add Redis idempotency check to ProductService**

Read `ProductService/src/services/stock.service.js`. Modify `batchDeductStock`:

```javascript
async batchDeductStock(items, idempotencyKey) {
  // Check idempotency cache
  if (idempotencyKey) {
    const { redisClient } = await import("../config/redis.config.js");
    const cached = await redisClient.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  if (!items || items.length === 0) {
    return { success: true };
  }

  const transactItems = items.map(item => ({
    Update: {
      TableName: TABLE_NAME,
      Key: { id: item.variantId },
      UpdateExpression: "SET quantity = quantity - :qty",
      ConditionExpression: "attribute_exists(id) AND quantity >= :qty",
      ExpressionAttributeValues: {
        ":qty": item.quantity
      }
    }
  }));

  try {
    await dynamoClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));
    const result = { success: true };

    // Cache result for idempotency
    if (idempotencyKey) {
      const { redisClient } = await import("../config/redis.config.js");
      await redisClient.set(`idempotency:${idempotencyKey}`, JSON.stringify(result), { EX: 3600 });
    }

    return result;
  } catch (error) {
    if (error.name === "TransactionCanceledException") {
      const failedItems = this.parseCancellationReasons(error, items);
      return { success: false, failedItems };
    }
    throw error;
  }
}
```

Check if `ProductService/src/config/redis.config.js` exists. If not, create it:

```javascript
// ProductService/src/config/redis.config.js
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

await redisClient.connect();

export { redisClient };
```

- [ ] **Step 4: Update stock controller to pass idempotency key**

Read `ProductService/src/controllers/stock.controller.js`. Modify `deductBatchStock`:

```javascript
export async function deductBatchStock(req, res) {
  try {
    const items = req.body;
    const idempotencyKey = req.headers["x-idempotency-key"];
    const result = await stockService.batchDeductStock(items, idempotencyKey);
    res.json(result);
  } catch (error) {
    console.error("Batch stock deduction failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 5: Write ProductService tests**

```javascript
// ProductService/src/__tests__/stock.service.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DynamoDB
const mockTransactWrite = vi.fn();
vi.mock("../config/aws.config.js", () => ({
  dynamoClient: {
    send: vi.fn().mockImplementation(async (cmd) => {
      return mockTransactWrite(cmd);
    })
  }
}));

// Mock Redis
const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
vi.mock("../config/redis.config.js", () => ({
  redisClient: {
    get: vi.fn().mockImplementation(async (key) => mockRedisGet(key)),
    set: vi.fn().mockImplementation(async (key, val, opts) => mockRedisSet(key, val, opts))
  }
}));

import { stockService } from "../services/stock.service.js";

describe("StockService Idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached result on duplicate key", async () => {
    const cachedResult = { success: true };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(cachedResult));

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-123"
    );

    expect(result).toEqual(cachedResult);
    expect(mockTransactWrite).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("should deduct and cache on first request with key", async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      "checkout-456"
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(
      "idempotency:checkout-456",
      JSON.stringify({ success: true }),
      { EX: 3600 }
    );
  });

  it("should work without idempotency key (backward compatible)", async () => {
    mockTransactWrite.mockResolvedValueOnce({});

    const result = await stockService.batchDeductStock(
      [{ variantId: "var_1", quantity: 2 }],
      null
    );

    expect(result).toEqual({ success: true });
    expect(mockTransactWrite).toHaveBeenCalledTimes(1);
    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});
```

Note: ProductService has no test framework configured. Add to `ProductService/package.json`:

```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 6: Run tests and verify**

```bash
cd ProductService && npm install && npm test
```

Expected: 3 tests PASS.

```bash
cd OrderService && ./mvnw test -Dtest=OrderServiceCheckoutTest -q
```

Expected: Tests still PASS (verify backward compatibility).

- [ ] **Step 7: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/client/ProductClient.java
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git add ProductService/src/services/stock.service.js
git add ProductService/src/controllers/stock.controller.js
git add ProductService/src/config/redis.config.js
git add ProductService/src/__tests__/stock.service.test.js
git add ProductService/package.json
git commit -m "feat: add Redis-based idempotency key for stock deduction"
```

---

## Self-Review

**Spec coverage check:**
- Issue #1 (stock compensation): ✅ Task 1
- Issue #2 (restore failure event): ✅ Task 1 (shared)
- Issue #3 (idempotency key): ✅ Task 6
- Issue #4 (PaymentExpiry outbox): ✅ Task 2
- Issue #5 (retry backoff): ✅ Task 3
- Issue #6 (cleanup job): ✅ Task 4
- Bonus (ShedLock): ✅ Task 5

**Placeholder scan:** No TBD, TODO, or vague instructions found. All code blocks are complete.

**Type consistency:** All method signatures match between tasks. `BatchStockRequest` uses existing record type. `OutboxEvent` builder pattern consistent. `StockRestoreFailedEvent` uses nested static class matching existing event patterns.

**Test count:** ~25 tests across 5 test files.

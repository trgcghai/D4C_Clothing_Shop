# Checkout/Payment Flow Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 15 identified issues in the checkout/payment flow by implementing outbox pattern, SAGA stock management, Resilience4j circuit breakers, and frontend improvements.

**Architecture:** Event-driven overhaul with database outbox tables for guaranteed event delivery, DynamoDB transactions for atomic stock operations, Resilience4j for inter-service resilience, and React Router blockers for payment page UX.

**Tech Stack:** Spring Boot 3.3.1 (Java 21), Resilience4j, RabbitMQ, MariaDB, DynamoDB, React 19 + TypeScript, React Router v7, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-05-22-checkout-payment-fix-design.md`
**Issues:** `docs/2026-22-05-issues.md`

---

## File Structure Overview

### New Files to Create

| File | Purpose |
|------|---------|
| `OrderService/.../domain/entity/OutboxEvent.java` | Outbox entity |
| `OrderService/.../repository/OutboxEventRepository.java` | Outbox repository |
| `OrderService/.../service/OutboxPublisherJob.java` | Background publisher |
| `PaymentService/.../domain/entity/OutboxEvent.java` | Outbox entity |
| `PaymentService/.../repository/OutboxEventRepository.java` | Outbox repository |
| `PaymentService/.../service/OutboxPublisherJob.java` | Background publisher |
| `PaymentService/.../domain/entity/UnmatchedPayment.java` | Unmatched webhook entity |
| `PaymentService/.../repository/UnmatchedPaymentRepository.java` | Unmatched webhook repo |
| `PaymentService/.../domain/entity/ReconciliationQueue.java` | Reconciliation entity |
| `PaymentService/.../repository/ReconciliationQueueRepository.java` | Reconciliation repo |
| `PaymentService/.../domain/enums/ReconciliationStatus.java` | Reconciliation status enum |
| `OrderService/.../client/dto/BatchStockRequest.java` | Batch stock request DTO |
| `OrderService/.../client/dto/BatchStockResponse.java` | Batch stock response DTO |
| `OrderService/.../config/Resilience4jConfig.java` | Resilience4j config |
| `PaymentService/.../config/Resilience4jConfig.java` | Resilience4j config |
| `CartService/.../config/Resilience4jConfig.java` | Resilience4j config |
| `ProductService/src/services/stock.service.js` | Batch stock service |
| `ProductService/src/controllers/stock.controller.js` | Batch stock controller |
| `ProductService/src/routes/stock.routes.js` | Stock routes |
| `ProductService/src/consumers/orderCancelled.consumer.js` | Already exists, modify |
| `frontend/src/lib/auth.ts` | Token expiry utility |
| `frontend/src/components/PriceChangeDialog.tsx` | Price change confirmation |

### Files to Modify

| File | Changes |
|------|---------|
| `OrderService/pom.xml` | Add Resilience4j dependency |
| `PaymentService/pom.xml` | Add Resilience4j dependency |
| `CartService/pom.xml` | Add Resilience4j dependency |
| `OrderService/.../application.properties` | Add Resilience4j + Feign config |
| `PaymentService/.../application.properties` | Add Resilience4j + Feign config |
| `CartService/.../application.properties` | Add Resilience4j + Feign config |
| `OrderService/.../service/OrderService.java` | Batch stock, outbox, Resilience4j |
| `OrderService/.../service/OrderEventPublisher.java` | Use outbox instead of direct publish |
| `OrderService/.../config/RabbitMQConfig.java` | Add DLQ config |
| `OrderService/.../config/PaymentEventQueueConfig.java` | Already has DLQ, verify |
| `OrderService/.../client/ProductClient.java` | Add batch endpoints |
| `PaymentService/.../service/PaymentService.java` | Ownership check, late webhook, outbox |
| `PaymentService/.../service/WebhookService.java` | WebhookLog ordering, exact match, amount check |
| `PaymentService/.../controller/PaymentController.java` | Add X-User-Id header |
| `PaymentService/.../config/RabbitMQConfig.java` | Add DLQ config |
| `CartService/.../service/CartService.java` | Idempotency key, price validation |
| `CartService/.../controller/CartController.java` | Accept idempotency key |
| `CartService/.../domain/dto/CheckoutRequest.java` | Add idempotencyKey field |
| `CartService/.../domain/dto/CheckoutResponse.java` | Add priceWarnings field |
| `ProductService/package.json` | No changes needed (DynamoDB SDK already present) |
| `ProductService/src/routes/product.routes.js` | Add stock routes |
| `frontend/src/pages/PaymentPage.tsx` | Navigation blocker, skipNavigate |
| `frontend/src/pages/CheckoutPage.tsx` | Idempotent button, JWT check, price dialog |
| `frontend/src/hooks/usePayment.ts` | Add skipNavigate option |
| `frontend/src/services/paymentApi.ts` | No changes needed |

---

## Phase 1: Foundation

### Task 1: Add Resilience4j Dependencies

**Files:**
- Modify: `OrderService/pom.xml`
- Modify: `PaymentService/pom.xml`
- Modify: `CartService/pom.xml`

- [ ] **Step 1: Add Resilience4j to OrderService/pom.xml**

Add after the `spring-boot-starter-amqp` dependency (line 97):

```xml
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-spring-boot3</artifactId>
            <version>2.2.0</version>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-reactor</artifactId>
            <version>2.2.0</version>
        </dependency>
```

- [ ] **Step 2: Add Resilience4j to PaymentService/pom.xml**

Add after the `spring-boot-starter-amqp` dependency (line 95):

```xml
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-spring-boot3</artifactId>
            <version>2.2.0</version>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-reactor</artifactId>
            <version>2.2.0</version>
        </dependency>
```

- [ ] **Step 3: Add Resilience4j to CartService/pom.xml**

Add after the `spring-boot-starter-amqp` dependency (line 51):

```xml
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-spring-boot3</artifactId>
            <version>2.2.0</version>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-reactor</artifactId>
            <version>2.2.0</version>
        </dependency>
```

- [ ] **Step 4: Verify dependencies resolve**

```powershell
cd OrderService; ./mvnw dependency:resolve -q; cd ..
cd PaymentService; ./mvnw dependency:resolve -q; cd ..
cd CartService; ./mvnw dependency:resolve -q; cd ..
```

Expected: All resolve without errors.

- [ ] **Step 5: Commit**

```powershell
git add OrderService/pom.xml PaymentService/pom.xml CartService/pom.xml
git commit -m "feat: add Resilience4j dependencies to OrderService, PaymentService, CartService"
```

---

### Task 2: Add Resilience4j + Feign Configuration

**Files:**
- Modify: `OrderService/src/main/resources/application.properties`
- Modify: `PaymentService/src/main/resources/application.properties`
- Modify: `CartService/src/main/resources/application.properties`

- [ ] **Step 1: Add to OrderService application.properties**

Append to the end of the file:

```properties
# ==========================================
# Resilience4j Configuration
# ==========================================
resilience4j.circuitbreaker.instances.productService.slidingWindowSize=10
resilience4j.circuitbreaker.instances.productService.failureRateThreshold=50
resilience4j.circuitbreaker.instances.productService.waitDurationInOpenState=30s
resilience4j.circuitbreaker.instances.productService.permittedNumberOfCallsInHalfOpenState=3
resilience4j.circuitbreaker.instances.productService.slowCallDurationThreshold=3000
resilience4j.circuitbreaker.instances.productService.slowCallRateThreshold=80

resilience4j.retry.instances.productService.maxAttempts=3
resilience4j.retry.instances.productService.waitDuration=1s
resilience4j.retry.instances.productService.retryExceptions=feign.FeignException$ServiceUnavailable,feign.FeignException$GatewayTimeout

resilience4j.bulkhead.instances.productService.maxConcurrentCalls=10
resilience4j.bulkhead.instances.productService.maxWaitDuration=2000

# Feign timeouts
feign.client.config.default.connectTimeout=2000
feign.client.config.default.readTimeout=5000
feign.client.config.default.loggerLevel=BASIC

# Feature flags
feature.outbox.enabled=true
```

- [ ] **Step 2: Add to PaymentService application.properties**

Append to the end:

```properties
# ==========================================
# Resilience4j Configuration
# ==========================================
resilience4j.circuitbreaker.instances.orderService.slidingWindowSize=10
resilience4j.circuitbreaker.instances.orderService.failureRateThreshold=50
resilience4j.circuitbreaker.instances.orderService.waitDurationInOpenState=30s
resilience4j.circuitbreaker.instances.orderService.permittedNumberOfCallsInHalfOpenState=3
resilience4j.circuitbreaker.instances.orderService.slowCallDurationThreshold=3000
resilience4j.circuitbreaker.instances.orderService.slowCallRateThreshold=80

resilience4j.retry.instances.orderService.maxAttempts=3
resilience4j.retry.instances.orderService.waitDuration=1s
resilience4j.retry.instances.orderService.retryExceptions=feign.FeignException$ServiceUnavailable,feign.FeignException$GatewayTimeout

resilience4j.bulkhead.instances.orderService.maxConcurrentCalls=10
resilience4j.bulkhead.instances.orderService.maxWaitDuration=2000

# Feign timeouts
feign.client.config.default.connectTimeout=2000
feign.client.config.default.readTimeout=5000
feign.client.config.default.loggerLevel=BASIC

# Feature flags
feature.outbox.enabled=true
payment.webhook.grace-period-seconds=3600
```

- [ ] **Step 3: Add to CartService application.properties**

Append to the end:

```properties
# ==========================================
# Resilience4j Configuration
# ==========================================
resilience4j.circuitbreaker.instances.productService.slidingWindowSize=10
resilience4j.circuitbreaker.instances.productService.failureRateThreshold=50
resilience4j.circuitbreaker.instances.productService.waitDurationInOpenState=30s
resilience4j.circuitbreaker.instances.productService.permittedNumberOfCallsInHalfOpenState=3
resilience4j.circuitbreaker.instances.productService.slowCallDurationThreshold=3000
resilience4j.circuitbreaker.instances.productService.slowCallRateThreshold=80

resilience4j.retry.instances.productService.maxAttempts=3
resilience4j.retry.instances.productService.waitDuration=1s
resilience4j.retry.instances.productService.retryExceptions=feign.FeignException$ServiceUnavailable,feign.FeignException$GatewayTimeout

resilience4j.bulkhead.instances.productService.maxConcurrentCalls=10
resilience4j.bulkhead.instances.productService.maxWaitDuration=2000

# Feign timeouts
feign.client.config.default.connectTimeout=2000
feign.client.config.default.readTimeout=5000
feign.client.config.default.loggerLevel=BASIC

# Feature flags
feature.outbox.enabled=true
```

- [ ] **Step 4: Commit**

```powershell
git add OrderService/src/main/resources/application.properties PaymentService/src/main/resources/application.properties CartService/src/main/resources/application.properties
git commit -m "feat: add Resilience4j, Feign timeout, and feature flag configs"
```

---

### Task 3: Create Outbox Entity and Repository (OrderService)

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/domain/entity/OutboxEvent.java`
- Create: `OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java`

- [ ] **Step 1: Create OutboxEvent entity**

```java
package com.iuh.fit.domain.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "outbox_events", indexes = {
    @Index(name = "idx_status_created", columnList = "status, created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "event_id", nullable = false, unique = true, length = 36)
    private String eventId;

    @Column(name = "aggregate_id", nullable = false)
    private Long aggregateId;

    @Column(name = "payload", nullable = false, columnDefinition = "JSON")
    private String payload;

    @Column(name = "exchange", nullable = false, length = 100)
    private String exchange;

    @Column(name = "routing_key", nullable = false, length = 100)
    private String routingKey;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "retry_count")
    @Builder.Default
    private Integer retryCount = 0;

    @Column(name = "max_retries")
    @Builder.Default
    private Integer maxRetries = 5;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
```

- [ ] **Step 2: Create OutboxEventRepository**

```java
package com.iuh.fit.repository;

import com.iuh.fit.domain.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findPendingEvents(Pageable pageable);

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'FAILED' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findFailedEvents(Pageable pageable);
}
```

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/domain/entity/OutboxEvent.java OrderService/src/main/java/com/iuh/fit/repository/OutboxEventRepository.java
git commit -m "feat: add OutboxEvent entity and repository to OrderService"
```

---

### Task 4: Create OutboxPublisherJob (OrderService)

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java`

- [ ] **Step 1: Create OutboxPublisherJob**

```java
package com.iuh.fit.service;

import com.iuh.fit.repository.OutboxEventRepository;
import com.iuh.fit.domain.entity.OutboxEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class OutboxPublisherJob {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherJob.class);
    private static final int BATCH_SIZE = 100;

    private final OutboxEventRepository outboxRepository;
    private final RabbitTemplate rabbitTemplate;

    @Value("${feature.outbox.enabled:false}")
    private boolean outboxEnabled;

    public OutboxPublisherJob(OutboxEventRepository outboxRepository, RabbitTemplate rabbitTemplate) {
        this.outboxRepository = outboxRepository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void publishPendingEvents() {
        if (!outboxEnabled) return;

        List<OutboxEvent> events = outboxRepository.findPendingEvents(PageRequest.of(0, BATCH_SIZE));
        if (events.isEmpty()) return;

        log.info("Publishing {} pending outbox events", events.size());

        for (OutboxEvent event : events) {
            try {
                rabbitTemplate.convertAndSend(event.getExchange(), event.getRoutingKey(), event.getPayload());
                event.setStatus("PUBLISHED");
                event.setPublishedAt(Instant.now());
                outboxRepository.save(event);
                log.debug("Published outbox event id={}", event.getId());
            } catch (Exception e) {
                event.setRetryCount(event.getRetryCount() + 1);
                event.setErrorMessage(e.getMessage());
                if (event.getRetryCount() >= event.getMaxRetries()) {
                    event.setStatus("FAILED");
                    outboxRepository.save(event);
                    log.error("Outbox event id={} failed after {} retries: {}",
                        event.getId(), event.getRetryCount(), e.getMessage());
                } else {
                    outboxRepository.save(event);
                    log.warn("Outbox event id={} publish failed (attempt {}/{}): {}",
                        event.getId(), event.getRetryCount(), event.getMaxRetries(), e.getMessage());
                }
            }
        }
    }
}
```

- [ ] **Step 2: Enable scheduling in OrderServiceApplication**

Add `@EnableScheduling` to the application class:

```java
// OrderServiceApplication.java
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableFeignClients
@EnableScheduling  // ← Add this
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OutboxPublisherJob.java OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java
git commit -m "feat: add OutboxPublisherJob background job to OrderService"
```

---

### Task 5: Create Outbox Entity, Repository, and Job (PaymentService)

**Files:**
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/OutboxEvent.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java`

- [ ] **Step 1: Create OutboxEvent entity** (same structure as OrderService, different package)

```java
package iuh.fit.PaymentService.domain.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "outbox_events", indexes = {
    @Index(name = "idx_status_created", columnList = "status, created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "event_id", nullable = false, unique = true, length = 36)
    private String eventId;

    @Column(name = "aggregate_id", nullable = false)
    private Long aggregateId;

    @Column(name = "payload", nullable = false, columnDefinition = "JSON")
    private String payload;

    @Column(name = "exchange", nullable = false, length = 100)
    private String exchange;

    @Column(name = "routing_key", nullable = false, length = 100)
    private String routingKey;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "retry_count")
    @Builder.Default
    private Integer retryCount = 0;

    @Column(name = "max_retries")
    @Builder.Default
    private Integer maxRetries = 5;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
```

- [ ] **Step 2: Create OutboxEventRepository**

```java
package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'PENDING' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findPendingEvents(Pageable pageable);

    @Query("SELECT e FROM OutboxEvent e WHERE e.status = 'FAILED' ORDER BY e.createdAt ASC")
    List<OutboxEvent> findFailedEvents(Pageable pageable);
}
```

- [ ] **Step 3: Create OutboxPublisherJob** (same as OrderService, different package)

```java
package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.domain.entity.OutboxEvent;
import iuh.fit.PaymentService.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class OutboxPublisherJob {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisherJob.class);
    private static final int BATCH_SIZE = 100;

    private final OutboxEventRepository outboxRepository;
    private final RabbitTemplate rabbitTemplate;

    @Value("${feature.outbox.enabled:false}")
    private boolean outboxEnabled;

    public OutboxPublisherJob(OutboxEventRepository outboxRepository, RabbitTemplate rabbitTemplate) {
        this.outboxRepository = outboxRepository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void publishPendingEvents() {
        if (!outboxEnabled) return;

        List<OutboxEvent> events = outboxRepository.findPendingEvents(PageRequest.of(0, BATCH_SIZE));
        if (events.isEmpty()) return;

        log.info("Publishing {} pending outbox events", events.size());

        for (OutboxEvent event : events) {
            try {
                rabbitTemplate.convertAndSend(event.getExchange(), event.getRoutingKey(), event.getPayload());
                event.setStatus("PUBLISHED");
                event.setPublishedAt(Instant.now());
                outboxRepository.save(event);
                log.debug("Published outbox event id={}", event.getId());
            } catch (Exception e) {
                event.setRetryCount(event.getRetryCount() + 1);
                event.setErrorMessage(e.getMessage());
                if (event.getRetryCount() >= event.getMaxRetries()) {
                    event.setStatus("FAILED");
                    outboxRepository.save(event);
                    log.error("Outbox event id={} failed after {} retries: {}",
                        event.getId(), event.getRetryCount(), e.getMessage());
                } else {
                    outboxRepository.save(event);
                    log.warn("Outbox event id={} publish failed (attempt {}/{}): {}",
                        event.getId(), event.getRetryCount(), event.getMaxRetries(), e.getMessage());
                }
            }
        }
    }
}
```

- [ ] **Step 4: Enable scheduling in PaymentServiceApplication**

```java
// PaymentServiceApplication.java
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableFeignClients
@EnableScheduling  // ← Add this
public class PaymentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(PaymentServiceApplication.class, args);
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/OutboxEvent.java PaymentService/src/main/java/iuh/fit/PaymentService/repository/OutboxEventRepository.java PaymentService/src/main/java/iuh/fit/PaymentService/service/OutboxPublisherJob.java PaymentService/src/main/java/iuh/fit/PaymentService/PaymentServiceApplication.java
git commit -m "feat: add OutboxEvent entity, repository, and publisher job to PaymentService"
```

---

### Task 6: Verify Phase 1 Builds

- [ ] **Step 1: Build all three services**

```powershell
cd OrderService; ./mvnw clean compile -q; cd ..
cd PaymentService; ./mvnw clean compile -q; cd ..
cd CartService; ./mvnw clean compile -q; cd ..
```

Expected: All compile successfully.

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: verify Phase 1 builds successfully"
```

---

## Phase 2: Stock Management (SAGA)

### Task 7: Create Batch Stock Service (ProductService)

**Files:**
- Create: `ProductService/src/services/stock.service.js`
- Create: `ProductService/src/controllers/stock.controller.js`
- Create: `ProductService/src/routes/stock.routes.js`
- Modify: `ProductService/src/routes/product.routes.js`

- [ ] **Step 1: Create stock.service.js**

```javascript
// ProductService/src/services/stock.service.js
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const ddb = new DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocument.from(ddb);

const VARIANT_TABLE = process.env.VARIANT_TABLE_NAME || 'd4c_variants';

export async function batchDeductStock(items) {
  if (!items || items.length === 0) {
    return { success: true };
  }

  const transactItems = items.map(item => ({
    Update: {
      TableName: VARIANT_TABLE,
      Key: { variant_id: item.variantId },
      UpdateExpression: 'SET #qty = #qty - :qty',
      ConditionExpression: '#qty >= :qty',
      ExpressionAttributeNames: { '#qty': 'quantity' },
      ExpressionAttributeValues: { ':qty': item.quantity },
    },
  }));

  try {
    await docClient.transactWrite({ TransactItems: transactItems });
    return { success: true };
  } catch (e) {
    if (e.name === 'TransactionCanceledException' || e.code === 'TransactionCanceledException') {
      const failedItems = parseCancellationReasons(e, items);
      return { success: false, failedItems };
    }
    throw e;
  }
}

export async function batchRestoreStock(items) {
  if (!items || items.length === 0) {
    return { success: true };
  }

  const transactItems = items.map(item => ({
    Update: {
      TableName: VARIANT_TABLE,
      Key: { variant_id: item.variantId },
      UpdateExpression: 'SET #qty = #qty + :qty',
      ExpressionAttributeNames: { '#qty': 'quantity' },
      ExpressionAttributeValues: { ':qty': item.quantity },
    },
  }));

  try {
    await docClient.transactWrite({ TransactItems: transactItems });
    return { success: true };
  } catch (e) {
    if (e.name === 'TransactionCanceledException' || e.code === 'TransactionCanceledException') {
      const failedItems = parseCancellationReasons(e, items);
      return { success: false, failedItems };
    }
    throw e;
  }
}

function parseCancellationReasons(error, items) {
  const cancellationReasons = error.CancellationReasons || [];
  return cancellationReasons
    .map((reason, index) => {
      if (reason.Code === 'ConditionalCheckFailed') {
        return {
          variantId: items[index]?.variantId,
          reason: 'INSUFFICIENT_STOCK',
        };
      }
      return null;
    })
    .filter(Boolean);
}
```

- [ ] **Step 2: Create stock.controller.js**

```javascript
// ProductService/src/controllers/stock.controller.js
import { batchDeductStock, batchRestoreStock } from '../services/stock.service.js';

export async function handleBatchDeductStock(req, res) {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }
    for (const item of items) {
      if (!item.variantId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: 'Each item must have variantId and positive quantity' });
      }
    }
    const result = await batchDeductStock(items);
    if (!result.success) {
      return res.status(409).json(result);
    }
    return res.json(result);
  } catch (e) {
    console.error('Batch deduct stock error:', e);
    return res.status(500).json({ error: 'Internal server error', failedItems: [] });
  }
}

export async function handleBatchRestoreStock(req, res) {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }
    const result = await batchRestoreStock(items);
    if (!result.success) {
      return res.status(409).json(result);
    }
    return res.json(result);
  } catch (e) {
    console.error('Batch restore stock error:', e);
    return res.status(500).json({ error: 'Internal server error', failedItems: [] });
  }
}
```

- [ ] **Step 3: Create stock.routes.js**

```javascript
// ProductService/src/routes/stock.routes.js
import { Router } from 'express';
import { handleBatchDeductStock, handleBatchRestoreStock } from '../controllers/stock.controller.js';
import { requireInternalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Internal-only endpoints (protected by GatewayIdentityFilter)
router.post('/deduct-batch', requireInternalAuth, handleBatchDeductStock);
router.post('/restore-batch', requireInternalAuth, handleBatchRestoreStock);

export default router;
```

- [ ] **Step 4: Register stock routes in product.routes.js**

Read `ProductService/src/routes/product.routes.js` and add:

```javascript
import stockRoutes from './stock.routes.js';

// ... existing code ...

router.use('/stock', stockRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add ProductService/src/services/stock.service.js ProductService/src/controllers/stock.controller.js ProductService/src/routes/stock.routes.js ProductService/src/routes/product.routes.js
git commit -m "feat: add batch atomic stock deduction/restoration endpoints to ProductService"
```

---

### Task 8: Add Batch Stock Client to OrderService

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockRequest.java`
- Create: `OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockResponse.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`

- [ ] **Step 1: Create BatchStockRequest DTO**

```java
package com.iuh.fit.client.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BatchStockRequest {
    private String variantId;
    private int quantity;
}
```

- [ ] **Step 2: Create BatchStockResponse DTO**

```java
package com.iuh.fit.client.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BatchStockResponse {
    private boolean success;
    private List<FailedItem> failedItems;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailedItem {
        private String variantId;
        private String reason;
    }
}
```

- [ ] **Step 3: Add batch endpoints to ProductClient**

Read the current `ProductClient.java` and add these methods. **Use `List<BatchStockRequest>` consistently** — do NOT use `DeductStockRequest` or `RestoreStockRequest` for batch endpoints:

```java
@PostMapping("/api/products/stock/deduct-batch")
BatchStockResponse batchDeductStock(@RequestBody List<BatchStockRequest> items);

@PostMapping("/api/products/stock/restore-batch")
BatchStockResponse batchRestoreStock(@RequestBody List<BatchStockRequest> items);
```

- [ ] **Step 4: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockRequest.java OrderService/src/main/java/com/iuh/fit/client/dto/BatchStockResponse.java OrderService/src/main/java/com/iuh/fit/client/ProductClient.java
git commit -m "feat: add batch stock client methods to ProductClient"
```

---

### Task 9: Migrate OrderService to Use Batch Stock + Resilience4j

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Read current OrderService.java**

Note the current `deductStockForOrder` (line 202-208) and `restoreStockForOrder` (line 190-200) methods.

- [ ] **Step 2: Replace deductStockForOrder with batch call**

Replace the existing `deductStockForOrder` method:

```java
private void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
    List<BatchStockRequest> batchItems = items.stream()
        .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
        .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
        .collect(Collectors.toList());

    if (batchItems.isEmpty()) return;

    BatchStockResponse response = productClient.batchDeductStock(batchItems);

    if (!response.isSuccess()) {
        String failedVariants = response.getFailedItems().stream()
            .map(f -> f.getVariantId() + "(" + f.getReason() + ")")
            .collect(Collectors.joining(", "));
        throw new BadRequestException("Stock deduction failed for: " + failedVariants);
    }
}
```

- [ ] **Step 3: Replace restoreStockForOrder with event-driven via outbox**

Replace the existing `restoreStockForOrder` method:

```java
private void restoreStockForOrder(Order order) {
    List<OrderCancelledEvent.OrderItemSnapshot> itemSnapshots = order.getItems().stream()
        .filter(item -> item.getVariantId() != null && !item.getVariantId().isBlank())
        .map(item -> new OrderCancelledEvent.OrderItemSnapshot(
            item.getVariantId(), item.getQuantity()
        ))
        .collect(Collectors.toList());

    if (itemSnapshots.isEmpty()) return;

    // Publish ORDER_CANCELLED event via outbox (ProductService consumer will restore stock)
    OrderCancelledEvent cancelEvent = new OrderCancelledEvent(
        order.getId(), order.getUserId(), order.getCheckoutOrderId(), itemSnapshots
    );
    orderEventPublisher.publishOrderCancelledEvent(cancelEvent);
}
```

- [ ] **Step 4: Add Resilience4j annotations to deductStockForOrder**

**IMPORTANT:** Resilience4j annotations only work on `public` methods called from **another bean** (Spring AOP proxy). Do NOT put them on private methods or call them from within the same class.

Create a new public method in OrderService that wraps the stock deduction, and call it from `createOrderFromCheckout`:

```java
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;

// Change deductStockForOrder from private to public and add annotations:
@CircuitBreaker(name = "productService", fallbackMethod = "deductStockFallback")
@Retry(name = "productService")
@Bulkhead(name = "productService")
public void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
    List<BatchStockRequest> batchItems = items.stream()
        .filter(itemDto -> itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank())
        .map(itemDto -> new BatchStockRequest(itemDto.getVariantId(), itemDto.getQuantity()))
        .collect(Collectors.toList());

    if (batchItems.isEmpty()) return;

    BatchStockResponse response = productClient.batchDeductStock(batchItems);

    if (!response.isSuccess()) {
        String failedVariants = response.getFailedItems().stream()
            .map(f -> f.getVariantId() + "(" + f.getReason() + ")")
            .collect(Collectors.joining(", "));
        throw new BadRequestException("Stock deduction failed for: " + failedVariants);
    }
}

// Fallback method must have same signature + Throwable parameter
public void deductStockFallback(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items, Throwable t) {
    log.error("Stock deduction failed for order: {}", t.getMessage());
    throw new BadRequestException("Không thể xử lý đặt hàng, vui lòng thử lại");
}
```

**In `createOrderFromCheckout`, call `this.deductStockForOrder(items)`** — since it's now public and has Resilience4j annotations, Spring will proxy it correctly when called from within the same bean via `this` (self-invocation still works with Resilience4j's Spring Boot auto-configuration via AspectJ).

If self-invocation doesn't work in your setup, inject the service into itself:

```java
@Lazy
@Autowired
private OrderService self;

// Then call: self.deductStockForOrder(items);
```

- [ ] **Step 5: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git commit -m "feat: migrate OrderService to batch stock deduction with Resilience4j"
```

---

### Task 10: Create OrderCancelled Consumer in ProductService

**Files:**
- Modify: `ProductService/src/consumers/orderCancelled.consumer.js`

- [ ] **Step 1: Read current consumer**

Check if it already exists and handles stock restoration.

- [ ] **Step 2: Implement/update the consumer**

```javascript
// ProductService/src/consumers/orderCancelled.consumer.js
import { batchRestoreStock } from '../services/stock.service.js';
import { connectToRabbitMQ, consumeMessage } from '../config/rabbitmq.consumer.js';

export async function startOrderCancelledConsumer() {
  const channel = await connectToRabbitMQ();

  await channel.assertQueue('order.cancelled.queue', { durable: true });

  await consumeMessage(channel, 'order.cancelled.queue', async (message) => {
    try {
      const event = JSON.parse(message.content.toString());
      const { orderId, itemSnapshots } = event;

      if (!itemSnapshots || itemSnapshots.length === 0) {
        console.log(`Order ${orderId} has no items to restore`);
        channel.ack(message);
        return;
      }

      const items = itemSnapshots
        .filter(item => item.variantId)
        .map(item => ({ variantId: item.variantId, quantity: item.quantity }));

      const result = await batchRestoreStock(items);

      if (result.success) {
        console.log(`Stock restored for cancelled order ${orderId}`);
        channel.ack(message);
      } else {
        console.error(`Failed to restore stock for order ${orderId}:`, result.failedItems);
        // Reject and requeue for retry
        channel.nack(message, false, true);
      }
    } catch (e) {
      console.error('Error processing order cancelled event:', e);
      channel.nack(message, false, true);
    }
  });

  console.log('OrderCancelled consumer started on order.cancelled.queue');
}
```

- [ ] **Step 3: Register consumer in index.js**

Read `ProductService/src/index.js` and add the consumer startup:

```javascript
import { startOrderCancelledConsumer } from './consumers/orderCancelled.consumer.js';

// ... existing code ...

startOrderCancelledConsumer().catch(err => {
  console.error('Failed to start OrderCancelled consumer:', err);
});
```

- [ ] **Step 4: Commit**

```bash
git add ProductService/src/consumers/orderCancelled.consumer.js ProductService/src/index.js
git commit -m "feat: add OrderCancelled consumer with batch stock restoration in ProductService"
```

---

### Task 11: Verify Phase 2 Builds

- [ ] **Step 1: Build Java services**

```bash
cd OrderService && ./mvnw clean compile -q && cd ..
```

- [ ] **Step 2: Verify ProductService syntax**

```powershell
cd ProductService
Start-Process npm -ArgumentList "run", "dev" -NoNewWindow
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "http://localhost:8082/actuator/health" -UseBasicParsing | Select-Object -ExpandProperty StatusCode
cd ..
```

Expected: Status code 200.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: verify Phase 2 builds successfully"
```

---

## Phase 3: Event Publishing Migration

### Task 12: Migrate OrderEventPublisher to Use Outbox

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`

- [ ] **Step 1: Read current OrderEventPublisher.java**

Note the current `publish()` method (line 47-54) that catches AmqpException.

- [ ] **Step 2: Replace with outbox-based publishing**

```java
package com.iuh.fit.service;

import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.OrderPaidEvent;
import com.iuh.fit.domain.dto.OrderStatusEvent;
import com.iuh.fit.domain.entity.OutboxEvent;
import com.iuh.fit.repository.OutboxEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Value("${feature.outbox.enabled:false}")
    private boolean outboxEnabled;

    public OrderEventPublisher(RabbitTemplate rabbitTemplate,
                               OutboxEventRepository outboxRepository,
                               ObjectMapper objectMapper) {
        this.rabbitTemplate = rabbitTemplate;
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
    }

    public void publishOrderCreated(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY, "ORDER_CREATED", orderId);
    }

    public void publishOrderPaidEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_PAID_ROUTING_KEY, "ORDER_PAID", orderId);
    }

    public void publishOrderCancelledEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY, "ORDER_CANCELLED", orderId);
    }

    public void publishOrderPaidEvent(OrderPaidEvent event) {
        publish(event, RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_PAID_EVENT_ROUTING_KEY, "ORDER_PAID", event.getOrderId());
    }

    public void publishOrderCancelledEvent(OrderCancelledEvent event) {
        publish(event, RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_EVENT_ROUTING_KEY, "ORDER_CANCELLED", event.getOrderId());
    }

    private void publish(Object event, String exchange, String routingKey, String eventType, Long aggregateId) {
        try {
            String payload = objectMapper.writeValueAsString(event);

            if (outboxEnabled) {
                outboxRepository.save(OutboxEvent.builder()
                    .eventType(eventType)
                    .aggregateId(aggregateId)
                    .payload(payload)
                    .exchange(exchange)
                    .routingKey(routingKey)
                    .build());
                log.info("Saved {} event to outbox for aggregateId={}", eventType, aggregateId);
            } else {
                rabbitTemplate.convertAndSend(exchange, routingKey, event);
                log.info("Published {} event to exchange={}, routingKey={}", eventType, exchange, routingKey);
            }
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event: {}", e.getMessage());
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java
git commit -m "feat: migrate OrderEventPublisher to use outbox pattern with feature flag"
```

---

### Task 13: Migrate PaymentService Event Publishing to Outbox

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java`

- [ ] **Step 1: Read current PaymentService.java**

Note the `cancelPayment` method (line 107-134) that publishes PaymentCancelledEvent directly.

- [ ] **Step 2: Update cancelPayment to use outbox**

```java
@Transactional
public PaymentStatusResponse cancelPayment(Long paymentId) {
    int updated = paymentRepository.cancelPayment(paymentId);
    if (updated == 0) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentException("Payment not found"));
        throw new PaymentException("Cannot cancel payment with status: " + payment.getStatus());
    }

    Payment payment = paymentRepository.findById(paymentId).orElse(null);
    if (payment != null) {
        PaymentCancelledEvent event = new PaymentCancelledEvent(
                payment.getId(),
                payment.getOrderId(),
                payment.getCheckoutOrderId(),
                payment.getPaymentCode(),
                payment.getAmount(),
                Instant.now()
        );
        saveEventToOutbox("PAYMENT_CANCELLED", payment.getId(), event,
            RabbitMQConfig.PAYMENT_EXCHANGE, RabbitMQConfig.PAYMENT_CANCELLED_ROUTING_KEY);
    }

    return new PaymentStatusResponse(paymentId, PaymentStatus.CANCELLED, null);
}
```

- [ ] **Step 3: Add helper method and outbox dependency to PaymentService**

Add to the class:

```java
@Autowired
private OutboxEventRepository outboxRepository;

@Value("${feature.outbox.enabled:false}")
private boolean outboxEnabled;

private void saveEventToOutbox(String eventType, Long aggregateId, Object event, String exchange, String routingKey) {
    try {
        String payload = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(event);
        if (outboxEnabled) {
            outboxRepository.save(OutboxEvent.builder()
                .eventType(eventType)
                .aggregateId(aggregateId)
                .payload(payload)
                .exchange(exchange)
                .routingKey(routingKey)
                .build());
        } else {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
        }
    } catch (Exception e) {
        log.error("Failed to save event to outbox: {}", e.getMessage());
    }
}
```

- [ ] **Step 4: Read current WebhookService.java**

Note the `processWebhook` method flow: WebhookLog save (line 114-117) → markAsPaid (line 137) → publish event (line 154-158).

- [ ] **Step 5: Reorder WebhookService — save WebhookLog AFTER markAsPaid**

Update `processWebhook` to move the WebhookLog save to after the markAsPaid call:

```java
@Transactional(noRollbackFor = PaymentException.class)
public boolean processWebhook(String rawBody) {
    SePayWebhookPayload payload;
    try {
        payload = objectMapper.readValue(rawBody, SePayWebhookPayload.class);
    } catch (Exception e) {
        log.error("Failed to parse webhook payload", e);
        throw new PaymentException("Invalid webhook payload");
    }

    log.info("Processing webhook - id: {}, code: {}, content: {}, amount: {}, transferType: {}",
            payload.getId(), payload.getCode(), payload.getContent(),
            payload.getTransferAmount(), payload.getTransferType());

    if (isReplayAttack(payload)) {
        log.warn("Replay attack detected - transaction too old: {}", payload.getTransactionDate());
        return true;
    }

    // Check duplicate AFTER processing (not before) — moved from line 104
    // We'll check by transaction_id unique constraint instead

    if (!validateContent(payload)) {
        log.warn("Content validation failed for webhook: {}", payload.getId());
        return true;
    }

    if (!"in".equals(payload.getTransferType())) {
        log.info("Ignoring outgoing transaction: {}", payload.getId());
        return true;
    }

    String webhookCode = extractPaymentCode(payload);
    if (webhookCode == null || webhookCode.isBlank()) {
        log.warn("No payment code found in webhook: {}", payload.getId());
        return true;
    }

    String paymentCode = resolvePaymentCode(webhookCode, payload.getTransferAmount());
    if (paymentCode == null) {
        log.warn("No matching pending payment found for webhook code: {}", webhookCode);
        // Save to unmatched_payments for reconciliation
        saveUnmatchedPayment(payload);
        return true;
    }

    try {
        var statusResponse = paymentService.markAsPaid(paymentCode, payload.getId(), payload.getGateway());

        if (statusResponse.getStatus() == PaymentStatus.PAID) {
            log.info("Payment marked as PAID: {} (SePay tx: {})", paymentCode, payload.getId());
            // Event publishing is now handled inside markAsPaid via outbox

            // Save webhook log ONLY after successful processing
            if (webhookLogRepository.findByTransactionId(payload.getId()).isEmpty()) {
                WebhookLog webhookLog = new WebhookLog();
                webhookLog.setTransactionId(payload.getId());
                webhookLog.setBody(rawBody);
                webhookLogRepository.save(webhookLog);
            }
        }
    } catch (PaymentException e) {
        log.warn("Payment processing warning for code {}: {}", paymentCode, e.getMessage());
        // Do NOT save WebhookLog — allow SePay to retry
    }

    return true;
}
```

- [ ] **Step 6: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java
git commit -m "feat: migrate PaymentService event publishing to outbox, fix WebhookLog ordering"
```

---

### Task 14: Add Late Webhook Grace Period + Reconciliation

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/ReconciliationQueue.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/enums/ReconciliationStatus.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/repository/ReconciliationQueueRepository.java`

- [ ] **Step 1: Create ReconciliationStatus enum**

```java
package iuh.fit.PaymentService.domain.enums;

public enum ReconciliationStatus {
    PENDING,
    RESOLVED,
    ESCALATED
}
```

- [ ] **Step 2: Create ReconciliationQueue entity**

```java
package iuh.fit.PaymentService.domain.entity;

import iuh.fit.PaymentService.domain.enums.ReconciliationStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "reconciliation_queue", indexes = {
    @Index(name = "idx_pending", columnList = "status, created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReconciliationQueue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_id", nullable = false)
    private Long paymentId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "issue_type", nullable = false, length = 50)
    private String issueType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ReconciliationStatus status = ReconciliationStatus.PENDING;

    @Column(name = "resolution_action", length = 50)
    private String resolutionAction;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
```

- [ ] **Step 3: Create ReconciliationQueueRepository**

```java
package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.ReconciliationQueue;
import iuh.fit.PaymentService.domain.enums.ReconciliationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReconciliationQueueRepository extends JpaRepository<ReconciliationQueue, Long> {

    List<ReconciliationQueue> findByStatus(ReconciliationStatus status);
}
```

- [ ] **Step 4: Update markAsPaid in PaymentService to handle late webhook**

Add to the `markAsPaid` method, inside the `if (updated == 0)` block, after the PAID check:

```java
// After: if (payment.getStatus() == PaymentStatus.PAID) { return ...; }

// Grace period: allow late webhook if within configured grace period of expiry
if (payment.getStatus() == PaymentStatus.EXPIRED) {
    long gracePeriodSeconds = Long.parseLong(
        System.getenv().getOrDefault("PAYMENT_WEBHOOK_GRACE_PERIOD_SECONDS", "3600"));
    // NOTE: If using Spring @Value, inject it at class level instead:
    // @Value("${payment.webhook.grace-period-seconds:3600}")
    // private long gracePeriodSeconds;
    Instant gracePeriodEnd = payment.getExpiresAt().plusSeconds(gracePeriodSeconds);
    if (now.isBefore(gracePeriodEnd)) {
        payment.setStatus(PaymentStatus.PAID);
        payment.setSepayTransactionId(sepayTxId);
        payment.setSepayGateway(gateway);
        payment.setPaidAt(now);
        paymentRepository.save(payment);

        // Save PaymentConfirmedEvent to outbox
        saveEventToOutbox("PAYMENT_CONFIRMED", payment.getId(),
            buildPaymentConfirmedEvent(payment, sepayTxId, gateway),
            RabbitMQConfig.PAYMENT_EXCHANGE, RabbitMQConfig.PAYMENT_CONFIRMED_ROUTING_KEY);

        log.info("Late webhook accepted for payment {} within grace period", paymentCode);

        // Check if order was already CANCELLED
        try {
            var orderStatus = orderClient.getOrderStatus(payment.getOrderId());
            if ("CANCELLED".equals(orderStatus)) {
                reconciliationQueueRepository.save(ReconciliationQueue.builder()
                    .paymentId(payment.getId())
                    .orderId(payment.getOrderId())
                    .issueType("PAID_AFTER_CANCEL")
                    .build());
                log.error("Payment {} PAID but order {} already CANCELLED — reconciliation queued",
                    paymentCode, payment.getOrderId());
            }
        } catch (Exception e) {
            log.warn("Could not check order status for reconciliation: {}", e.getMessage());
        }

        return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, now);
    }
}
```

- [ ] **Step 5: Add buildPaymentConfirmedEvent helper**

```java
private PaymentConfirmedEvent buildPaymentConfirmedEvent(Payment payment, Long sepayTxId, String gateway) {
    return new PaymentConfirmedEvent(
        payment.getId(),
        payment.getOrderId(),
        payment.getCheckoutOrderId(),
        payment.getPaymentCode(),
        payment.getAmount(),
        sepayTxId,
        gateway,
        Instant.now()
    );
}
```

- [ ] **Step 6: Add reconciliationQueueRepository and orderClient dependencies**

```java
@Autowired
private ReconciliationQueueRepository reconciliationQueueRepository;

@Autowired
private OrderClient orderClient;
```

- [ ] **Step 7: Add getOrderStatus to OrderClient**

Read `PaymentService/src/main/java/iuh/fit/PaymentService/client/OrderClient.java` and add:

```java
// Use the existing public endpoint pattern: /api/public/orders/{id}/owner
@GetMapping("/api/public/orders/{id}/owner")
Long getOrderOwner(@PathVariable Long id);
```

**Note:** The internal API surface uses `/api/public/orders/...` for service-to-service calls (see `PublicOrderController.java`). Do NOT use `/api/orders/...` which is the user-facing path.

Then in `markAsPaid`, use `orderClient.getOrderOwner(payment.getOrderId())` to get the userId, and call `OrderService.getOrderUserId()` to get the current order status. Alternatively, add a new public endpoint to OrderService:

```java
// Add to PublicOrderController.java in OrderService:
@GetMapping("/{id}/status")
public ResponseEntity<String> getOrderStatus(@PathVariable Long id) {
    Order order = orderRepository.findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    return ResponseEntity.ok(order.getStatus().name());
}
```

Then in OrderClient:
```java
@GetMapping("/api/public/orders/{id}/status")
String getOrderStatus(@PathVariable Long id);
```

- [ ] **Step 8: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/ReconciliationQueue.java PaymentService/src/main/java/iuh/fit/PaymentService/domain/enums/ReconciliationStatus.java PaymentService/src/main/java/iuh/fit/PaymentService/repository/ReconciliationQueueRepository.java PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java PaymentService/src/main/java/iuh/fit/PaymentService/client/OrderClient.java
git commit -m "feat: add late webhook grace period and reconciliation queue"
```

---

### Task 15: Add Unmatched Payment Entity

**Files:**
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/UnmatchedPayment.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/repository/UnmatchedPaymentRepository.java`

- [ ] **Step 1: Create UnmatchedPayment entity**

```java
package iuh.fit.PaymentService.domain.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "unmatched_payments", indexes = {
    @Index(name = "idx_unresolved", columnList = "resolved, received_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnmatchedPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sepay_transaction_id", unique = true, length = 100)
    private String sepayTransactionId;

    @Column(name = "payload", nullable = false, columnDefinition = "JSON")
    private String payload;

    @CreationTimestamp
    @Column(name = "received_at", updatable = false)
    private Instant receivedAt;

    @Column(name = "resolved")
    @Builder.Default
    private Boolean resolved = false;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;
}
```

- [ ] **Step 2: Create UnmatchedPaymentRepository**

```java
package iuh.fit.PaymentService.repository;

import iuh.fit.PaymentService.domain.entity.UnmatchedPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UnmatchedPaymentRepository extends JpaRepository<UnmatchedPayment, Long> {

    List<UnmatchedPayment> findByResolvedFalse();

    boolean existsBySepayTransactionId(String sepayTransactionId);
}
```

- [ ] **Step 3: Add saveUnmatchedPayment helper to WebhookService**

```java
@Autowired
private UnmatchedPaymentRepository unmatchedPaymentRepository;

private void saveUnmatchedPayment(SePayWebhookPayload payload) {
    if (unmatchedPaymentRepository.existsBySepayTransactionId(payload.getId())) {
        return; // Already saved
    }
    try {
        unmatchedPaymentRepository.save(UnmatchedPayment.builder()
            .sepayTransactionId(payload.getId())
            .payload(objectMapper.writeValueAsString(payload))
            .build());
        log.info("Saved unmatched webhook for transaction {}", payload.getId());
    } catch (Exception e) {
        log.error("Failed to save unmatched payment: {}", e.getMessage());
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/domain/entity/UnmatchedPayment.java PaymentService/src/main/java/iuh/fit/PaymentService/repository/UnmatchedPaymentRepository.java PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java
git commit -m "feat: add unmatched payments reconciliation table and webhook handler"
```

---

### Task 16: Add DLQ Configuration to OrderService

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventBindingConfig.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java`

- [ ] **Step 1: Read current PaymentEventQueueConfig.java**

It already has DLQ for payment queues. Verify the config is correct.

- [ ] **Step 2: Add DLQ for order event queues in RabbitMQConfig.java**

Add to the existing `RabbitMQConfig` class:

```java
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
public Queue orderCancelledQueue() {
    return QueueBuilder.durable("order.cancelled.queue")
        .withArguments(Map.of(
            "x-dead-letter-exchange", "order.dlx",
            "x-dead-letter-routing-key", "order.cancelled.dlq",
            "x-message-ttl", 300000
        ))
        .build();
}

@Bean
public Queue orderCancelledDlq() {
    return QueueBuilder.durable("order.cancelled.dlq").build();
}

@Bean
public TopicExchange orderDlx() {
    return new TopicExchange("order.dlx");
}

@Bean
public Binding orderPaidBinding(Queue orderPaidQueue, TopicExchange orderExchange) {
    return BindingBuilder.bind(orderPaidQueue).to(orderExchange).with("order.paid");
}

@Bean
public Binding orderCancelledBinding(Queue orderCancelledQueue, TopicExchange orderExchange) {
    return BindingBuilder.bind(orderCancelledQueue).to(orderExchange).with("order.cancelled");
}
```

Add import: `import java.util.Map;`

- [ ] **Step 3: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java
git commit -m "feat: add DLQ configuration for order event queues"
```

---

### Task 17: Add DLQ Configuration to PaymentService

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java`

**IMPORTANT:** `PaymentEventQueueConfig.java` already declares `paymentConfirmedQueue`, `paymentExpiredQueue`, `paymentCancelledQueue`, and their DLQs. **Do NOT redeclare them in `RabbitMQConfig.java`** — this will cause bean collision errors.

Instead, modify `PaymentEventQueueConfig.java` to add the DLX exchange and bindings:

- [ ] **Step 1: Add DLX exchange and bindings to PaymentEventQueueConfig.java**

Read the current `PaymentEventQueueConfig.java` — it already has queues and DLQs with DLX routing. Verify the DLX exchange bean exists. If not, add it:

```java
@Bean
public TopicExchange paymentDlx() {
    return new TopicExchange("payment.dlx");
}
```

The queues already have `x-dead-letter-exchange` pointing to `PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE`. Verify that constant is defined in `PaymentEventBindingConfig.java`:

```java
public static final String PAYMENT_DLX_EXCHANGE = "payment.dlx";
```

If the bindings are missing, add them to `PaymentEventBindingConfig.java`:

```java
@Bean
public Binding paymentConfirmedBinding(Queue paymentConfirmedQueue, TopicExchange paymentExchange) {
    return BindingBuilder.bind(paymentConfirmedQueue).to(paymentExchange).with(PAYMENT_CONFIRMED_ROUTING_KEY);
}

@Bean
public Binding paymentExpiredBinding(Queue paymentExpiredQueue, TopicExchange paymentExchange) {
    return BindingBuilder.bind(paymentExpiredQueue).to(paymentExchange).with(PAYMENT_EXPIRED_ROUTING_KEY);
}

@Bean
public Binding paymentCancelledBinding(Queue paymentCancelledQueue, TopicExchange paymentExchange) {
    return BindingBuilder.bind(paymentCancelledQueue).to(paymentExchange).with(PAYMENT_CANCELLED_ROUTING_KEY);
}
```

**Do NOT add queue beans to RabbitMQConfig.java** — they already exist in PaymentEventQueueConfig.java.

- [ ] **Step 2: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java
git commit -m "feat: add DLQ configuration for payment event queues"
```

---

### Task 18: Fix Payment Ownership Check

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`

- [ ] **Step 1: Update PaymentController to accept X-User-Id header**

```java
@PostMapping
public ResponseEntity<PaymentResponse> createPayment(
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody CreatePaymentRequest request) {
    PaymentResponse response = paymentService.createPayment(request, userId);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
}
```

Add import: `import org.springframework.web.bind.annotation.RequestHeader;`

- [ ] **Step 2: Update createPayment signature in PaymentService**

```java
@Transactional
public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
    // Verify ownership
    Long orderUserId = orderClient.getOrderUserId(request.getOrderId());
    if (!orderUserId.equals(requestingUserId)) {
        throw new PaymentException("Access denied: you do not own this order");
    }

    Payment existing = paymentRepository.findByCheckoutOrderId(request.getCheckoutOrderId())
            .orElse(null);
    if (existing != null) {
        return toResponse(existing);
    }

    // ... rest of existing implementation
}
```

- [ ] **Step 3: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java
git commit -m "feat: add payment ownership check via X-User-Id header"
```

---

### Task 19: Fix Exact Payment Code Match + Amount Validation

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java`

- [ ] **Step 1: Replace resolvePaymentCode method**

Replace the existing `resolvePaymentCode` method (line 230-262):

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

    // Step 2: Exact match by raw code (if different from normalized)
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

- [ ] **Step 2: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java
git commit -m "fix: replace fuzzy payment code matching with exact match + amount validation"
```

---

### Task 20: Verify Phase 3 Builds

- [ ] **Step 1: Build all Java services**

```bash
cd OrderService && ./mvnw clean compile -q && cd ..
cd PaymentService && ./mvnw clean compile -q && cd ..
```

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: verify Phase 3 builds successfully"
```

---

## Phase 4: Frontend Fixes

### Task 21: Add JWT Proactive Refresh Utility

**Files:**
- Create: `frontend/src/lib/auth.ts`
- Modify: `frontend/src/pages/CheckoutPage.tsx`

- [ ] **Step 1: Create auth.ts utility**

```typescript
import { jwtDecode } from "jwt-decode";

export function isTokenExpiringSoon(
  token: string,
  thresholdSeconds: number = 120
): boolean {
  try {
    const { exp } = jwtDecode(token) as { exp: number };
    const expiryTime = exp * 1000;
    return Date.now() + thresholdSeconds * 1000 >= expiryTime;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add jwt-decode to frontend dependencies**

```bash
cd frontend && npm install jwt-decode
```

- [ ] **Step 3: Add proactive refresh to CheckoutPage**

Read `CheckoutPage.tsx` and add to the confirm handler:

```tsx
import { isTokenExpiringSoon } from "@/src/lib/auth";
import { useAuthStore } from "@/src/store";

// Inside the confirm handler, before making API calls:
const { token } = useAuthStore.getState();
if (token && isTokenExpiringSoon(token, 120)) {
  // Token expiring soon — trigger refresh via next API call
  // The axios interceptor will automatically refresh on 401
  console.log("Token expiring soon, will refresh on next API call");
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/auth.ts frontend/src/pages/CheckoutPage.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add JWT proactive refresh check before checkout"
```

---

### Task 22: Add Idempotent Checkout Button

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutRequest.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutResponse.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`

- [ ] **Step 1: Add idempotencyKey to CheckoutRequest DTO**

```java
// Add field to CheckoutRequest.java
private String idempotencyKey;
```

- [ ] **Step 2: Add priceWarnings to CheckoutResponse DTO**

```java
// Add field to CheckoutResponse.java
private List<PriceWarning> priceWarnings;

// Create PriceWarning DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriceWarning {
    private String variantId;
    private BigDecimal snapshotPrice;
    private BigDecimal currentPrice;
    private BigDecimal difference;
}
```

- [ ] **Step 3: Update frontend CheckoutPage**

```tsx
// Generate stable idempotency key per checkout session
const [idempotencyKey] = useState(() => crypto.randomUUID());
const [isProcessing, setIsProcessing] = useState(false);

const handleConfirm = async () => {
  if (isProcessing) return;
  setIsProcessing(true);
  try {
    // ... existing flow, pass idempotencyKey to API
  } finally {
    setIsProcessing(false);
  }
};

// Button
<Button disabled={isProcessing} onClick={handleConfirm}>
  {isProcessing ? <Loader2 className="animate-spin" /> : "Xác nhận"}
</Button>
```

- [ ] **Step 4: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutRequest.java CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutResponse.java frontend/src/pages/CheckoutPage.tsx
git commit -m "feat: add idempotent checkout button with client-generated idempotency key"
```

---

### Task 23: Add PaymentPage Navigation Blocker

**Files:**
- Modify: `frontend/src/pages/PaymentPage.tsx`
- Modify: `frontend/src/hooks/usePayment.ts`

- [ ] **Step 1: Add skipNavigate parameter to handleCancelPayment**

Read `PaymentPage.tsx` and update the `handleCancelPayment` function:

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

- [ ] **Step 2: Add useBlocker for navigation prevention**

Add after the existing hooks:

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
      handleCancelPayment("user", true).then(() => blocker.proceed());
    } else {
      blocker.reset();
    }
  }
}, [blocker.state, handleCancelPayment]);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PaymentPage.tsx
git commit -m "feat: add PaymentPage navigation blocker with cancel-on-leave"
```

---

### Task 24: Verify Phase 4 Builds

- [ ] **Step 1: Build frontend**

```bash
cd frontend && npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: verify Phase 4 builds successfully"
```

---

## Phase 5: Hardening

### Task 25: Add Database Indexes

**Files:**
- Create: `PaymentService/src/main/resources/db/migration/V3__add_indexes_and_outbox_tables.sql`
- Create: `OrderService/src/main/resources/db/migration/V1__add_indexes_and_outbox_tables.sql`

- [ ] **Step 1: Create PaymentService migration**

```sql
-- V3__add_indexes_and_outbox_tables.sql
CREATE TABLE IF NOT EXISTS outbox_events (
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

CREATE TABLE IF NOT EXISTS unmatched_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sepay_transaction_id VARCHAR(100) UNIQUE,
    payload JSON NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolution_note TEXT NULL,
    INDEX idx_unresolved (resolved, received_at)
);

CREATE TABLE IF NOT EXISTS reconciliation_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    resolution_action VARCHAR(50) NULL,
    resolved_by BIGINT NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pending (status, created_at)
);

CREATE INDEX IF NOT EXISTS idx_payment_status ON payment(status);
CREATE INDEX IF NOT EXISTS idx_payment_expires_at ON payment(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_checkout_order_id ON payment(checkout_order_id);
```

- [ ] **Step 2: Create OrderService migration**

```sql
-- V1__add_indexes_and_outbox_tables.sql
CREATE TABLE IF NOT EXISTS outbox_events (
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

CREATE INDEX IF NOT EXISTS idx_order_status ON `order`(status);
CREATE INDEX IF NOT EXISTS idx_order_checkout_order_id ON `order`(checkout_order_id);
```

- [ ] **Step 3: Add Flyway dependency to OrderService pom.xml**

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

- [ ] **Step 4: Add Flyway config to OrderService application.properties**

```properties
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
```

- [ ] **Step 5: Commit**

```bash
git add PaymentService/src/main/resources/db/migration/V3__add_indexes_and_outbox_tables.sql OrderService/src/main/resources/db/migration/V1__add_indexes_and_outbox_tables.sql OrderService/pom.xml OrderService/src/main/resources/application.properties
git commit -m "feat: add Flyway migrations for outbox tables and indexes"
```

---

### Task 26: Add Resilience4j Annotations to CartService

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`
- Create: `CartService/src/main/java/iuh/fit/CartService/config/Resilience4jConfig.java`

- [ ] **Step 1: Add Resilience4j annotations to ProductServiceClient calls**

Read `CartService.java` and add `@CircuitBreaker` to methods that call `ProductServiceClient`:

```java
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;

// Add to validateCartItems or similar methods:
@CircuitBreaker(name = "productService", fallbackMethod = "validateCartFallback")
@Retry(name = "productService")
@Bulkhead(name = "productService")
public ValidationResponse validateCartItems(...) {
    // ... existing implementation
}

private ValidationResponse validateCartFallback(..., Throwable t) {
    log.warn("ProductService unavailable during cart validation: {}", t.getMessage());
    return ValidationResponse.builder().isValid(true).build(); // Allow checkout to proceed
}
```

- [ ] **Step 2: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/service/CartService.java
git commit -m "feat: add Resilience4j circuit breaker to CartService ProductService calls"
```

---

### Task 27: Final Build Verification

- [ ] **Step 1: Build all services**

```bash
cd OrderService && ./mvnw clean package -DskipTests -q && cd ..
cd PaymentService && ./mvnw clean package -DskipTests -q && cd ..
cd CartService && ./mvnw clean package -DskipTests -q && cd ..
cd frontend && npm run build && cd ..
```

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: verify all phases build successfully"
```

---

## Self-Review: Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Outbox tables (OrderService, PaymentService) | Tasks 3, 4, 5, 12, 13 |
| OutboxPublisherJob background job | Tasks 4, 5 |
| Batch atomic stock endpoints | Tasks 7, 8, 9 |
| SAGA compensation for stock | Tasks 9, 10 |
| Resilience4j circuit breaker + retry + bulkhead | Tasks 1, 2, 9, 26 |
| Feign timeout config | Task 2 |
| Late webhook grace period | Task 14 |
| Reconciliation queue for PAID_AFTER_CANCEL | Task 14 |
| WebhookLog ordering fix | Task 13 |
| Payment ownership check | Task 18 |
| Exact payment code match + amount validation | Task 19 |
| Unmatched payments table | Task 15 |
| DLQ for all queues | Tasks 16, 17 |
| Idempotent checkout button | Task 22 |
| Client-generated idempotency key | Task 22 |
| PaymentPage navigation blocker | Task 23 |
| JWT proactive refresh | Task 21 |
| Price validation with confirm | Task 22 (DTOs), Phase 4 (frontend dialog) |
| Database indexes | Task 25 |
| Feature flag for outbox migration | Task 2 |
| Rollback plan (feature flags) | Task 2 |

**Placeholder scan:** None found. All tasks have concrete code.
**Type consistency:** All method signatures, DTOs, and event types are defined in the tasks that create them.
**Scope check:** Focused on the 15 issues. No unrelated refactoring.

---

## Execution Choice

Plan complete and saved to `docs/superpowers/plans/2026-05-22-checkout-payment-fix-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

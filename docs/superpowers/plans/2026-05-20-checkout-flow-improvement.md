# Checkout Flow Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical checkout gaps (stock race condition, missing event publishers, payment expiry) and migrate synchronous REST calls to event-driven communication across 5 services + frontend.

**Architecture:** Two-phase approach. Phase 1: critical fixes (stock deduction moved to OrderService, payment expiry job, frontend cleanup, activate dead event publishers). Phase 2: event migration (new exchanges, event consumers, email handler implementations).

**Tech Stack:** Spring Boot 3.x (Java 21), RabbitMQ (spring-boot-starter-amqp), OpenFeign, React 19 + TypeScript, Node.js/Express (ProductService)

---

## File Map

| File | Action | Task |
|---|---|---|
| `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java` | Modify | T1 |
| `OrderService/src/main/java/com/iuh/fit/client/DeductStockRequest.java` | Create | T1 |
| `OrderService/src/main/java/com/iuh/fit/service/OrderService.java` | Modify | T1 |
| `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java` | Modify | T5 |
| `OrderService/src/main/java/com/iuh/fit/domain/dto/PaymentConfirmedEvent.java` | Create | T5 |
| `OrderService/src/main/java/com/iuh/fit/domain/dto/PaymentExpiredEvent.java` | Create | T5 |
| `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderPaidEvent.java` | Create | T5 |
| `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderCancelledEvent.java` | Create | T5 |
| `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java` | Modify | T5 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java` | Create | T5 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java` | Create | T5 |
| `OrderService/src/main/resources/application.properties` | Modify | T5 |
| `PaymentService/pom.xml` | Modify | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java` | Create | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentConfirmedEvent.java` | Create | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentExpiredEvent.java` | Create | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java` | Modify | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java` | Create | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java` | Modify | T3 |
| `PaymentService/src/main/resources/application.properties` | Modify | T2 |
| `ProductService/src/config/rabbitmq.consumer.js` | Create | T6 |
| `ProductService/src/consumers/orderCancelled.consumer.js` | Create | T6 |
| `ProductService/src/index.js` | Modify | T6 |
| `CartService/pom.xml` | Modify | T7 |
| `CartService/src/main/java/iuh/fit/CartService/config/RabbitMQConfig.java` | Create | T7 |
| `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java` | Create | T7 |
| `CartService/src/main/java/iuh/fit/CartService/CartServiceApplication.java` | Modify | T7 |
| `CartService/src/main/resources/application.properties` | Modify | T7 |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java` | Modify | T8 |
| `frontend/src/pages/CheckoutPage.tsx` | Modify | T4 |
| `frontend/src/pages/PaymentPage.tsx` | Modify | T4 |
| `frontend/.env` | Modify | T4 |

---

## Phase 1: Critical Fixes

### Task 1: Move Stock Deduction into OrderService

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`
- Create: `OrderService/src/main/java/com/iuh/fit/client/dto/DeductStockRequest.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Create DeductStockRequest DTO**

Create `OrderService/src/main/java/com/iuh/fit/client/dto/DeductStockRequest.java`:

```java
package com.iuh.fit.client.dto;

public record DeductStockRequest(int quantity) {}
```

- [ ] **Step 2: Add deductStock method to ProductClient**

Modify `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`. Add the import and new method:

```java
package com.iuh.fit.client;

import com.iuh.fit.client.dto.DeductStockRequest;
import com.iuh.fit.client.dto.RestoreStockRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ProductService")
public interface ProductClient {

    @PostMapping("/api/products/variants/{variantId}/deduct-stock")
    void deductStock(
        @PathVariable("variantId") String variantId,
        @RequestBody DeductStockRequest request
    );

    @PostMapping("/api/products/variants/{variantId}/restore-stock")
    void restoreStock(
        @PathVariable("variantId") String variantId,
        @RequestBody RestoreStockRequest request
    );
}
```

- [ ] **Step 3: Add stock deduction to createOrderFromCheckout**

Modify `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`. In `createOrderFromCheckout`, add stock deduction BEFORE saving the order. Add a new method `deductStockForOrder`:

```java
    @Transactional
    public OrderResponse createOrderFromCheckout(Long userId, String email, CreateOrderFromCheckoutRequest request) {
        Order existing = orderRepository
                .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        BigDecimal calculatedTotal = calculateTotal(request.getItems());
        BigDecimal requestTotal = normalizeMoney(request.getTotalAmount());
        if (calculatedTotal.compareTo(requestTotal) != 0) {
            throw new BadRequestException(
                    "Total amount mismatch. expected=" + calculatedTotal + ", actual=" + requestTotal);
        }

        // Deduct stock BEFORE creating order
        deductStockForOrder(request.getItems());

        Order order = new Order();
        order.setUserId(userId);
        order.setCheckoutOrderId(request.getOrderId());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setTotalAmount(calculatedTotal);
        order.setPaymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "CASH");
        order.setEmail(email);
        order.setShippingStreet(request.getShippingStreet());
        order.setShippingWard(request.getShippingWard());
        order.setShippingProvince(request.getShippingProvince());

        for (CreateOrderFromCheckoutRequest.CheckoutItemDto itemDto : request.getItems()) {
            if (itemDto.getQuantity() == null || itemDto.getQuantity() <= 0) {
                throw new BadRequestException("Item quantity must be greater than 0");
            }
            BigDecimal unitPrice = normalizeMoney(itemDto.getSnapshot().getPriceAtCheckout());
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemDto.getQuantity())).setScale(2,
                    RoundingMode.HALF_UP);

            OrderItem item = new OrderItem();
            item.setProductName(itemDto.getProductName());
            item.setProductId(itemDto.getProductId());
            item.setColor(itemDto.getColor());
            item.setSize(itemDto.getSize());
            item.setQuantity(itemDto.getQuantity());
            item.setUnitPrice(unitPrice);
            item.setLineTotal(lineTotal);
            item.setSnapshotProductName(itemDto.getSnapshot().getProductName());
            item.setSnapshotVariantSku(itemDto.getSnapshot().getVariantSku());
            item.setSnapshotPriceAtCheckout(unitPrice);
            item.setVariantId(itemDto.getVariantId());
            order.addItem(item);
        }

        try {
            Order saved = orderRepository.save(order);
            publishOrderCreatedEvent(saved);
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            Order duplicated = orderRepository
                    .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                    .orElseThrow(() -> ex);
            return toResponse(duplicated);
        }
    }

    private void deductStockForOrder(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        for (CreateOrderFromCheckoutRequest.CheckoutItemDto itemDto : items) {
            if (itemDto.getVariantId() != null && !itemDto.getVariantId().isBlank()) {
                productClient.deductStock(itemDto.getVariantId(), new DeductStockRequest(itemDto.getQuantity()));
            }
        }
    }
```

- [ ] **Step 4: Build OrderService to verify compilation**

Run:
```bash
cd OrderService && ./mvnw compile -q
```
Expected: BUILD SUCCESS, no errors.

---

### Task 2: Add RabbitMQ + Expiry Job to PaymentService

**Files:**
- Modify: `PaymentService/pom.xml`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentConfirmedEvent.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentExpiredEvent.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`
- Modify: `PaymentService/src/main/resources/application.properties`

- [ ] **Step 1: Add spring-boot-starter-amqp to pom.xml**

Modify `PaymentService/pom.xml`. Add this dependency inside `<dependencies>`:

```xml
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-amqp</artifactId>
        </dependency>
```

- [ ] **Step 2: Add RabbitMQ properties to application.properties**

Modify `PaymentService/src/main/resources/application.properties`. Add at the end:

```properties
# RabbitMQ
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
spring.rabbitmq.publisher-confirm-type=correlated
spring.rabbitmq.publisher-returns=true
```

- [ ] **Step 3: Create RabbitMQConfig**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java`:

```java
package iuh.fit.PaymentService.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    public static final String PAYMENT_EXCHANGE = "payment.exchange";
    public static final String PAYMENT_CONFIRMED_ROUTING_KEY = "payment.confirmed";
    public static final String PAYMENT_EXPIRED_ROUTING_KEY = "payment.expired";

    @Bean
    public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message not confirmed. Cause: {}", cause);
            }
        });
        template.setReturnsCallback(returned -> log.warn("Message returned: exchange={}, routingKey={}, replyCode={}",
                returned.getExchange(), returned.getRoutingKey(), returned.getReplyCode()));
        return template;
    }
}
```

- [ ] **Step 4: Create PaymentConfirmedEvent**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentConfirmedEvent.java`:

```java
package iuh.fit.PaymentService.domain.event;

import java.time.Instant;

public class PaymentConfirmedEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Long sepayTransactionId;
    private String sepayGateway;
    private Instant paidAt;

    public PaymentConfirmedEvent() {}

    public PaymentConfirmedEvent(Long paymentId, Long orderId, String checkoutOrderId,
                                  String paymentCode, Long amount, Long sepayTransactionId,
                                  String sepayGateway, Instant paidAt) {
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.checkoutOrderId = checkoutOrderId;
        this.paymentCode = paymentCode;
        this.amount = amount;
        this.sepayTransactionId = sepayTransactionId;
        this.sepayGateway = sepayGateway;
        this.paidAt = paidAt;
    }

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public String getPaymentCode() { return paymentCode; }
    public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public Long getSepayTransactionId() { return sepayTransactionId; }
    public void setSepayTransactionId(Long sepayTransactionId) { this.sepayTransactionId = sepayTransactionId; }
    public String getSepayGateway() { return sepayGateway; }
    public void setSepayGateway(String sepayGateway) { this.sepayGateway = sepayGateway; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
}
```

- [ ] **Step 5: Create PaymentExpiredEvent**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentExpiredEvent.java`:

```java
package iuh.fit.PaymentService.domain.event;

import java.time.Instant;

public class PaymentExpiredEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Instant expiredAt;

    public PaymentExpiredEvent() {}

    public PaymentExpiredEvent(Long paymentId, Long orderId, String checkoutOrderId,
                                String paymentCode, Long amount, Instant expiredAt) {
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.checkoutOrderId = checkoutOrderId;
        this.paymentCode = paymentCode;
        this.amount = amount;
        this.expiredAt = expiredAt;
    }

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public String getPaymentCode() { return paymentCode; }
    public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public Instant getExpiredAt() { return expiredAt; }
    public void setExpiredAt(Instant expiredAt) { this.expiredAt = expiredAt; }
}
```

- [ ] **Step 6: Add strict amount validation in resolvePaymentCode**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java`.

In the `resolvePaymentCode` method, the fuzzy amount matching block (lines 229-238) currently accepts payments even if amounts don't match. Add strict validation: replace the fuzzy matching block with:

```java
        if (transferAmount != null) {
            var pendingPayments = paymentService.getPendingPaymentsByAmount(transferAmount);
            for (var p : pendingPayments) {
                String storedNormalized = p.getPaymentCode().replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
                if (storedNormalized.equals(normalized) || storedNormalized.contains(normalized) || normalized.contains(storedNormalized)) {
                    // Strict amount validation: reject if received amount is less than expected
                    if (transferAmount < p.getAmount()) {
                        log.warn("Amount mismatch for payment {}: expected={}, received={}",
                                p.getPaymentCode(), p.getAmount(), transferAmount);
                        continue; // Skip this payment, try next
                    }
                    log.info("Matched payment by amount+code fuzzy: {} (amount: {})", p.getPaymentCode(), transferAmount);
                    return p.getPaymentCode();
                }
            }
        }
```

This ensures that even with fuzzy code matching, the received transfer amount must be >= the expected payment amount.

- [ ] **Step 7: Modify WebhookService — replace REST call with event publish**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java`.

Add imports at top:
```java
import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.domain.event.PaymentConfirmedEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
```

Add field:
```java
    @Autowired
    private RabbitTemplate rabbitTemplate;
```

Replace the block at lines 130-147 (the `try` block that calls `orderClient.updateOrderStatus`) with:

```java
        try {
            var statusResponse = paymentService.markAsPaid(paymentCode, payload.getId(), payload.getGateway());

            if (statusResponse.getStatus() == PaymentStatus.PAID) {
                log.info("Payment marked as PAID: {} (SePay tx: {})", paymentCode, payload.getId());

                var payment = paymentService.findPaymentByPaymentCodeOrNull(paymentCode);
                if (payment != null) {
                    PaymentConfirmedEvent event = new PaymentConfirmedEvent(
                            payment.getId(),
                            payment.getOrderId(),
                            payment.getCheckoutOrderId(),
                            payment.getPaymentCode(),
                            payment.getAmount(),
                            payload.getId(),
                            payload.getGateway(),
                            Instant.now()
                    );
                    rabbitTemplate.convertAndSend(
                            RabbitMQConfig.PAYMENT_EXCHANGE,
                            RabbitMQConfig.PAYMENT_CONFIRMED_ROUTING_KEY,
                            event
                    );
                    log.info("Published PaymentConfirmedEvent for payment: {}", payment.getId());
                } else {
                    log.warn("Payment found but is null for code: {}", paymentCode);
                }
            }
        } catch (PaymentException e) {
            log.warn("Payment processing warning for code {}: {}", paymentCode, e.getMessage());
        }
```

Remove the `OrderClient` and `UpdateOrderStatusRequest` imports if no longer used elsewhere in the file. Keep the `OrderClient` field — it is still used by `getOrderUserId` in `PaymentController` for the ownership check.

- [ ] **Step 8: Create PaymentExpiryJob**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`:

```java
package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.domain.event.PaymentExpiredEvent;
import iuh.fit.PaymentService.repository.PaymentRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class PaymentExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(PaymentExpiryJob.class);

    private final PaymentRepository paymentRepository;
    private final RabbitTemplate rabbitTemplate;

    public PaymentExpiryJob(PaymentRepository paymentRepository, RabbitTemplate rabbitTemplate) {
        this.paymentRepository = paymentRepository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expirePendingPayments() {
        int expired = paymentRepository.expirePendingPayments(Instant.now());
        if (expired > 0) {
            log.info("Expired {} pending payments", expired);

            List<Payment> expiredPayments = paymentRepository.findByStatus(PaymentStatus.EXPIRED,
                    org.springframework.data.domain.PageRequest.of(0, expired)).getContent();

            for (Payment payment : expiredPayments) {
                PaymentExpiredEvent event = new PaymentExpiredEvent(
                        payment.getId(),
                        payment.getOrderId(),
                        payment.getCheckoutOrderId(),
                        payment.getPaymentCode(),
                        payment.getAmount(),
                        Instant.now()
                );
                rabbitTemplate.convertAndSend(
                        RabbitMQConfig.PAYMENT_EXCHANGE,
                        RabbitMQConfig.PAYMENT_EXPIRED_ROUTING_KEY,
                        event
                );
                log.info("Published PaymentExpiredEvent for payment: {}", payment.getId());
            }
        }
    }
}
```

- [ ] **Step 8: Enable scheduling in PaymentServiceApplication**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/PaymentServiceApplication.java`. Add `@EnableScheduling`:

```java
package iuh.fit.PaymentService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableFeignClients
@EnableScheduling
public class PaymentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(PaymentServiceApplication.class, args);
    }
}
```

- [ ] **Step 9: Build PaymentService to verify compilation**

Run:
```bash
cd PaymentService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

### Task 3: Add Payment Cancel Endpoint (via Gateway)

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java`

- [ ] **Step 1: Verify cancel endpoint exists**

Read `PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java`. The `POST /{id}/cancel` endpoint should already exist. Verify it returns proper response and uses the `cancelPayment` repository method.

If it does not exist, add:

```java
    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a pending payment")
    public ResponseEntity<PaymentStatusResponse> cancelPayment(@PathVariable Long id) {
        boolean cancelled = paymentService.cancelPayment(id);
        if (!cancelled) {
            return ResponseEntity.badRequest().body(new PaymentStatusResponse("CANCELLED", "Payment cannot be cancelled"));
        }
        return ResponseEntity.ok(new PaymentStatusResponse("CANCELLED", "Payment cancelled successfully"));
    }
```

- [ ] **Step 2: Verify Gateway routes `/api/payments/**`**

Check `Api-Gateway/src/main/resources/application.properties`. Confirm there is a route:
```properties
spring.cloud.gateway.routes[...].uri=lb://PAYMENTSERVICE
spring.cloud.gateway.routes[...].predicates[0]=Path=/api/payments/**
```

This already exists — no changes needed.

---

### Task 4: Frontend Cleanup

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx`
- Modify: `frontend/src/pages/PaymentPage.tsx`
- Modify: `frontend/.env`

- [ ] **Step 1: Remove stock deduction/restoration from CheckoutPage**

Modify `frontend/src/pages/CheckoutPage.tsx`.

Remove the import:
```typescript
import { deductStock, restoreStock } from "@/src/services/productApi";
```

Replace the entire `handleConfirm` function (lines 133-230) with:

```typescript
  const handleConfirm = async () => {
    if (isProcessing) return;

    if (!user) return;
    if (itemIdsForCheckout.length === 0) return;

    if (!hasAddress) {
      toast.error("Vui lòng cập nhật địa chỉ nhận hàng trước khi thanh toán");
      return;
    }

    try {
      const checkoutData = await partialCheckoutMutation.mutateAsync({
        itemIds: itemIdsForCheckout,
      });

      const order = await createOrderFromCheckoutMutation.mutateAsync({
        orderId: checkoutData.orderId,
        items: checkoutData.items,
        totalAmount: checkoutData.totalAmount,
        paymentMethod: method,
        shippingStreet: user.street || "",
        shippingWard: user.ward || "",
        shippingProvince: user.province || "",
      });

      if (method === "QR") {
        try {
          const payment = await createPaymentMutation.mutateAsync({
            orderId: order.id,
            checkoutOrderId: order.checkoutOrderId,
            amount: checkoutData.totalAmount,
            method: "QR",
          });
          const idsParam = itemIdsForCheckout.join(",");
          navigate(`/payment/${payment.paymentId}?removeItemIds=${idsParam}`);
        } catch (paymentError) {
          toast.error("Tạo thanh toán thất bại, vui lòng thử lại");
          return;
        }
      } else {
        await removeItemsBulkMutation.mutateAsync({
          itemIds: itemIdsForCheckout,
        });
        toast.success(`Đơn hàng ${order.checkoutOrderId} đã được tạo!`);
        navigate(`/orders/${order.id}`);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Thanh toán thất bại";
        toast.error(msg);
      } else {
        toast.error("Thanh toán thất bại, vui lòng thử lại");
      }
    }
  };
```

- [ ] **Step 2: Fix PaymentPage cancellation to use Gateway**

Modify `frontend/src/pages/PaymentPage.tsx`.

Replace the cleanup effect (lines 132-148):
```typescript
  useEffect(() => {
    return () => {
      if (!paymentCompletedRef.current && paymentId) {
        const pid = parseInt(paymentId, 10);
        fetch(`/api/payments/${pid}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      }
    };
  }, []);
```

Replace the beforeunload handler (lines 150-161):
```typescript
  useEffect(() => {
    const handler = () => {
      if (!paymentCompletedRef.current && paymentId) {
        const pid = parseInt(paymentId, 10);
        navigator.sendBeacon(`/api/payments/${pid}/cancel`);
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
```

- [ ] **Step 3: Remove VITE_PAYMENT_SERVICE_URL from .env if present**

Check `frontend/.env`. If `VITE_PAYMENT_SERVICE_URL` exists, remove it. If it doesn't exist, no action needed.

- [ ] **Step 4: Build frontend to verify**

Run:
```bash
cd frontend && npm run build
```
Expected: no TypeScript errors.

---

## Phase 2: Event Migration

### Task 5: OrderService — Add Event Consumers + Activate Publishers

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java`
- Create: `OrderService/src/main/java/com/iuh/fit/domain/dto/PaymentConfirmedEvent.java`
- Create: `OrderService/src/main/java/com/iuh/fit/domain/dto/PaymentExpiredEvent.java`
- Create: `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderPaidEvent.java`
- Create: `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderCancelledEvent.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`
- Create: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java`
- Create: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java`
- Modify: `OrderService/src/main/resources/application.properties`

- [ ] **Step 1: Create event DTOs for OrderService**

Create `OrderService/src/main/java/com/iuh/fit/domain/dto/PaymentConfirmedEvent.java`:

```java
package com.iuh.fit.domain.dto;

import java.time.Instant;

public class PaymentConfirmedEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Long sepayTransactionId;
    private String sepayGateway;
    private Instant paidAt;

    public PaymentConfirmedEvent() {}

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public String getPaymentCode() { return paymentCode; }
    public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public Long getSepayTransactionId() { return sepayTransactionId; }
    public void setSepayTransactionId(Long sepayTransactionId) { this.sepayTransactionId = sepayTransactionId; }
    public String getSepayGateway() { return sepayGateway; }
    public void setSepayGateway(String sepayGateway) { this.sepayGateway = sepayGateway; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
}
```

Create `OrderService/src/main/java/com/iuh/fit/domain/dto/PaymentExpiredEvent.java`:

```java
package com.iuh.fit.domain.dto;

import java.time.Instant;

public class PaymentExpiredEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Instant expiredAt;

    public PaymentExpiredEvent() {}

    public Long getPaymentId() { return paymentId; }
    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public String getPaymentCode() { return paymentCode; }
    public void setPaymentCode(String paymentCode) { this.paymentCode = paymentCode; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public Instant getExpiredAt() { return expiredAt; }
    public void setExpiredAt(Instant expiredAt) { this.expiredAt = expiredAt; }
}
```

Create `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderPaidEvent.java`:

```java
package com.iuh.fit.domain.dto;

public class OrderPaidEvent {
    private Long orderId;
    private Long userId;
    private String checkoutOrderId;

    public OrderPaidEvent() {}

    public OrderPaidEvent(Long orderId, Long userId, String checkoutOrderId) {
        this.orderId = orderId;
        this.userId = userId;
        this.checkoutOrderId = checkoutOrderId;
    }

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
}
```

Create `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderCancelledEvent.java`:

```java
package com.iuh.fit.domain.dto;

import java.util.List;

public class OrderCancelledEvent {
    private Long orderId;
    private Long userId;
    private String checkoutOrderId;
    private List<OrderItemSnapshot> items;

    public OrderCancelledEvent() {}

    public OrderCancelledEvent(Long orderId, Long userId, String checkoutOrderId, List<OrderItemSnapshot> items) {
        this.orderId = orderId;
        this.userId = userId;
        this.checkoutOrderId = checkoutOrderId;
        this.items = items;
    }

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCheckoutOrderId() { return checkoutOrderId; }
    public void setCheckoutOrderId(String checkoutOrderId) { this.checkoutOrderId = checkoutOrderId; }
    public List<OrderItemSnapshot> getItems() { return items; }
    public void setItems(List<OrderItemSnapshot> items) { this.items = items; }

    public static class OrderItemSnapshot {
        private String variantId;
        private int quantity;

        public OrderItemSnapshot() {}

        public OrderItemSnapshot(String variantId, int quantity) {
            this.variantId = variantId;
            this.quantity = quantity;
        }

        public String getVariantId() { return variantId; }
        public void setVariantId(String variantId) { this.variantId = variantId; }
        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }
    }
}
```

- [ ] **Step 2: Update RabbitMQConfig with new exchanges**

Modify `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java`. Add new constants and exchange beans:

```java
package com.iuh.fit.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    // Email exchange (existing)
    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String ORDER_CREATED_ROUTING_KEY = "email.order.created";
    public static final String ORDER_PAID_ROUTING_KEY = "email.order.paid";
    public static final String ORDER_CANCELLED_ROUTING_KEY = "email.order.cancelled";

    // Order exchange (new)
    public static final String ORDER_EXCHANGE = "order.exchange";
    public static final String ORDER_CANCELLED_EVENT_ROUTING_KEY = "order.cancelled";
    public static final String ORDER_PAID_EVENT_ROUTING_KEY = "order.paid";

    @Bean
    public TopicExchange emailExchange() {
        return new TopicExchange(EMAIL_EXCHANGE);
    }

    @Bean
    public TopicExchange orderExchange() {
        return new TopicExchange(ORDER_EXCHANGE);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message not confirmed. Cause: {}", cause);
            }
        });
        template.setReturnsCallback(returned -> log.warn("Message returned: exchange={}, routingKey={}, replyCode={}",
                returned.getExchange(), returned.getRoutingKey(), returned.getReplyCode()));
        return template;
    }
}
```

- [ ] **Step 3: Update OrderEventPublisher to use both exchanges**

Modify `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`. Add methods for publishing to `order.exchange`:

```java
package com.iuh.fit.service;

import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.OrderPaidEvent;
import com.iuh.fit.domain.dto.OrderStatusEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public OrderEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    // Email exchange publishers
    public void publishOrderCreated(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY);
    }

    public void publishOrderPaidEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_PAID_ROUTING_KEY);
    }

    public void publishOrderCancelledEmail(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
        publish(event, RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY);
    }

    // Order exchange publishers
    public void publishOrderPaidEvent(OrderPaidEvent event) {
        publish(event, RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_PAID_EVENT_ROUTING_KEY);
    }

    public void publishOrderCancelledEvent(OrderCancelledEvent event) {
        publish(event, RabbitMQConfig.ORDER_EXCHANGE, RabbitMQConfig.ORDER_CANCELLED_EVENT_ROUTING_KEY);
    }

    private void publish(Object event, String exchange, String routingKey) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            log.info("Published event to exchange={}, routingKey={}", exchange, routingKey);
        } catch (AmqpException e) {
            log.warn("Failed to publish event to exchange={}, routingKey={}: {}", exchange, routingKey, e.getMessage());
        }
    }
}
```

- [ ] **Step 4: Create PaymentConfirmedEventConsumer**

Create `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java`:

```java
package com.iuh.fit.consumer;

import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.OrderPaidEvent;
import com.iuh.fit.domain.dto.PaymentConfirmedEvent;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.domain.enums.OrderStatus;
import com.iuh.fit.exception.ResourceNotFoundException;
import com.iuh.fit.repository.OrderRepository;
import com.iuh.fit.service.OrderEventPublisher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PaymentConfirmedEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentConfirmedEventConsumer.class);

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;

    public PaymentConfirmedEventConsumer(OrderRepository orderRepository, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
    }

    @RabbitListener(queues = "#{paymentConfirmedQueue.name}")
    @Transactional
    public void handlePaymentConfirmed(PaymentConfirmedEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.error("Received null or invalid PaymentConfirmedEvent");
            return;
        }

        log.info("Received PaymentConfirmedEvent for orderId: {}", event.getOrderId());

        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + event.getOrderId()));

        if (order.getStatus() == OrderStatus.PAID) {
            log.info("Order {} already PAID, skipping", event.getOrderId());
            return;
        }

        order.setStatus(OrderStatus.PAID);
        orderRepository.save(order);
        log.info("Order {} updated to PAID", event.getOrderId());

        // Publish OrderPaidEvent to order.exchange (for CartService, etc.)
        OrderPaidEvent orderPaidEvent = new OrderPaidEvent(
                order.getId(), order.getUserId(), order.getCheckoutOrderId()
        );
        orderEventPublisher.publishOrderPaidEvent(orderPaidEvent);

        // Publish to email.exchange (for NotificationService)
        if (order.getEmail() != null && !order.getEmail().isBlank()) {
            orderEventPublisher.publishOrderPaidEmail(order.getId(), order.getUserId(), order.getEmail());
        }
    }
}
```

- [ ] **Step 5: Create PaymentExpiredEventConsumer**

Create `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java`:

```java
package com.iuh.fit.consumer;

import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.PaymentExpiredEvent;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.domain.entity.OrderItem;
import com.iuh.fit.domain.enums.OrderStatus;
import com.iuh.fit.exception.ResourceNotFoundException;
import com.iuh.fit.repository.OrderRepository;
import com.iuh.fit.service.OrderEventPublisher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PaymentExpiredEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentExpiredEventConsumer.class);

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;

    public PaymentExpiredEventConsumer(OrderRepository orderRepository, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
    }

    @RabbitListener(queues = "#{paymentExpiredQueue.name}")
    @Transactional
    public void handlePaymentExpired(PaymentExpiredEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.error("Received null or invalid PaymentExpiredEvent");
            return;
        }

        log.info("Received PaymentExpiredEvent for orderId: {}", event.getOrderId());

        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + event.getOrderId()));

        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.info("Order {} already CANCELLED, skipping", event.getOrderId());
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.warn("Order {} is in status {}, cannot cancel", event.getOrderId(), order.getStatus());
            return;
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        log.info("Order {} updated to CANCELLED due to payment expiry", event.getOrderId());

        // Build OrderCancelledEvent with item details for stock restoration
        List<OrderCancelledEvent.OrderItemSnapshot> itemSnapshots = order.getItems().stream()
                .map(item -> new OrderCancelledEvent.OrderItemSnapshot(
                        item.getVariantId(), item.getQuantity()
                ))
                .collect(Collectors.toList());

        OrderCancelledEvent cancelEvent = new OrderCancelledEvent(
                order.getId(), order.getUserId(), order.getCheckoutOrderId(), itemSnapshots
        );
        orderEventPublisher.publishOrderCancelledEvent(cancelEvent);

        // Publish to email.exchange
        if (order.getEmail() != null && !order.getEmail().isBlank()) {
            orderEventPublisher.publishOrderCancelledEmail(order.getId(), order.getUserId(), order.getEmail());
        }
    }
}
```

- [ ] **Step 6: Create RabbitMQ queue beans for consumers**

Create `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java`:

```java
package com.iuh.fit.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentEventQueueConfig {

    @Bean
    public Queue paymentConfirmedQueue() {
        return QueueBuilder.durable("payment.confirmed.queue").build();
    }

    @Bean
    public Queue paymentExpiredQueue() {
        return QueueBuilder.durable("payment.expired.queue").build();
    }
}
```

- [ ] **Step 7: Build OrderService to verify compilation**

Run:
```bash
cd OrderService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

### Task 6: ProductService — Add RabbitMQ Consumer for Order Cancelled

**Files:**
- Create: `ProductService/src/config/rabbitmq.consumer.js`
- Create: `ProductService/src/consumers/orderCancelled.consumer.js`
- Modify: `ProductService/src/index.js`

- [ ] **Step 1: Create RabbitMQ consumer connection**

Create `ProductService/src/config/rabbitmq.consumer.js`:

```javascript
import amqp from "amqplib";

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;
const ORDER_EXCHANGE = "order.exchange";
const ORDER_CANCELLED_ROUTING_KEY = "order.cancelled";
const QUEUE_NAME = "order.cancelled.queue";

let connection = null;
let channel = null;
let reconnectTimer = null;

async function setupChannel() {
  channel = await connection.createChannel();
  await channel.assertExchange(ORDER_EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, ORDER_EXCHANGE, ORDER_CANCELLED_ROUTING_KEY);
  console.log("ProductService RabbitMQ consumer channel ready");
}

export async function connectConsumer() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    await setupChannel();

    connection.on("error", (err) => {
      console.error("RabbitMQ consumer connection error:", err.message);
      channel = null;
      scheduleReconnect();
    });

    connection.on("close", () => {
      console.warn("RabbitMQ consumer connection closed, reconnecting...");
      channel = null;
      scheduleReconnect();
    });

    console.log("ProductService RabbitMQ consumer connected");
    return channel;
  } catch (err) {
    console.error("RabbitMQ consumer connection failed:", err.message);
    scheduleReconnect();
    return null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!connection) {
      await connectConsumer();
    }
  }, 5000);
}

export async function consumeOrderCancelled(handler) {
  if (!channel) {
    console.warn("RabbitMQ consumer channel not ready, skipping consume");
    return;
  }
  try {
    await channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        await handler(event);
        channel.ack(msg);
      } catch (err) {
        console.error("Failed to process order cancelled event:", err.message);
        channel.nack(msg, false, false);
      }
    });
    console.log("Listening for order.cancelled events on queue:", QUEUE_NAME);
  } catch (err) {
    console.error("Failed to set up order cancelled consumer:", err.message);
  }
}

export async function closeConsumer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (channel) await channel.close();
  if (connection) await connection.close();
}
```

- [ ] **Step 2: Create order cancelled consumer handler**

Create `ProductService/src/consumers/orderCancelled.consumer.js`:

```javascript
import { restoreVariantStock } from "../services/product.service.js";

export async function handleOrderCancelled(event) {
  const { orderId, items } = event;

  if (!items || items.length === 0) {
    console.warn(`Order ${orderId} has no items to restore stock for`);
    return;
  }

  console.log(`Restoring stock for cancelled order ${orderId} with ${items.length} items`);

  for (const item of items) {
    const { variantId, quantity } = item;
    if (!variantId || !quantity) {
      console.warn(`Invalid item in order ${orderId}: missing variantId or quantity`);
      continue;
    }
    try {
      await restoreVariantStock(variantId, quantity);
      console.log(`Restored ${quantity} stock for variant ${variantId}`);
    } catch (err) {
      console.error(`Failed to restore stock for variant ${variantId}:`, err.message);
      throw err; // Re-throw to nack the message and retry
    }
  }

  console.log(`Successfully restored stock for order ${orderId}`);
}
```

- [ ] **Step 3: Wire up consumer in index.js**

Modify `ProductService/src/index.js`. Add imports near the top:

```javascript
import { connectConsumer, consumeOrderCancelled } from "./config/rabbitmq.consumer.js";
import { handleOrderCancelled } from "./consumers/orderCancelled.consumer.js";
```

Add after the existing RabbitMQ publisher connection (find the line with `connect()` from `rabbitmq.publisher.js`):

```javascript
// Connect RabbitMQ consumer for order cancelled events
connectConsumer().then(() => {
  consumeOrderCancelled(handleOrderCancelled);
});
```

- [ ] **Step 4: Verify ProductService starts**

Run:
```bash
cd ProductService && npm run dev
```
Check console output for "ProductService RabbitMQ consumer connected" and "Listening for order.cancelled events". Stop after verification.

---

### Task 7: CartService — Add RabbitMQ Consumer for Order Paid

**Files:**
- Modify: `CartService/pom.xml`
- Create: `CartService/src/main/java/iuh/fit/CartService/config/RabbitMQConfig.java`
- Create: `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/CartServiceApplication.java`
- Modify: `CartService/src/main/resources/application.properties`

- [ ] **Step 1: Add spring-boot-starter-amqp to pom.xml**

Modify `CartService/pom.xml`. Add inside `<dependencies>`:

```xml
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-amqp</artifactId>
        </dependency>
```

- [ ] **Step 2: Add RabbitMQ properties to application.properties**

Modify `CartService/src/main/resources/application.properties`. Add at the end:

```properties
# RabbitMQ
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
```

- [ ] **Step 3: Create RabbitMQConfig**

Create `CartService/src/main/java/iuh/fit/CartService/config/RabbitMQConfig.java`:

```java
package iuh.fit.CartService.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String ORDER_PAID_QUEUE = "order.paid.queue";

    @Bean
    public Queue orderPaidQueue() {
        return QueueBuilder.durable(ORDER_PAID_QUEUE).build();
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }
}
```

- [ ] **Step 4: Create OrderPaidEventConsumer**

Create `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java`:

```java
package iuh.fit.CartService.consumer;

import iuh.fit.CartService.service.CartService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class OrderPaidEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderPaidEventConsumer.class);

    private final CartService cartService;

    public OrderPaidEventConsumer(CartService cartService) {
        this.cartService = cartService;
    }

    @RabbitListener(queues = "order.paid.queue")
    public void handleOrderPaid(Map<String, Object> event) {
        if (event == null) {
            log.error("Received null OrderPaidEvent");
            return;
        }

        Long userId = event.get("userId") != null ? Long.valueOf(event.get("userId").toString()) : null;
        if (userId == null) {
            log.error("OrderPaidEvent has no userId");
            return;
        }

        log.info("Received OrderPaidEvent for userId: {}", userId);

        try {
            cartService.clearCart(userId);
            log.info("Cart cleared for userId: {}", userId);
        } catch (Exception e) {
            log.error("Failed to clear cart for userId {}: {}", userId, e.getMessage());
            throw e; // Re-throw to nack and retry
        }
    }
}
```

- [ ] **Step 5: Enable RabbitMQ in CartServiceApplication**

Modify `CartService/src/main/java/iuh/fit/CartService/CartServiceApplication.java`. The `@SpringBootApplication` annotation auto-configures RabbitMQ when `spring-boot-starter-amqp` is on the classpath. No additional annotation needed, but verify the file looks clean:

```java
package iuh.fit.CartService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class CartServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(CartServiceApplication.class, args);
	}

}
```

No changes needed — just verify it compiles.

- [ ] **Step 6: Build CartService to verify compilation**

Run:
```bash
cd CartService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

### Task 8: NotificationService — Implement Email Handler Stubs

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java`

- [ ] **Step 1: Implement sendOrderPaidEmail**

Modify `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java`. Replace the stub at lines 371-375:

```java
    @Override
    public void sendOrderPaidEmail(OrderStatusEvent event) {
        if (event.getEmail() == null) {
            log.warn("Order event has no email for orderId {}, skipping", event.getOrderId());
            return;
        }
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("orderId", event.getOrderId() != null ? event.getOrderId().toString() : "N/A");

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .type(NotificationType.ORDER_CONFIRMATION)
                .subject("Thanh toán thành công - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("order-paid")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("order-paid", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Order paid email sent to {} for order {}", event.getEmail(), event.getOrderId());

        } catch (MessagingException e) {
            log.error("Failed to send order paid email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send order paid email", e);
        }
    }
```

- [ ] **Step 2: Implement sendOrderCancelledEmail**

Replace the stub at lines 377-381:

```java
    @Override
    public void sendOrderCancelledEmail(OrderStatusEvent event) {
        if (event.getEmail() == null) {
            log.warn("Order event has no email for orderId {}, skipping", event.getOrderId());
            return;
        }
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("orderId", event.getOrderId() != null ? event.getOrderId().toString() : "N/A");

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .type(NotificationType.ORDER_CONFIRMATION)
                .subject("Đơn hàng đã bị hủy - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("order-cancelled")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("order-cancelled", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Order cancelled email sent to {} for order {}", event.getEmail(), event.getOrderId());

        } catch (MessagingException e) {
            log.error("Failed to send order cancelled email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send order cancelled email", e);
        }
    }
```

- [ ] **Step 3: Create email templates**

Create `NotificationService/src/main/resources/templates/email/order-paid.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <title>Thanh toán thành công</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #16a34a;">Thanh toán thành công!</h2>
    <p>Xin chào,</p>
    <p>Thanh toán cho đơn hàng <strong th:text="${orderId}">#{orderId}</strong> đã được xác nhận.</p>
    <p>Cảm ơn bạn đã mua sắm tại D4C Clothing Shop!</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="color: #6b7280; font-size: 14px;">D4C Clothing Shop</p>
</body>
</html>
```

Create `NotificationService/src/main/resources/templates/email/order-cancelled.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <title>Đơn hàng đã bị hủy</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc2626;">Đơn hàng đã bị hủy</h2>
    <p>Xin chào,</p>
    <p>Đơn hàng <strong th:text="${orderId}">#{orderId}</strong> đã bị hủy.</p>
    <p>Nếu bạn có thắc mắc, vui lòng liên hệ hỗ trợ.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="color: #6b7280; font-size: 14px;">D4C Clothing Shop</p>
</body>
</html>
```

- [ ] **Step 4: Build NotificationService to verify compilation**

Run:
```bash
cd NotificationService && ./gradlew compileJava -q
```
Expected: BUILD SUCCESS.

---

## Verification

After all tasks are complete, run the full stack:

```bash
docker compose down && docker compose up --build -d
```

Verify:
```bash
docker compose ps
curl http://localhost:8761                    # Eureka dashboard
curl http://localhost:8080/actuator/health    # Gateway health
```

Test checkout flow:
1. Add item to cart → checkout → order created (stock deducted by OrderService)
2. QR payment → scan QR → webhook → order marked PAID via event → cart cleared via event
3. Let payment expire → order cancelled via event → stock restored via event
4. Check NotificationService logs for email sending attempts

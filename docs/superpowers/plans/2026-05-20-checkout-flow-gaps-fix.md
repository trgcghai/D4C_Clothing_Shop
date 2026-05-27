# Checkout Flow Gaps Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 critical and medium-severity gaps in the event-driven checkout/payment flow across 5 services.

**Architecture:** Add missing RabbitMQ bindings, introduce payment cancel events, fix race conditions in expiry job, add DLQ configuration, improve error handling across consumers, add distributed lock for scheduled jobs, and convert raw Map to typed DTOs.

**Tech Stack:** Spring Boot 3.x (Java 21), RabbitMQ (spring-boot-starter-amqp), OpenFeign, Node.js/Express (ProductService), ShedLock (distributed locking), React 19 + TypeScript (frontend)

---

## File Map

| File | Action | Task |
|---|---|---|
| `OrderService/src/main/java/com/iuh/fit/config/PaymentEventBindingConfig.java` | Create | T1 |
| `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java` | Modify | T1 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentCancelledEvent.java` | Create | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java` | Modify | T2 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java` | Modify | T2 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentCancelledEventConsumer.java` | Create | T3 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java` | Modify | T3 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java` | Modify | T3 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java` | Modify | T3 |
| `ProductService/src/config/rabbitmq.consumer.js` | Modify | T4 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java` | Modify | T5 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java` | Modify | T5 |
| `OrderService/src/main/java/com/iuh/fit/consumer/PaymentCancelledEventConsumer.java` | Modify | T5 |
| `CartService/src/main/java/iuh/fit/CartService/domain/dto/OrderPaidEvent.java` | Create | T6 |
| `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java` | Modify | T6 |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java` | Modify | T7 |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java` | Modify | T7 |
| `PaymentService/pom.xml` | Modify | T8 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/config/ShedLockConfig.java` | Create | T8 |
| `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java` | Modify | T8 |
| `PaymentService/src/main/resources/application.properties` | Modify | T8 |

---

## Task 1: OrderService — Queue Bindings + DLQ

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventBindingConfig.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java`

- [ ] **Step 1: Create PaymentEventBindingConfig**

Create `OrderService/src/main/java/com/iuh/fit/config/PaymentEventBindingConfig.java`:

```java
package com.iuh.fit.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentEventBindingConfig {

    public static final String PAYMENT_EXCHANGE = "payment.exchange";
    public static final String PAYMENT_CANCELLED_ROUTING_KEY = "payment.cancelled";
    public static final String PAYMENT_DLX_EXCHANGE = "payment.dlx";
    public static final String PAYMENT_DLQ_ROUTING_KEY = "payment.dlq";

    @Bean
    public TopicExchange paymentExchange() {
        return new TopicExchange(PAYMENT_EXCHANGE);
    }

    @Bean
    public TopicExchange paymentDlxExchange() {
        return new TopicExchange(PAYMENT_DLX_EXCHANGE);
    }

    @Bean
    public Binding paymentConfirmedBinding(
            Queue paymentConfirmedQueue,
            TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentConfirmedQueue)
                .to(paymentExchange)
                .with("payment.confirmed");
    }

    @Bean
    public Binding paymentExpiredBinding(
            Queue paymentExpiredQueue,
            TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentExpiredQueue)
                .to(paymentExchange)
                .with("payment.expired");
    }

    @Bean
    public Binding paymentCancelledBinding(
            Queue paymentCancelledQueue,
            TopicExchange paymentExchange) {
        return BindingBuilder.bind(paymentCancelledQueue)
                .to(paymentExchange)
                .with(PAYMENT_CANCELLED_ROUTING_KEY);
    }

    @Bean
    public Binding paymentConfirmedDlqBinding(
            Queue paymentConfirmedDlq,
            TopicExchange paymentDlxExchange) {
        return BindingBuilder.bind(paymentConfirmedDlq)
                .to(paymentDlxExchange)
                .with(PAYMENT_DLQ_ROUTING_KEY);
    }

    @Bean
    public Binding paymentExpiredDlqBinding(
            Queue paymentExpiredDlq,
            TopicExchange paymentDlxExchange) {
        return BindingBuilder.bind(paymentExpiredDlq)
                .to(paymentDlxExchange)
                .with(PAYMENT_DLQ_ROUTING_KEY);
    }

    @Bean
    public Binding paymentCancelledDlqBinding(
            Queue paymentCancelledDlq,
            TopicExchange paymentDlxExchange) {
        return BindingBuilder.bind(paymentCancelledDlq)
                .to(paymentDlxExchange)
                .with(PAYMENT_DLQ_ROUTING_KEY);
    }
}
```

- [ ] **Step 2: Update PaymentEventQueueConfig with DLQ**

Replace the entire content of `OrderService/src/main/java/com/iuh/fit/config/PaymentEventQueueConfig.java`:

```java
package com.iuh.fit.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class PaymentEventQueueConfig {

    @Bean
    public Queue paymentConfirmedQueue() {
        return QueueBuilder.durable("payment.confirmed.queue")
                .withArguments(Map.of(
                        "x-dead-letter-exchange", PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE,
                        "x-dead-letter-routing-key", PaymentEventBindingConfig.PAYMENT_DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue paymentExpiredQueue() {
        return QueueBuilder.durable("payment.expired.queue")
                .withArguments(Map.of(
                        "x-dead-letter-exchange", PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE,
                        "x-dead-letter-routing-key", PaymentEventBindingConfig.PAYMENT_DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue paymentCancelledQueue() {
        return QueueBuilder.durable("payment.cancelled.queue")
                .withArguments(Map.of(
                        "x-dead-letter-exchange", PaymentEventBindingConfig.PAYMENT_DLX_EXCHANGE,
                        "x-dead-letter-routing-key", PaymentEventBindingConfig.PAYMENT_DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue paymentConfirmedDlq() {
        return QueueBuilder.durable("payment.confirmed.dlq").build();
    }

    @Bean
    public Queue paymentExpiredDlq() {
        return QueueBuilder.durable("payment.expired.dlq").build();
    }

    @Bean
    public Queue paymentCancelledDlq() {
        return QueueBuilder.durable("payment.cancelled.dlq").build();
    }
}
```

- [ ] **Step 3: Build OrderService to verify**

Run:
```bash
cd OrderService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

## Task 2: PaymentService — Cancel Event

**Files:**
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentCancelledEvent.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`

- [ ] **Step 1: Create PaymentCancelledEvent**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/domain/event/PaymentCancelledEvent.java`:

```java
package iuh.fit.PaymentService.domain.event;

import java.time.Instant;

public class PaymentCancelledEvent {
    private Long paymentId;
    private Long orderId;
    private String checkoutOrderId;
    private String paymentCode;
    private Long amount;
    private Instant cancelledAt;

    public PaymentCancelledEvent() {}

    public PaymentCancelledEvent(Long paymentId, Long orderId, String checkoutOrderId,
                                  String paymentCode, Long amount, Instant cancelledAt) {
        this.paymentId = paymentId;
        this.orderId = orderId;
        this.checkoutOrderId = checkoutOrderId;
        this.paymentCode = paymentCode;
        this.amount = amount;
        this.cancelledAt = cancelledAt;
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
    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
}
```

- [ ] **Step 2: Add cancelled routing key to RabbitMQConfig**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/config/RabbitMQConfig.java`. Add the constant:

```java
    public static final String PAYMENT_CANCELLED_ROUTING_KEY = "payment.cancelled";
```

Add it after line 19 (after `PAYMENT_EXPIRED_ROUTING_KEY`).

- [ ] **Step 3: Modify PaymentService.cancelPayment to publish event**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`.

Add imports:
```java
import iuh.fit.PaymentService.config.RabbitMQConfig;
import iuh.fit.PaymentService.domain.event.PaymentCancelledEvent;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
```

Add field:
```java
    @Autowired
    private RabbitTemplate rabbitTemplate;
```

Replace the `cancelPayment` method (lines 101-110) with:

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
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.PAYMENT_EXCHANGE,
                    RabbitMQConfig.PAYMENT_CANCELLED_ROUTING_KEY,
                    event
            );
        }

        return new PaymentStatusResponse(paymentId, PaymentStatus.CANCELLED, null);
    }
```

- [ ] **Step 4: Build PaymentService to verify**

Run:
```bash
cd PaymentService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

## Task 3: OrderService — Cancel Consumer + Expiry Race Fix

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentCancelledEventConsumer.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`

- [ ] **Step 1: Create PaymentCancelledEventConsumer**

Create `OrderService/src/main/java/com/iuh/fit/consumer/PaymentCancelledEventConsumer.java`:

```java
package com.iuh.fit.consumer;

import com.iuh.fit.domain.dto.OrderCancelledEvent;
import com.iuh.fit.domain.dto.PaymentCancelledEvent;
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
public class PaymentCancelledEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentCancelledEventConsumer.class);

    private final OrderRepository orderRepository;
    private final OrderEventPublisher orderEventPublisher;

    public PaymentCancelledEventConsumer(OrderRepository orderRepository, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.orderEventPublisher = orderEventPublisher;
    }

    @RabbitListener(queues = "payment.cancelled.queue")
    @Transactional
    public void handlePaymentCancelled(PaymentCancelledEvent event) {
        if (event == null || event.getOrderId() == null) {
            log.error("Received null or invalid PaymentCancelledEvent");
            throw new IllegalArgumentException("Invalid PaymentCancelledEvent");
        }

        log.info("Received PaymentCancelledEvent for orderId: {}", event.getOrderId());

        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found for PaymentCancelledEvent: orderId=" + event.getOrderId()));

        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.info("Order {} already CANCELLED, skipping", event.getOrderId());
            return;
        }

        if (order.getStatus() == OrderStatus.PAID) {
            log.warn("Order {} is already PAID, cannot cancel. Payment was cancelled after payment completed.", event.getOrderId());
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.warn("Order {} is in status {}, cannot cancel", event.getOrderId(), order.getStatus());
            return;
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        log.info("Order {} updated to CANCELLED due to payment cancellation", event.getOrderId());

        List<OrderCancelledEvent.OrderItemSnapshot> itemSnapshots = order.getItems().stream()
                .map(item -> new OrderCancelledEvent.OrderItemSnapshot(
                        item.getVariantId(), item.getQuantity()
                ))
                .collect(Collectors.toList());

        OrderCancelledEvent cancelEvent = new OrderCancelledEvent(
                order.getId(), order.getUserId(), order.getCheckoutOrderId(), itemSnapshots
        );
        orderEventPublisher.publishOrderCancelledEvent(cancelEvent);

        if (order.getEmail() != null && !order.getEmail().isBlank()) {
            orderEventPublisher.publishOrderCancelledEmail(order.getId(), order.getUserId(), order.getEmail());
        }
    }
}
```

- [ ] **Step 2: Update PaymentExpiredEventConsumer with PAID check**

Modify `OrderService/src/main/java/com/iuh/fit/consumer/PaymentExpiredEventConsumer.java`.

Replace lines 48-56 (the status checks) with:

```java
        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.info("Order {} already CANCELLED, skipping", event.getOrderId());
            return;
        }

        if (order.getStatus() == OrderStatus.PAID) {
            log.warn("Order {} is already PAID, cannot cancel. Payment expired after payment completed (race condition).", event.getOrderId());
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            log.warn("Order {} is in status {}, cannot cancel", event.getOrderId(), order.getStatus());
            return;
        }
```

Also change line 42-46 (null order handling) from:
```java
        Order order = orderRepository.findById(event.getOrderId()).orElse(null);
        if (order == null) {
            log.error("Order not found for PaymentExpiredEvent: orderId={}. Acking message to prevent requeue.", event.getOrderId());
            return;
        }
```

To:
```java
        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found for PaymentExpiredEvent: orderId=" + event.getOrderId()));
```

- [ ] **Step 3: Update PaymentConfirmedEventConsumer with null order handling**

Modify `OrderService/src/main/java/com/iuh/fit/consumer/PaymentConfirmedEventConsumer.java`.

Change lines 39-43 from:
```java
        Order order = orderRepository.findById(event.getOrderId()).orElse(null);
        if (order == null) {
            log.error("Order not found for PaymentConfirmedEvent: orderId={}. Acking message to prevent requeue.", event.getOrderId());
            return;
        }
```

To:
```java
        Order order = orderRepository.findById(event.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Order not found for PaymentConfirmedEvent: orderId=" + event.getOrderId()));
```

- [ ] **Step 4: Fix PaymentExpiryJob race condition**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`.

Replace the entire `expirePendingPayments` method with:

```java
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expirePendingPayments() {
        // Query PENDING payments that have expired
        List<Payment> expiringPayments = paymentRepository.findByStatus(PaymentStatus.PENDING,
                PageRequest.of(0, 1000)).getContent().stream()
                .filter(p -> p.getExpiresAt() != null && p.getExpiresAt().isBefore(Instant.now()))
                .toList();

        if (expiringPayments.isEmpty()) {
            return;
        }

        // Mark them as EXPIRED
        int expired = paymentRepository.expirePendingPayments(Instant.now());
        log.info("Expired {} pending payments", expired);

        // Re-fetch each payment to check for race with webhook
        for (Payment payment : expiringPayments) {
            Payment refreshed = paymentRepository.findById(payment.getId()).orElse(null);
            if (refreshed == null) {
                log.warn("Payment {} not found after expiry, skipping event", payment.getId());
                continue;
            }

            if (refreshed.getStatus() == PaymentStatus.PAID) {
                log.warn("Payment {} was PAID after expiry job fetched it (race with webhook). Skipping PaymentExpiredEvent.", payment.getId());
                continue;
            }

            if (refreshed.getStatus() != PaymentStatus.EXPIRED) {
                log.warn("Payment {} is in status {} after expiry, skipping event", payment.getId(), refreshed.getStatus());
                continue;
            }

            PaymentExpiredEvent event = new PaymentExpiredEvent(
                    refreshed.getId(),
                    refreshed.getOrderId(),
                    refreshed.getCheckoutOrderId(),
                    refreshed.getPaymentCode(),
                    refreshed.getAmount(),
                    Instant.now()
            );
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.PAYMENT_EXCHANGE,
                    RabbitMQConfig.PAYMENT_EXPIRED_ROUTING_KEY,
                    event
            );
            log.info("Published PaymentExpiredEvent for payment: {}", refreshed.getId());
        }
    }
```

- [ ] **Step 5: Build both services to verify**

Run:
```bash
cd OrderService && ./mvnw compile -q && cd ../PaymentService && ./mvnw compile -q
```
Expected: BUILD SUCCESS for both.

---

## Task 4: ProductService — Nack Retry + DLQ

**Files:**
- Modify: `ProductService/src/config/rabbitmq.consumer.js`

- [ ] **Step 1: Add DLQ config and fix nack**

Modify `ProductService/src/config/rabbitmq.consumer.js`.

Replace the entire file content with:

```javascript
import amqp from "amqplib";

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;
const ORDER_EXCHANGE = "order.exchange";
const ORDER_CANCELLED_ROUTING_KEY = "order.cancelled";
const QUEUE_NAME = "order.cancelled.queue";
const DLX_EXCHANGE = "order.dlx";
const DLQ_QUEUE = "order.cancelled.dlq";
const DLQ_ROUTING_KEY = "order.dlq";

let connection = null;
let channel = null;
let reconnectTimer = null;

async function setupChannel() {
  channel = await connection.createChannel();

  // Main exchange and queue with DLQ
  await channel.assertExchange(ORDER_EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(DLX_EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(DLQ_QUEUE, { durable: true });
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, DLQ_ROUTING_KEY);

  await channel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLX_EXCHANGE,
      "x-dead-letter-routing-key": DLQ_ROUTING_KEY,
      "x-message-ttl": 300000,
    },
  });
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
        // Requeue on failure (true = requeue). DLQ will catch after TTL.
        channel.nack(msg, false, true);
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

- [ ] **Step 2: Verify ProductService starts**

Run:
```bash
cd ProductService && npm run dev
```
Expected: Server starts without errors, "ProductService RabbitMQ consumer connected" appears in logs.

---

## Task 5: OrderService — Missing Order Handling (Already done in Task 3)

This task is completed as part of Task 3, Steps 2 and 3. The `orElseThrow` pattern replaces the `orElse(null)` + `return` pattern in all three consumers.

No additional steps needed.

---

## Task 6: CartService — Typed DTO

**Files:**
- Create: `CartService/src/main/java/iuh/fit/CartService/domain/dto/OrderPaidEvent.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java`

- [ ] **Step 1: Create OrderPaidEvent DTO**

Create `CartService/src/main/java/iuh/fit/CartService/domain/dto/OrderPaidEvent.java`:

```java
package iuh.fit.CartService.domain.dto;

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

- [ ] **Step 2: Update OrderPaidEventConsumer to use typed DTO**

Modify `CartService/src/main/java/iuh/fit/CartService/consumer/OrderPaidEventConsumer.java`.

Replace the entire file content with:

```java
package iuh.fit.CartService.consumer;

import iuh.fit.CartService.domain.dto.OrderPaidEvent;
import iuh.fit.CartService.service.CartService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class OrderPaidEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderPaidEventConsumer.class);

    private final CartService cartService;

    public OrderPaidEventConsumer(CartService cartService) {
        this.cartService = cartService;
    }

    @RabbitListener(queues = "order.paid.queue")
    public void handleOrderPaid(OrderPaidEvent event) {
        if (event == null) {
            log.error("Received null OrderPaidEvent");
            return;
        }

        Long userId = event.getUserId();
        if (userId == null) {
            log.error("OrderPaidEvent has no userId");
            return;
        }

        log.info("Received OrderPaidEvent for userId: {}, orderId: {}", userId, event.getOrderId());

        try {
            cartService.clearCart(userId);
            log.info("Cart cleared for userId: {}", userId);
        } catch (Exception e) {
            log.error("Failed to clear cart for userId {}: {}", userId, e.getMessage());
            throw e;
        }
    }
}
```

- [ ] **Step 3: Build CartService to verify**

Run:
```bash
cd CartService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

## Task 7: NotificationService — Email Failure Handling

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java`

- [ ] **Step 1: Fix sendOrderPaidEmail — don't throw on failure**

Modify `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java`.

Replace lines 411-419 (the catch block in `sendOrderPaidEmail`) with:

```java
        } catch (MessagingException e) {
            log.error("Failed to send order paid email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            // Don't throw — message is persisted as FAILED, consumer will ack
        }
```

- [ ] **Step 2: Fix sendOrderCancelledEmail — don't throw on failure**

In the same file, replace lines 462-470 (the catch block in `sendOrderCancelledEmail`) with:

```java
        } catch (MessagingException e) {
            log.error("Failed to send order cancelled email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            // Don't throw — message is persisted as FAILED, consumer will ack
        }
```

- [ ] **Step 3: Fix sendOrderCreatedEmail — don't throw on failure**

Find the `sendOrderCreatedEmail` method (around line 321). Replace its catch block with the same pattern:

```java
        } catch (MessagingException e) {
            log.error("Failed to send order created email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            // Don't throw — message is persisted as FAILED, consumer will ack
        }
```

- [ ] **Step 4: Verify OrderEventConsumer behavior**

Read `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java`. The consumer already calls `channel.basicAck(deliveryTag, false)` after the try block and `basicNack` on exception. Since we removed the `throw` from the service methods, the try block will complete normally and the message will be acked even if email sending fails. No changes needed to the consumer.

- [ ] **Step 5: Build NotificationService to verify**

Run:
```bash
cd NotificationService && ./gradlew compileJava -q
```
Expected: BUILD SUCCESS.

---

## Task 8: PaymentService — Expiry Job Distributed Lock

**Files:**
- Modify: `PaymentService/pom.xml`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/config/ShedLockConfig.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`
- Modify: `PaymentService/src/main/resources/application.properties`

- [ ] **Step 1: Add ShedLock dependencies to pom.xml**

Modify `PaymentService/pom.xml`. Add inside `<dependencies>`:

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

- [ ] **Step 2: Create ShedLockConfig**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/config/ShedLockConfig.java`:

```java
package iuh.fit.PaymentService.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new org.springframework.jdbc.core.JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build()
        );
    }
}
```

- [ ] **Step 3: Add @SchedulerLock to PaymentExpiryJob**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentExpiryJob.java`.

Add import:
```java
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
```

Add `@SchedulerLock` annotation to the `expirePendingPayments` method:

```java
    @Scheduled(fixedRate = 60000)
    @SchedulerLock(name = "paymentExpiryJob", lockAtMostFor = "55s", lockAtLeastFor = "30s")
    @Transactional
    public void expirePendingPayments() {
```

- [ ] **Step 4: Enable scheduling lock in PaymentServiceApplication**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/PaymentServiceApplication.java`.

Add import:
```java
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
```

Add annotation:
```java
@EnableSchedulerLock(defaultMode = net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock.LockMode.NONE)
```

The class should look like:

```java
package iuh.fit.PaymentService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;

@SpringBootApplication
@EnableFeignClients
@EnableScheduling
@EnableSchedulerLock(defaultMode = net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock.LockMode.NONE)
public class PaymentServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(PaymentServiceApplication.class, args);
	}
}
```

- [ ] **Step 5: Create shedlock table migration**

Create `PaymentService/src/main/resources/db/migration/V2__create_shedlock_table.sql`:

```sql
CREATE TABLE IF NOT EXISTS shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP(3) NOT NULL,
    locked_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
```

Note: If PaymentService doesn't use Flyway/Liquibase, add instructions to run this SQL manually or via the existing migration tool.

- [ ] **Step 6: Build PaymentService to verify**

Run:
```bash
cd PaymentService && ./mvnw compile -q
```
Expected: BUILD SUCCESS.

---

## Verification After All Tasks

Run the full stack:
```bash
docker compose down && docker compose up --build -d
docker compose ps
```

Verify RabbitMQ bindings:
```bash
curl -u guest:guest http://localhost:15672/api/bindings/vhost/%2F/e/payment.exchange
```
Expected: Bindings for `payment.confirmed`, `payment.expired`, `payment.cancelled` routing keys.

Test cancel flow:
1. Create order → create payment → cancel payment
2. Verify order status = CANCELLED
3. Verify cancellation email sent

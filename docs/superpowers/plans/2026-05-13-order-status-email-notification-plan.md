# Order Status Email Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event-driven email notifications for order lifecycle events via RabbitMQ, starting with order-created notification.

**Architecture:** OrderService publishes `OrderStatusEvent` to existing `email.exchange`; NotificationService consumes from dedicated `email.order.notifications` queue and dispatches by event type. Only `ORDER_CREATED` handler is fully implemented; `ORDER_PAID` and `ORDER_CANCELLED` are stubs.

**Tech Stack:** Java 21, Spring Boot 3.3.1 (OrderService), Spring Boot 3.5.14 (NotificationService), Spring AMQP, RabbitMQ, Thymeleaf, Lombok, RestTemplate

---

## File Structure

### OrderService (Producer)

| File | Action | Responsibility |
|------|--------|----------------|
| `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java` | Create | RabbitMQ config: exchange reference, message converter, RabbitTemplate |
| `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderStatusEvent.java` | Create | Event DTO with type, orderId, userId, email |
| `OrderService/src/main/java/com/iuh/fit/service/UserServiceClient.java` | Create | REST client to fetch user email by userId from UserService |
| `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java` | Create | Publishes OrderStatusEvent to email.exchange |
| `OrderService/src/main/java/com/iuh/fit/service/OrderService.java` | Modify | Inject OrderEventPublisher + UserServiceClient; publish event after order creation |
| `OrderService/pom.xml` | Modify | Add spring-boot-starter-amqp dependency |
| `OrderService/src/main/resources/application.properties` | Modify | Add RabbitMQ connection properties |

### NotificationService (Consumer)

| File | Action | Responsibility |
|------|--------|----------------|
| `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java` | Modify | Add order queue, 3 bindings |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/OrderStatusEvent.java` | Create | Mirror of producer OrderStatusEvent DTO |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java` | Create | Listens on email.order.notifications, dispatches by type |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java` | Modify | Add sendOrderCreatedEmail, sendOrderPaidEmail, sendOrderCancelledEmail methods |
| `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java` | Modify | Implement sendOrderCreatedEmail; stub sendOrderPaidEmail, sendOrderCancelledEmail |
| `NotificationService/src/main/resources/templates/email/order-created.html` | Create | Thymeleaf email template for order confirmation |

---

## Task 1: Add RabbitMQ dependency to OrderService

**Files:**
- Modify: `OrderService/pom.xml`

- [ ] **Step 1: Add spring-boot-starter-amqp dependency to pom.xml**

Add this dependency inside `<dependencies>` in `OrderService/pom.xml` (after the lombok dependency, before `</dependencies>`):

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

- [ ] **Step 2: Commit**

```bash
cd OrderService
git add pom.xml
git commit -m "chore(OrderService): add spring-boot-starter-amqp dependency"
```

---

## Task 2: Configure RabbitMQ in OrderService

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java`
- Modify: `OrderService/src/main/resources/application.properties`

- [ ] **Step 1: Add RabbitMQ properties to application.properties**

Append to `OrderService/src/main/resources/application.properties`:

```properties
# RabbitMQ
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
spring.rabbitmq.publisher-confirm-type=correlated
spring.rabbitmq.publisher-returns=true
```

- [ ] **Step 2: Create RabbitMQConfig.java**

Create `OrderService/src/main/java/com/iuh/fit/config/RabbitMQConfig.java`:

```java
package com.iuh.fit.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String ORDER_CREATED_ROUTING_KEY = "email.order.created";
    public static final String ORDER_PAID_ROUTING_KEY = "email.order.paid";
    public static final String ORDER_CANCELLED_ROUTING_KEY = "email.order.cancelled";

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

- [ ] **Step 3: Commit**

```bash
cd OrderService
git add src/main/resources/application.properties src/main/java/com/iuh/fit/config/RabbitMQConfig.java
git commit -m "feat(OrderService): add RabbitMQ configuration"
```

---

## Task 3: Create OrderStatusEvent DTO and UserServiceClient

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderStatusEvent.java`
- Create: `OrderService/src/main/java/com/iuh/fit/service/UserServiceClient.java`

- [ ] **Step 1: Create OrderStatusEvent DTO**

Create `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderStatusEvent.java`:

```java
package com.iuh.fit.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusEvent {
    private String type;
    private Long orderId;
    private Long userId;
    private String email;
}
```

- [ ] **Step 2: Create UserServiceClient**

Create `OrderService/src/main/java/com/iuh/fit/service/UserServiceClient.java`:

```java
package com.iuh.fit.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class UserServiceClient {

    private static final Logger log = LoggerFactory.getLogger(UserServiceClient.class);

    @Value("${user.service.url:http://userservice:8081}")
    private String userServiceUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public String getUserEmail(Long userId) {
        String url = userServiceUrl + "/api/admin/users/" + userId;
        try {
            ResponseEntity<JsonNode> response = restTemplate.getForEntity(url, JsonNode.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode body = response.getBody();
                if (body.has("email")) {
                    return body.get("email").asText();
                }
            }
            log.warn("Email not found in response from UserService for userId {}", userId);
            return null;
        } catch (Exception e) {
            log.error("Error calling UserService to get email for userId {}: {}", userId, e.getMessage());
            return null;
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
cd OrderService
git add src/main/java/com/iuh/fit/domain/dto/OrderStatusEvent.java src/main/java/com/iuh/fit/service/UserServiceClient.java
git commit -m "feat(OrderService): add OrderStatusEvent DTO and UserServiceClient"
```

---

## Task 4: Create OrderEventPublisher

**Files:**
- Create: `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`

- [ ] **Step 1: Create OrderEventPublisher**

Create `OrderService/src/main/java/com/iuh/fit/service/OrderEventPublisher.java`:

```java
package com.iuh.fit.service;

import com.iuh.fit.config.RabbitMQConfig;
import com.iuh.fit.domain.dto.OrderStatusEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

@Service
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public OrderEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishOrderCreated(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CREATED", orderId, userId, email);
        publish(event, RabbitMQConfig.ORDER_CREATED_ROUTING_KEY);
    }

    public void publishOrderPaid(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_PAID", orderId, userId, email);
        publish(event, RabbitMQConfig.ORDER_PAID_ROUTING_KEY);
    }

    public void publishOrderCancelled(Long orderId, Long userId, String email) {
        OrderStatusEvent event = new OrderStatusEvent("ORDER_CANCELLED", orderId, userId, email);
        publish(event, RabbitMQConfig.ORDER_CANCELLED_ROUTING_KEY);
    }

    private void publish(OrderStatusEvent event, String routingKey) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EMAIL_EXCHANGE, routingKey, event);
            log.info("Published order event: type={}, orderId={}, routingKey={}", event.getType(), event.getOrderId(), routingKey);
        } catch (Exception e) {
            log.error("Failed to publish order event: type={}, orderId={}: {}", event.getType(), event.getOrderId(), e.getMessage());
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
cd OrderService
git add src/main/java/com/iuh/fit/service/OrderEventPublisher.java
git commit -m "feat(OrderService): add OrderEventPublisher"
```

---

## Task 5: Integrate event publishing into OrderService.createOrderFromCheckout

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`

- [ ] **Step 1: Inject dependencies and publish event after order creation**

Modify `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`:

Add imports at the top:
```java
import com.iuh.fit.domain.dto.OrderStatusEvent;
import com.iuh.fit.service.OrderEventPublisher;
import com.iuh.fit.service.UserServiceClient;
```

Update the constructor:
```java
public OrderService(OrderRepository orderRepository, AuditService auditService,
        ProductServiceClient productServiceClient,
        OrderEventPublisher orderEventPublisher,
        UserServiceClient userServiceClient) {
    this.orderRepository = orderRepository;
    this.auditService = auditService;
    this.productServiceClient = productServiceClient;
    this.orderEventPublisher = orderEventPublisher;
    this.userServiceClient = userServiceClient;
}
```

Add new fields:
```java
private final OrderEventPublisher orderEventPublisher;
private final UserServiceClient userServiceClient;
```

In the `createOrderFromCheckout` method, after `Order saved = orderRepository.save(order);` and before `return toResponse(saved);`, add:

```java
try {
    String userEmail = userServiceClient.getUserEmail(userId);
    if (userEmail != null) {
        orderEventPublisher.publishOrderCreated(saved.getId(), userId, userEmail);
    } else {
        log.warn("Could not resolve email for userId {}, skipping order created event", userId);
    }
} catch (Exception e) {
    log.error("Failed to publish order created event for orderId {}: {}", saved.getId(), e.getMessage());
}
```

- [ ] **Step 2: Commit**

```bash
cd OrderService
git add src/main/java/com/iuh/fit/service/OrderService.java
git commit -m "feat(OrderService): publish order created event after order creation"
```

---

## Task 6: Add order queue and bindings to NotificationService

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`

- [ ] **Step 1: Add order queue constants, queue bean, and 3 bindings**

Modify `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`:

Add constants after existing constants:
```java
public static final String EMAIL_ORDER_ROUTING_KEY_CREATED = "email.order.created";
public static final String EMAIL_ORDER_ROUTING_KEY_PAID = "email.order.paid";
public static final String EMAIL_ORDER_ROUTING_KEY_CANCELLED = "email.order.cancelled";
public static final String EMAIL_ORDER_QUEUE = "email.order.notifications";
```

Add queue bean after `emailAccountQueue()`:
```java
@Bean
public Queue emailOrderNotificationsQueue() {
    return QueueBuilder.durable(EMAIL_ORDER_QUEUE)
            .withArguments(Map.of(
                    "x-queue-type", "quorum",
                    "x-dead-letter-exchange", DLX_EXCHANGE,
                    "x-dead-letter-routing-key", DLQ_ROUTING_KEY,
                    "x-message-ttl", 300000
            ))
            .build();
}
```

Add 3 binding beans after `emailAccountUnlockBinding()`:
```java
@Bean
public Binding emailOrderCreatedBinding(Queue emailOrderNotificationsQueue, TopicExchange emailExchange) {
    return BindingBuilder.bind(emailOrderNotificationsQueue)
            .to(emailExchange)
            .with(EMAIL_ORDER_ROUTING_KEY_CREATED);
}

@Bean
public Binding emailOrderPaidBinding(Queue emailOrderNotificationsQueue, TopicExchange emailExchange) {
    return BindingBuilder.bind(emailOrderNotificationsQueue)
            .to(emailExchange)
            .with(EMAIL_ORDER_ROUTING_KEY_PAID);
}

@Bean
public Binding emailOrderCancelledBinding(Queue emailOrderNotificationsQueue, TopicExchange emailExchange) {
    return BindingBuilder.bind(emailOrderNotificationsQueue)
            .to(emailExchange)
            .with(EMAIL_ORDER_ROUTING_KEY_CANCELLED);
}
```

- [ ] **Step 2: Commit**

```bash
cd NotificationService
git add src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java
git commit -m "feat(NotificationService): add order notifications queue and bindings"
```

---

## Task 7: Create OrderStatusEvent DTO and OrderEventConsumer in NotificationService

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/OrderStatusEvent.java`
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java`

- [ ] **Step 1: Create OrderStatusEvent DTO**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/OrderStatusEvent.java`:

```java
package iuh.fit.notificationservice.Domain.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusEvent {
    private String type;
    private Long orderId;
    private Long userId;
    private String email;
}
```

- [ ] **Step 2: Create OrderEventConsumer**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java`:

```java
package iuh.fit.notificationservice.Service.Consumer;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.OrderStatusEvent;
import iuh.fit.notificationservice.Service.NotificationService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class OrderEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventConsumer.class);

    private final NotificationService notificationService;

    public OrderEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_ORDER_QUEUE)
    public void handleOrderEvent(
            OrderStatusEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            String eventType = event.getType() != null ? event.getType() : "UNKNOWN";
            log.info("Received order {} event for order {}", eventType.toLowerCase(), event.getOrderId());

            if ("ORDER_CREATED".equals(event.getType())) {
                notificationService.sendOrderCreatedEmail(event);
            } else if ("ORDER_PAID".equals(event.getType())) {
                notificationService.sendOrderPaidEmail(event);
            } else if ("ORDER_CANCELLED".equals(event.getType())) {
                notificationService.sendOrderCancelledEmail(event);
            } else {
                log.warn("Unknown order event type: {} for order {}", event.getType(), event.getOrderId());
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed order {} event for order {}", eventType.toLowerCase(), event.getOrderId());
        } catch (Exception e) {
            log.error("Failed to process order {} event for order {}", event.getType(), event.getOrderId(), e);
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for order {}: {}", event.getOrderId(), nackException.getMessage());
            }
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
cd NotificationService
git add src/main/java/iuh/fit/notificationservice/Domain/DTO/OrderStatusEvent.java src/main/java/iuh/fit/notificationservice/Service/Consumer/OrderEventConsumer.java
git commit -m "feat(NotificationService): add OrderEventConsumer with type dispatch"
```

---

## Task 8: Add order email methods to NotificationService interface and implementation

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java`

- [ ] **Step 1: Add method signatures to NotificationService interface**

Add to `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java`:

```java
void sendOrderCreatedEmail(OrderStatusEvent event);

void sendOrderPaidEmail(OrderStatusEvent event);

void sendOrderCancelledEmail(OrderStatusEvent event);
```

Add import:
```java
import iuh.fit.notificationservice.Domain.DTO.OrderStatusEvent;
```

- [ ] **Step 2: Implement sendOrderCreatedEmail and stub the other two in NotificationServiceImpl**

Add import to `NotificationServiceImpl.java`:
```java
import iuh.fit.notificationservice.Domain.DTO.OrderStatusEvent;
```

Add these three methods at the end of `NotificationServiceImpl` class (after `sendAccountUnlockedEmail`):

```java
@Override
public void sendOrderCreatedEmail(OrderStatusEvent event) {
    java.util.Map<String, String> templateVars = new java.util.HashMap<>();
    templateVars.put("orderId", event.getOrderId() != null ? event.getOrderId().toString() : "N/A");

    Notification notification = Notification.builder()
            .userId(event.getUserId())
            .type(NotificationType.ORDER_CONFIRMATION)
            .subject("Xác nhận đơn hàng - D4C Clothing Shop")
            .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
            .status(NotificationStatus.PENDING)
            .templateName("order-created")
            .templateVars(templateVars)
            .provider(NotificationProvider.SMTP)
            .retryCount(0)
            .build();

    notificationRepository.save(notification);

    try {
        String htmlContent = emailTemplateService.render("order-created", templateVars);

        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
        helper.setTo(event.getEmail());
        helper.setSubject(notification.getSubject());
        helper.setText(htmlContent, true);

        mailSender.send(mimeMessage);

        notification.setStatus(NotificationStatus.SENT);
        notification.setSentAt(LocalDateTime.now());
        notificationRepository.save(notification);

        log.info("Order created email sent to {} for order {}", event.getEmail(), event.getOrderId());

    } catch (MessagingException e) {
        log.error("Failed to send order created email to {}: {}", event.getEmail(), e.getMessage());

        notification.setStatus(NotificationStatus.FAILED);
        notification.setErrorMessage(e.getMessage());
        notificationRepository.save(notification);

        throw new RuntimeException("Failed to send order created email", e);
    }
}

@Override
public void sendOrderPaidEmail(OrderStatusEvent event) {
    // TODO: Implement when order paid notification is needed
    log.info("Order paid email handler stub - orderId: {}", event.getOrderId());
}

@Override
public void sendOrderCancelledEmail(OrderStatusEvent event) {
    // TODO: Implement when order cancelled notification is needed
    log.info("Order cancelled email handler stub - orderId: {}", event.getOrderId());
}
```

- [ ] **Step 3: Commit**

```bash
cd NotificationService
git add src/main/java/iuh/fit/notificationservice/Service/NotificationService.java src/main/java/iuh/fit/notificationservice/Service/Impl/NotificationServiceImpl.java
git commit -m "feat(NotificationService): add sendOrderCreatedEmail implementation and stubs for paid/cancelled"
```

---

## Task 9: Create order-created email template

**Files:**
- Create: `NotificationService/src/main/resources/templates/email/order-created.html`

- [ ] **Step 1: Create the Thymeleaf email template**

Create `NotificationService/src/main/resources/templates/email/order-created.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận đơn hàng - D4C Clothing Shop</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #1a1a2e; padding: 30px 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">D4C Clothing Shop</h1>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="color: #1a1a2e; margin: 0 0 16px 0; font-size: 20px;">
                                Xác nhận đơn hàng
                            </h2>
                            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                Cảm ơn bạn đã đặt hàng tại D4C Clothing Shop. Đơn hàng của bạn đã được tạo thành công.
                            </p>

                            <!-- Order Info -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto; width: 100%;">
                                <tr>
                                    <td style="background-color: #f0f0f0; border-radius: 8px; padding: 20px 30px;">
                                        <p style="color: #888888; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Mã đơn hàng</p>
                                        <p style="color: #1a1a2e; font-size: 24px; font-weight: 700; margin: 0;" th:text="${orderId}">ORD-000000</p>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                                Đơn hàng đang chờ thanh toán. Vui lòng hoàn tất thanh toán để đơn hàng được xử lý.
                            </p>

                            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
                                Nếu bạn không thực hiện đơn hàng này, vui lòng bỏ qua email này.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f8f8; padding: 24px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="color: #888888; font-size: 12px; margin: 0;">
                                Email này được gửi tự động từ D4C Clothing Shop. Vui lòng không trả lời email này.
                            </p>
                            <p style="color: #888888; font-size: 12px; margin: 8px 0 0 0;">
                                &copy; 2026 D4C Clothing Shop. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd NotificationService
git add src/main/resources/templates/email/order-created.html
git commit -m "feat(NotificationService): add order-created email template"
```

---

## Task 10: Verify build compiles

**Files:** All

- [ ] **Step 1: Build OrderService**

```bash
cd OrderService
./mvnw compile -q
```
Expected: No errors

- [ ] **Step 2: Build NotificationService**

```bash
cd NotificationService
./gradlew compileJava -q
```
Expected: No errors

- [ ] **Step 3: Commit any fixes if needed**

---

## Self-Review Checklist

1. **Spec coverage:** All requirements covered — OrderService publishes events (Task 2-5), NotificationService consumes with dedicated queue (Task 6-7), type dispatch with ORDER_CREATED implemented and ORDER_PAID/ORDER_CANCELLED stubbed (Task 7-8), email template created (Task 9), RabbitMQ config in both services (Task 2, 6), minimal payload with type/orderId/userId/email (Task 3), enum-style type naming (Task 3), correct routing keys (Task 2, 6), fire-and-forget publisher (Task 4), manual ACK/NACK consumer (Task 7), UserServiceClient for email resolution (Task 3, 5).

2. **Placeholder scan:** No TBD/TODO in plan steps. The only TODOs are in the stub methods which is intentional per spec.

3. **Type consistency:** `OrderStatusEvent` uses `String type`, `Long orderId`, `Long userId`, `String email` consistently across OrderService DTO (Task 3), NotificationService DTO (Task 7), publisher methods (Task 4), consumer dispatch (Task 7), and NotificationService methods (Task 8). Routing key constants match between producer config (Task 2) and consumer config (Task 6).

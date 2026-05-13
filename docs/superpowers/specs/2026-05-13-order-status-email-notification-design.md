# Order Status Email Notification Design

**Date:** 2026-05-13
**Status:** Draft — awaiting review

## Overview

Add event-driven email notifications for order lifecycle events. OrderService publishes events to RabbitMQ; NotificationService consumes them and sends emails to users. Currently only `ORDER_CREATED` is implemented; `ORDER_PAID` and `ORDER_CANCELLED` are designed as stubs for future work.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Exchange | Reuse `email.exchange` | Simpler, consistent with existing pattern |
| Queue | Dedicated `email.order.notifications` queue | Isolation from account events, independent scaling |
| Event type naming | Enum-style (`ORDER_CREATED`, `ORDER_PAID`, `ORDER_CANCELLED`) | Clear, matches existing `AccountEvent` pattern |
| Routing keys | `email.order.created`, `email.order.paid`, `email.order.cancelled` | Consistent with `email.verification` convention |
| Event payload | Minimal (`type`, `orderId`, `userId`, `email`) | Keeps events small, NotificationService has what it needs |
| Publisher reliability | Fire-and-forget with error logging | Matches UserService pattern; order creation must not fail if RabbitMQ is down |
| Consumer reliability | Manual ACK/NACK with DLX | Matches existing NotificationService pattern |

## Architecture

### Components

**OrderService (Producer)**
- `OrderStatusEvent` DTO — `{ type: String, orderId: Long, userId: Long, email: String }`
- `OrderEventPublisher` — publishes events to `email.exchange`
- `RabbitMQConfig` — exchange reference, message converter, publisher config
- Integration point: `OrderService` (business logic) calls `OrderEventPublisher` after order creation

**NotificationService (Consumer)**
- `OrderStatusEvent` DTO — mirrors producer DTO
- `OrderEventConsumer` — listens on `email.order.notifications`, dispatches by `type`
- `RabbitMQConfig` — queue, bindings, DLX config
- `OrderEmailService` — sends order emails (renders template, persists Notification record)
- Email template: `order-created.html` (Thymeleaf)

### Existing Infrastructure Reused

- `email.exchange` (TopicExchange) — already exists
- `email.dlx` (DirectExchange) — already exists
- `email.notifications.dlq` — already exists
- `NotificationType` enum — `ORDER_CONFIRMATION`, `ORDER_CANCELLED`, `PAYMENT_CONFIRMATION` already defined
- `JavaMailSender`, `EmailTemplateService`, `Notification` entity — already in use

## Data Flow

### Order Created (Current Implementation)

```
User → POST /api/orders → OrderController
  → OrderService.createOrder()
    → Persist order (status: PENDING_PAYMENT)
    → OrderEventPublisher.publish(event)
      → email.exchange + routing key: email.order.created
        → RabbitMQ routes to email.order.notifications queue
          → OrderEventConsumer receives message
            → Dispatch by type: ORDER_CREATED
              → handleOrderCreated(event)
                → NotificationService.sendOrderCreatedEmail()
                  → Render order-created.html
                  → Send via JavaMailSender
                  → Persist Notification record (type: ORDER_CONFIRMATION)
```

### Order Paid (Future Stub)

```
PaymentService/Webhook → OrderService (public endpoint)
  → OrderService.updateStatus(PAID)
    → OrderEventPublisher.publish(event)
      → email.exchange + routing key: email.order.paid
        → OrderEventConsumer receives
          → handleOrderPaid(event) [STUB]
```

### Order Cancelled (Future Stub)

```
User/Admin → OrderService.cancelOrder()
  → OrderService.updateStatus(CANCELLED)
    → OrderEventPublisher.publish(event)
      → email.exchange + routing key: email.order.cancelled
        → OrderEventConsumer receives
          → handleOrderCancelled(event) [STUB]
```

## RabbitMQ Configuration

### OrderService (Producer)

```
Exchange: email.exchange (TopicExchange) — reference existing
Routing keys:
  - email.order.created
  - email.order.paid
  - email.order.cancelled
Message converter: Jackson2JsonMessageConverter
Publisher confirms: enabled (graceful fallback on failure)
```

### NotificationService (Consumer)

```
Queue: email.order.notifications
  - Type: quorum
  - TTL: 5min
  - DLX: email.dlx
  - DLK: dlq

Bindings (to email.exchange):
  - email.order.created
  - email.order.paid
  - email.order.cancelled
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| RabbitMQ down during publish | Log warning, order creation succeeds (fire-and-forget) |
| Email send fails | NACK with requeue=false → DLQ |
| Malformed event message | NACK with requeue=false → DLQ, log error |
| Notification record save fails | NACK with requeue=false → DLQ |
| RabbitMQ down during consumer start | Spring AMQP auto-reconnect |

## Event DTO

```java
public class OrderStatusEvent {
    private String type;        // "ORDER_CREATED", "ORDER_PAID", "ORDER_CANCELLED"
    private Long orderId;
    private Long userId;
    private String email;
}
```

## Notification Persistence

Each email attempt creates a `Notification` record:

| Field | Value |
|-------|-------|
| `userId` | From event |
| `type` | `ORDER_CONFIRMATION` (for created), `PAYMENT_CONFIRMATION` (for paid), `ORDER_CANCELLED` (for cancelled) |
| `subject` | From template |
| `channel` | `EMAIL` |
| `status` | `SENT` or `FAILED` |
| `templateName` | `order-created`, `order-paid`, `order-cancelled` |
| `templateVars` | `{ orderId, totalAmount, createdAt, ... }` |

## Future Extensibility

- `handleOrderPaid()` and `handleOrderCancelled()` added as stubs with TODO comments
- Adding email templates for those types requires zero queue/config changes
- PaymentService can later publish `ORDER_PAID` events directly instead of REST-calling OrderService
- Non-email consumers (e.g., inventory service) can bind to `email.exchange` with their own queues using the same routing keys

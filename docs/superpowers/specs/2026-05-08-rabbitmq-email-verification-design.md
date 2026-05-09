# RabbitMQ Email Verification Integration Design

## Overview

Replace the synchronous REST call from UserService to NotificationService with asynchronous RabbitMQ messaging for sending email verification codes.

## Scope

- Email verification email sending only
- Does NOT cover password reset, welcome emails, or order notifications (future)
- Replaces existing `RestTemplate` call in `AuthServiceImpl.sendVerificationEmail()`

## Architecture

```
UserService (Producer)                    NotificationService (Consumer)
┌─────────────────────┐                   ┌──────────────────────────┐
│  AuthServiceImpl    │   publish         │  EmailVerificationConsumer│
│  ┌───────────────┐  │  ┌──────┐         │  ┌────────────────────┐  │
│  │ RabbitTemplate │──┼─▶│Topic │         │  │ @RabbitListener    │  │
│  └───────────────┘  │  │Exch. │         │  └────────┬───────────┘  │
└─────────────────────┘  └──┬───┘         │           │              │
                            │             │  ┌────────────────────┐  │
                            ▼             │  │ NotificationService│  │
                   ┌──────────────────┐   │  │ (SMTP email send)  │  │
                   │ Queue:           │   │  └────────────────────┘  │
                   │ email.           │   └──────────────────────────┘
                   │ notifications    │
                   │ (quorum, DLX)    │
                   └────────┬─────────┘
                            │ (TTL expired / nack)
                            ▼
                   ┌──────────────────┐
                   │ DLQ:             │
                   │ email.           │
                   │ notifications.dlq│
                   └──────────────────┘
```

## Exchange and Queue Configuration

| Resource | Name | Type | Declared By |
|----------|------|------|-------------|
| Exchange | `email.exchange` | Topic | NotificationService |
| Queue | `email.notifications` | Quorum | NotificationService |
| Binding | `email.notifications` → `email.exchange` | Routing key: `email.verification` | NotificationService |
| DLX | `email.dlx` | Direct | NotificationService |
| DLQ | `email.notifications.dlq` | Quorum | NotificationService |

### Queue Arguments

| Argument | Value | Reason |
|----------|-------|--------|
| `x-queue-type` | `quorum` | High availability, survives broker restart |
| `x-dead-letter-exchange` | `email.dlx` | Failed messages go to DLQ |
| `x-dead-letter-routing-key` | `dlq` | Explicit routing to DLQ |
| `x-message-ttl` | `300000` (5 min) | Matches Redis verification code TTL |

## Payload

```java
// VerificationEmailEvent — defined independently in both services
{
  "userId": 123,
  "email": "user@example.com",
  "fullName": "Nguyen Van A",
  "verificationCode": "482916"
}
```

No shared module. Each service defines its own `VerificationEmailEvent` DTO with matching fields.

## Component Changes

### 1. docker-compose.yml

Add RabbitMQ service:

```yaml
rabbitmq:
  image: rabbitmq:3-management
  container_name: rabbitmq
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: guest
    RABBITMQ_DEFAULT_PASS: guest
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 20s
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq
  networks:
    - d4c-net
```

Add `rabbitmq_data` to volumes section.

Add `rabbitmq` to `depends_on` for `userservice` and `notificationservice` with `condition: service_healthy`.

### 2. NotificationService (Consumer) — Gradle

**build.gradle:**
```groovy
implementation 'org.springframework.boot:spring-boot-starter-amqp'
```

**application.properties:**
```properties
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
spring.rabbitmq.listener.simple.acknowledge-mode=manual
spring.rabbitmq.listener.simple.prefetch=10
```

**New file: Config/RabbitMQConfig.java**
- Declares `email.exchange` (TopicExchange)
- Declares `email.dlx` (DirectExchange)
- Declares `email.notifications` (Queue) with quorum type, DLX, DLX routing key `dlq`, TTL
- Declares `email.notifications.dlq` (Queue)
- Declares bindings: `email.notifications` → `email.exchange` with routing key `email.verification`, `email.notifications.dlq` → `email.dlx` with routing key `dlq`

**New file: Domain/DTO/VerificationEmailEvent.java**
- Fields: `Long userId`, `String email`, `String fullName`, `String verificationCode`
- Lombok `@Data`, no-args constructor, all-args constructor

**New file: Service/EmailVerificationConsumer.java**
- `@RabbitListener(queues = "email.notifications")`
- Accepts `VerificationEmailEvent`, `Channel`, `@Header(AmqpHeaders.DELIVERY_TAG) long tag`
- On success: calls existing `NotificationService.sendVerificationEmail(event)`, then `channel.basicAck(tag, false)`
- On failure: `channel.basicNack(tag, false, false)` (no requeue, routes to DLX)

### 3. UserService (Producer) — Maven

**pom.xml:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

**application.properties:**
```properties
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
spring.rabbitmq.publisher-confirm-type=correlated
spring.rabbitmq.publisher-returns=true
```

**New file: Config/RabbitMQConfig.java**
- Configures `RabbitTemplate` bean with publisher confirm callback
- Confirm callback logs error if `ack == false`

**New file: Domain/DTO/VerificationEmailEvent.java**
- Same structure as NotificationService version

**Modified file: Service/AuthServiceImpl.java**
- Replace `RestTemplate` + `SendVerificationEmailRequest` + HTTP POST with `RabbitTemplate.convertAndSend("email.exchange", "email.verification", event)`
- Remove `RestTemplate` field (no longer needed for this purpose)
- Keep `notification.service.url` property removal (no longer needed)
- Catch `AmqpException` on publish failure, log error, do NOT throw (user can request resend)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| RabbitMQ down when UserService publishes | `AmqpConnectException` caught, logged. Redis code still exists. User can request resend. |
| NotificationService crashes mid-processing | Message stays unacked in queue. Redelivered on restart. |
| SMTP fails (rate limit, network) | `basicNack(requeue=false)` → routes to DLX → DLQ |
| Message expired (TTL 5min) | Auto-routed to DLQ by RabbitMQ |
| Malformed message | `basicNack(requeue=false)` → DLQ |
| Publisher confirm fails | Logged. Message may not have reached broker. Redis code exists for resend. |

## Testing Strategy

- **UserService unit test**: Mock `RabbitTemplate`, verify `convertAndSend` called with correct exchange, routing key, and event payload
- **NotificationService integration test**: Use `@RabbitListenerTest` or `RabbitTemplate` to send test message, verify consumer processes it
- **Manual test**: Start full docker-compose, sign up user, verify email received, verify code works

## Migration Notes

- Existing `POST /api/notifications/send-verification` HTTP endpoint in NotificationService is NOT removed — it can still be used for manual testing or future direct calls
- `notification.service.url` property in UserService can be removed after migration
- `RestTemplate` field in `AuthServiceImpl` can be removed after migration
- Redis verification code flow is unchanged — still generated and stored before publishing event

## Future Considerations (Out of Scope)

- Additional routing keys: `email.password-reset`, `email.welcome`, `email.order-confirmed`
- Retry queue with exponential backoff before DLQ
- DLQ consumer for alerting or manual reprocessing
- Message deduplication via `message-id` header

# RabbitMQ Email Verification Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace synchronous REST call from UserService to NotificationService with asynchronous RabbitMQ messaging for email verification.

**Architecture:** Spring AMQP with topic exchange. NotificationService declares exchange/queue/binding and consumes with `@RabbitListener`. UserService publishes via `RabbitTemplate`. At-least-once delivery with quorum queues and dead letter exchange.

**Tech Stack:** RabbitMQ 3-management, Spring AMQP, Spring Boot 3 (Maven for UserService, Gradle for NotificationService)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `docker-compose.yml` | Add RabbitMQ service + volume + depends_on |
| Modify | `NotificationService/build.gradle` | Add spring-boot-starter-amqp dependency |
| Modify | `NotificationService/src/main/resources/application.properties` | Add RabbitMQ connection config |
| Create | `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java` | Declare exchange, queues, bindings, DLX |
| Create | `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/VerificationEmailEvent.java` | Event DTO for RabbitMQ messages |
| Create | `NotificationService/src/main/java/iuh/fit/notificationservice/Service/EmailVerificationConsumer.java` | @RabbitListener consumer |
| Modify | `UserService/pom.xml` | Add spring-boot-starter-amqp dependency |
| Modify | `UserService/src/main/resources/application.properties` | Add RabbitMQ connection config + publisher confirms |
| Create | `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java` | Configure RabbitTemplate with publisher confirms |
| Create | `UserService/src/main/java/iuh/fit/UserService/domain/dto/VerificationEmailEvent.java` | Event DTO (matches NotificationService version) |
| Modify | `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java` | Replace RestTemplate with RabbitTemplate |

---

### Task 1: Add RabbitMQ to docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add RabbitMQ service to docker-compose.yml**

Add this service after the `redis` service in `docker-compose.yml`:

```yaml
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    restart: unless-stopped
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

- [ ] **Step 2: Add rabbitmq_data to volumes section**

Add `rabbitmq_data:` under the existing `volumes:` section (after `redis_data:`):

```yaml
volumes:
  mariadb_data:
  redis_data:
  rabbitmq_data:
```

- [ ] **Step 3: Add rabbitmq to depends_on for userservice and notificationservice**

In the `userservice` service, add `rabbitmq` to `depends_on`:

```yaml
    depends_on:
      mariadb:
        condition: service_healthy
      discovery-server:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
```

In the `notificationservice` service, add `rabbitmq` to `depends_on`:

```yaml
    depends_on:
      mariadb:
        condition: service_healthy
      discovery-server:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "infra: add RabbitMQ service to docker-compose"
```

---

### Task 2: NotificationService — AMQP dependency + config

**Files:**
- Modify: `NotificationService/build.gradle`
- Modify: `NotificationService/src/main/resources/application.properties`

- [ ] **Step 1: Add spring-boot-starter-amqp to build.gradle**

Add to the `dependencies` block in `NotificationService/build.gradle`:

```groovy
implementation 'org.springframework.boot:spring-boot-starter-amqp'
```

- [ ] **Step 2: Add RabbitMQ config to application.properties**

Append to `NotificationService/src/main/resources/application.properties`:

```properties
# RabbitMQ
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
spring.rabbitmq.listener.simple.acknowledge-mode=manual
spring.rabbitmq.listener.simple.prefetch=10
```

- [ ] **Step 3: Commit**

```bash
git add NotificationService/build.gradle NotificationService/src/main/resources/application.properties
git commit -m "feat(notificationservice): add RabbitMQ AMQP dependency and config"
```

---

### Task 3: NotificationService — RabbitMQConfig (exchange, queues, bindings)

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`

- [ ] **Step 1: Create RabbitMQConfig.java**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`:

```java
package iuh.fit.notificationservice.Config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class RabbitMQConfig {

    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String EMAIL_QUEUE = "email.notifications";
    public static final String EMAIL_ROUTING_KEY = "email.verification";
    public static final String DLX_EXCHANGE = "email.dlx";
    public static final String DLQ_QUEUE = "email.notifications.dlq";
    public static final String DLQ_ROUTING_KEY = "dlq";

    @Bean
    public TopicExchange emailExchange() {
        return new TopicExchange(EMAIL_EXCHANGE);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DLX_EXCHANGE);
    }

    @Bean
    public Queue emailNotificationsQueue() {
        return QueueBuilder.durable(EMAIL_QUEUE)
                .withArguments(Map.of(
                        "x-queue-type", "quorum",
                        "x-dead-letter-exchange", DLX_EXCHANGE,
                        "x-dead-letter-routing-key", DLQ_ROUTING_KEY,
                        "x-message-ttl", 300000
                ))
                .build();
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ_QUEUE)
                .withArguments(Map.of("x-queue-type", "quorum"))
                .build();
    }

    @Bean
    public Binding emailBinding(Queue emailNotificationsQueue, TopicExchange emailExchange) {
        return BindingBuilder.bind(emailNotificationsQueue)
                .to(emailExchange)
                .with(EMAIL_ROUTING_KEY);
    }

    @Bean
    public Binding dlqBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue)
                .to(deadLetterExchange)
                .with(DLQ_ROUTING_KEY);
    }
}
```

- [ ] **Step 2: Verify NotificationService compiles**

```bash
cd NotificationService && ./gradlew compileJava
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java
git commit -m "feat(notificationservice): declare RabbitMQ exchange, queues, and bindings"
```

---

### Task 4: NotificationService — VerificationEmailEvent DTO

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/VerificationEmailEvent.java`

- [ ] **Step 1: Create VerificationEmailEvent.java**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/VerificationEmailEvent.java`:

```java
package iuh.fit.notificationservice.Domain.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerificationEmailEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String verificationCode;
}
```

- [ ] **Step 2: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/VerificationEmailEvent.java
git commit -m "feat(notificationservice): add VerificationEmailEvent DTO"
```

---

### Task 5: NotificationService — EmailVerificationConsumer

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/EmailVerificationConsumer.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java` (add method overload)
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java` (add method implementation)

- [ ] **Step 1: Add sendVerificationEmail(VerificationEmailEvent) to NotificationService interface**

Modify `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java`:

```java
package iuh.fit.notificationservice.Service;

import iuh.fit.notificationservice.Domain.DTO.NotificationResponse;
import iuh.fit.notificationservice.Domain.DTO.SendNotificationRequest;
import iuh.fit.notificationservice.Domain.DTO.SendVerificationEmailRequest;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;

public interface NotificationService {

    NotificationResponse sendNotification(SendNotificationRequest request);

    NotificationResponse sendVerificationEmail(SendVerificationEmailRequest request);

    void sendVerificationEmail(VerificationEmailEvent event);
}
```

- [ ] **Step 2: Implement sendVerificationEmail(VerificationEmailEvent) in NotificationServiceImpl**

Add this method to `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java` (after the existing `sendVerificationEmail` method):

```java
    @Override
    public void sendVerificationEmail(VerificationEmailEvent event) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", event.getFullName());
        templateVars.put("verificationCode", event.getVerificationCode());

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .type(NotificationType.WELCOME)
                .subject("Xác thực email - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("email-verification")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("email-verification", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Verification email sent to {} for user {}", event.getEmail(), event.getUserId());

        } catch (MessagingException e) {
            log.error("Failed to send verification email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send verification email", e);
        }
    }
```

Add the import at the top of the file:

```java
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;
```

- [ ] **Step 3: Create EmailVerificationConsumer.java**

Create `NotificationService/src/main/java/iuh/fit/notificationservice/Service/EmailVerificationConsumer.java`:

```java
package iuh.fit.notificationservice.Service;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class EmailVerificationConsumer {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationConsumer.class);

    private final NotificationService notificationService;

    public EmailVerificationConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = "email.notifications")
    public void handleVerificationEmail(
            VerificationEmailEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("Received verification email event for user {}", event.getUserId());
            notificationService.sendVerificationEmail(event);
            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed verification email for user {}", event.getUserId());
        } catch (Exception e) {
            log.error("Failed to process verification email for user {}: {}", event.getUserId(), e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for user {}: {}", event.getUserId(), nackException.getMessage());
            }
        }
    }
}
```

- [ ] **Step 4: Verify NotificationService compiles**

```bash
cd NotificationService && ./gradlew compileJava
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Service/EmailVerificationConsumer.java NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java
git commit -m "feat(notificationservice): add RabbitMQ consumer for email verification"
```

---

### Task 6: UserService — AMQP dependency + config

**Files:**
- Modify: `UserService/pom.xml`
- Modify: `UserService/src/main/resources/application.properties`

- [ ] **Step 1: Add spring-boot-starter-amqp to pom.xml**

Add to the `<dependencies>` section in `UserService/pom.xml` (after the `spring-boot-starter-data-redis` dependency):

```xml
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-amqp</artifactId>
        </dependency>
```

- [ ] **Step 2: Add RabbitMQ config to application.properties**

Append to `UserService/src/main/resources/application.properties`:

```properties
# RabbitMQ
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
spring.rabbitmq.publisher-confirm-type=correlated
spring.rabbitmq.publisher-returns=true
```

- [ ] **Step 3: Commit**

```bash
git add UserService/pom.xml UserService/src/main/resources/application.properties
git commit -m "feat(userservice): add RabbitMQ AMQP dependency and config"
```

---

### Task 7: UserService — RabbitMQConfig (RabbitTemplate with publisher confirms)

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java`

- [ ] **Step 1: Create RabbitMQConfig.java**

Create `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java`:

```java
package iuh.fit.UserService.Config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (!ack) {
                log.error("Message not confirmed. Cause: {}", cause);
            }
        });
        return template;
    }
}
```

- [ ] **Step 2: Verify UserService compiles**

```bash
cd UserService && ./mvnw compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java
git commit -m "feat(userservice): configure RabbitTemplate with publisher confirms"
```

---

### Task 8: UserService — VerificationEmailEvent DTO

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/VerificationEmailEvent.java`

- [ ] **Step 1: Create VerificationEmailEvent.java**

Create `UserService/src/main/java/iuh/fit/UserService/domain/dto/VerificationEmailEvent.java`:

```java
package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerificationEmailEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String verificationCode;
}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/VerificationEmailEvent.java
git commit -m "feat(userservice): add VerificationEmailEvent DTO"
```

---

### Task 9: UserService — Replace RestTemplate with RabbitTemplate in AuthServiceImpl

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`

- [ ] **Step 1: Read current AuthServiceImpl.java to understand exact content**

The file is at `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`. Current imports include `RestTemplate`, `HttpEntity`, `HttpHeaders`, `MediaType`, `ResponseEntity`, `Map`. Current `sendVerificationEmail` method uses `RestTemplate` to POST to NotificationService.

- [ ] **Step 2: Replace imports at the top of AuthServiceImpl.java**

Remove these imports:
```java
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
```

Add these imports:
```java
import iuh.fit.UserService.domain.dto.VerificationEmailEvent;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
```

- [ ] **Step 3: Replace RestTemplate field with RabbitTemplate**

Replace:
```java
    private final RestTemplate restTemplate = new RestTemplate();
```

With:
```java
    private final RabbitTemplate rabbitTemplate;

    public AuthServiceImpl(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            PasswordEncoder encoder,
            JwtUtils jwtUtils,
            UserDetailsService userDetailsService,
            RedisTemplate<String, String> redisTemplate,
            RabbitTemplate rabbitTemplate) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.jwtUtils = jwtUtils;
        this.userDetailsService = userDetailsService;
        this.redisTemplate = redisTemplate;
        this.rabbitTemplate = rabbitTemplate;
    }
```

Remove the `@Value` annotation and `notificationServiceUrl` field:
```java
    @Value("${notification.service.url:http://notificationservice:8083}")
    private String notificationServiceUrl;
```

Remove all `@Autowired` annotations from fields (since we're switching to constructor injection for the new field, clean up the rest too). Replace all field `@Autowired` annotations with a single constructor. The full class header should look like:

```java
@Service
public class AuthServiceImpl implements AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);
    private static final SecureRandom secureRandom = new SecureRandom();

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtils jwtUtils;
    private final UserDetailsService userDetailsService;
    private final RedisTemplate<String, String> redisTemplate;
    private final RabbitTemplate rabbitTemplate;

    public AuthServiceImpl(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            PasswordEncoder encoder,
            JwtUtils jwtUtils,
            UserDetailsService userDetailsService,
            RedisTemplate<String, String> redisTemplate,
            RabbitTemplate rabbitTemplate) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.jwtUtils = jwtUtils;
        this.userDetailsService = userDetailsService;
        this.redisTemplate = redisTemplate;
        this.rabbitTemplate = rabbitTemplate;
    }
```

- [ ] **Step 4: Replace sendVerificationEmail method body**

Replace the entire `sendVerificationEmail` method:

```java
    private void sendVerificationEmail(User user) {
        try {
            String code = String.valueOf(secureRandom.nextInt(100000, 999999));

            redisTemplate.opsForValue().set(
                    "verification:" + user.getId(),
                    code,
                    Duration.ofMinutes(5)
            );

            VerificationEmailEvent event = new VerificationEmailEvent(
                    user.getId(),
                    user.getEmail(),
                    user.getFullName(),
                    code
            );

            rabbitTemplate.convertAndSend("email.exchange", "email.verification", event);
            log.info("Verification email event published for user {} ({})", user.getId(), user.getEmail());
        } catch (AmqpException e) {
            log.error("Failed to publish verification event for user {}: {}", user.getId(), e.getMessage());
        }
    }
```

- [ ] **Step 5: Remove SendVerificationEmailRequest import**

Remove this import from the top of the file:
```java
import iuh.fit.UserService.domain.dto.SendVerificationEmailRequest;
```

- [ ] **Step 6: Verify UserService compiles**

```bash
cd UserService && ./mvnw compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java
git commit -m "feat(userservice): replace RestTemplate with RabbitTemplate for email verification"
```

---

### Task 10: Clean up — Remove unused notification.service.url property

**Files:**
- Modify: `UserService/src/main/resources/application.properties`

- [ ] **Step 1: Remove notification.service.url from application.properties**

Remove this line from `UserService/src/main/resources/application.properties`:

```properties
# Notification Service
notification.service.url=${NOTIFICATION_SERVICE_URL:http://notificationservice:8083}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/resources/application.properties
git commit -m "chore(userservice): remove unused notification.service.url property"
```

---

### Task 11: Verification — Full build check

- [ ] **Step 1: Verify both services compile**

```bash
cd UserService && ./mvnw compile -q && cd ../NotificationService && ./gradlew compileJava
```

Expected: Both BUILD SUCCESS

- [ ] **Step 2: Verify docker-compose.yml syntax**

```bash
docker compose config --quiet
```

Expected: No errors (silence = valid YAML)

- [ ] **Step 3: Commit (if any changes from verification)**

```bash
git status
```

If no changes, skip. If changes, commit them.

---

### Task 12: Manual test instructions (documented, not executed)

After all tasks are complete, the user should:

1. Start the full stack: `docker compose up --build -d`
2. Wait for all services to be healthy: `docker compose ps`
3. Open RabbitMQ Management UI: `http://localhost:15672` (guest/guest)
4. Verify exchange `email.exchange` and queue `email.notifications` exist
5. Sign up a new user via the frontend
6. Check RabbitMQ Management UI → Queues → `email.notifications` → message count should go to 0 (consumed)
7. Check email inbox for verification code
8. Enter code on verify-email page
9. Sign in with verified account

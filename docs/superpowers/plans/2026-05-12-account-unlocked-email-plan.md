# Account Unlocked Email Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify users via email when their account is unlocked, using the same queue and type-based discrimination as lock events.

**Architecture:** Add `type` field ("LOCKED"/"UNLOCKED") to shared event DTO, publish unlock events from UserService with new routing key, refactor single consumer to dispatch by type.

**Tech Stack:** Java, Spring Boot, Spring AMQP, RabbitMQ, Thymeleaf

---

### Task 1: Add type field to UserService AccountLockEvent DTO

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java`

- [ ] **Step 1: Add `type` field to AccountLockEvent**

Add a `type` field as the first field in the class. Values will be `"LOCKED"` or `"UNLOCKED"`.

```java
package iuh.fit.UserService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountLockEvent {
    private String type;
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java
git commit -m "UserService: add type field to AccountLockEvent for event discrimination"
```

---

### Task 2: Add unlock routing key to UserService RabbitMQConfig

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java`

- [ ] **Step 1: Add EMAIL_UNLOCK_ROUTING_KEY constant**

Add the new constant below the existing lock routing key:

```java
public static final String EMAIL_EXCHANGE = "email.exchange";
public static final String EMAIL_ROUTING_KEY = "email.verification";
public static final String EMAIL_LOCK_ROUTING_KEY = "email.account.locked";
public static final String EMAIL_UNLOCK_ROUTING_KEY = "email.account.unlocked";
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java
git commit -m "UserService: add email.account.unlocked routing key constant"
```

---

### Task 3: Publish unlock event in AdminUserServiceImpl

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java`

- [ ] **Step 1: Refactor toggleUserStatus to publish both lock and unlock events**

Replace the event publishing block in `toggleUserStatus()` (lines 97-100):

```java
// Publish event when account is locked or unlocked
if (!willBeEnabled && lockReason != null && !lockReason.isBlank()) {
    publishAccountEvent(user, "LOCKED", RabbitMQConfig.EMAIL_LOCK_ROUTING_KEY);
} else if (willBeEnabled) {
    publishAccountEvent(user, "UNLOCKED", RabbitMQConfig.EMAIL_UNLOCK_ROUTING_KEY);
}
```

- [ ] **Step 2: Refactor publishAccountLockedEvent to generic publishAccountEvent**

Replace the existing `publishAccountLockedEvent` method (lines 105-124):

```java
private void publishAccountEvent(User user, String type, String routingKey) {
    try {
        AccountLockEvent event = new AccountLockEvent(
                type,
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getLockReason(),
                Instant.now()
        );

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EMAIL_EXCHANGE,
                routingKey,
                event
        );
        log.info("Account {} event published for user {} ({})", type.toLowerCase(), user.getId(), user.getEmail());
    } catch (AmqpException e) {
        log.error("Failed to publish account {} event for user {}: {}", type.toLowerCase(), user.getId(), e.getMessage());
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java
git commit -m "UserService: publish unlock event when toggling user status"
```

---

### Task 4: Add unlock binding to NotificationService RabbitMQConfig

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java`

- [ ] **Step 1: Add EMAIL_UNLOCK_ROUTING_KEY constant**

Add the constant below the existing routing key:

```java
public static final String EMAIL_EXCHANGE = "email.exchange";
public static final String EMAIL_QUEUE = "email.notifications";
public static final String EMAIL_ROUTING_KEY = "email.verification";
public static final String EMAIL_ACCOUNT_ROUTING_KEY = "email.account.locked";
public static final String EMAIL_UNLOCK_ROUTING_KEY = "email.account.unlocked";
public static final String EMAIL_ACCOUNT_QUEUE = "email.account.events";
public static final String DLX_EXCHANGE = "email.dlx";
public static final String DLQ_QUEUE = "email.notifications.dlq";
public static final String DLQ_ROUTING_KEY = "dlq";
```

- [ ] **Step 2: Add unlock binding bean**

Add a new binding bean method after the existing `emailAccountBinding` method (after line 85):

```java
@Bean
public Binding emailAccountUnlockBinding(Queue emailAccountQueue, TopicExchange emailExchange) {
    return BindingBuilder.bind(emailAccountQueue)
            .to(emailExchange)
            .with(EMAIL_UNLOCK_ROUTING_KEY);
}
```

- [ ] **Step 3: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java
git commit -m "NotificationService: add binding for email.account.unlocked routing key"
```

---

### Task 5: Create AccountEvent DTO in NotificationService

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountEvent.java`
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java`

- [ ] **Step 1: Create AccountEvent.java**

Create the new shared DTO with `type` field:

```java
package iuh.fit.notificationservice.Domain.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountEvent {
    private String type;
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
```

- [ ] **Step 2: Update NotificationService interface**

Replace the `sendAccountLockedEmail` method signature and import:

```java
package iuh.fit.notificationservice.Service;

import iuh.fit.notificationservice.Domain.DTO.AccountEvent;
import iuh.fit.notificationservice.Domain.DTO.NotificationResponse;
import iuh.fit.notificationservice.Domain.DTO.SendNotificationRequest;
import iuh.fit.notificationservice.Domain.DTO.SendVerificationEmailRequest;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;

public interface NotificationService {

    NotificationResponse sendNotification(SendNotificationRequest request);

    NotificationResponse sendVerificationEmail(SendVerificationEmailRequest request);

    void sendVerificationEmail(VerificationEmailEvent event);

    void sendAccountLockedEmail(AccountEvent event);

    void sendAccountUnlockedEmail(AccountEvent event);
}
```

- [ ] **Step 3: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountEvent.java NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java
git commit -m "NotificationService: create AccountEvent DTO and add sendAccountUnlockedEmail interface method"
```

---

### Task 6: Refactor AccountLockedConsumer to AccountEventConsumer

**Files:**
- Create: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountEventConsumer.java`
- Delete: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java`

- [ ] **Step 1: Create AccountEventConsumer.java**

Create the new consumer with type-based dispatch:

```java
package iuh.fit.notificationservice.Service;

import com.rabbitmq.client.Channel;
import iuh.fit.notificationservice.Config.RabbitMQConfig;
import iuh.fit.notificationservice.Domain.DTO.AccountEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
public class AccountEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(AccountEventConsumer.class);

    private final NotificationService notificationService;

    public AccountEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @RabbitListener(queues = RabbitMQConfig.EMAIL_ACCOUNT_QUEUE)
    public void handleAccountEvent(
            AccountEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("Received account {} event for user {}", event.getType().toLowerCase(), event.getUserId());

            if ("LOCKED".equals(event.getType())) {
                notificationService.sendAccountLockedEmail(event);
            } else if ("UNLOCKED".equals(event.getType())) {
                notificationService.sendAccountUnlockedEmail(event);
            } else {
                log.warn("Unknown account event type: {} for user {}", event.getType(), event.getUserId());
                channel.basicNack(deliveryTag, false, false);
                return;
            }

            channel.basicAck(deliveryTag, false);
            log.info("Successfully processed account {} event for user {}", event.getType().toLowerCase(), event.getUserId());
        } catch (Exception e) {
            log.error("Failed to process account {} event for user {}: {}", event.getType(), event.getUserId(), e.getMessage());
            try {
                channel.basicNack(deliveryTag, false, false);
            } catch (Exception nackException) {
                log.error("Failed to nack message for user {}: {}", event.getUserId(), nackException.getMessage());
            }
        }
    }
}
```

- [ ] **Step 2: Delete AccountLockedConsumer.java**

```bash
git rm NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java
```

- [ ] **Step 3: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountEventConsumer.java
git commit -m "NotificationService: refactor consumer to handle lock and unlock events by type"
```

---

### Task 7: Add sendAccountUnlockedEmail to NotificationServiceImpl

**Files:**
- Modify: `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java`

- [ ] **Step 1: Update imports**

Replace `AccountLockedEvent` import with `AccountEvent`:

```java
import iuh.fit.notificationservice.Domain.DTO.AccountEvent;
```

- [ ] **Step 2: Update sendAccountLockedEmail signature**

Change the method parameter from `AccountLockedEvent` to `AccountEvent`:

```java
@Override
public void sendAccountLockedEmail(AccountEvent event) {
```

(Keep the method body the same — `AccountEvent` has the same fields as `AccountLockedEvent` had.)

- [ ] **Step 3: Add sendAccountUnlockedEmail method**

Add this new method at the end of the class (before the closing `}`):

```java
@Override
public void sendAccountUnlockedEmail(AccountEvent event) {
    java.util.Map<String, String> templateVars = new java.util.HashMap<>();
    templateVars.put("userName", event.getFullName() != null ? event.getFullName() : "bạn");
    templateVars.put("unlockedAt", event.getTimestamp() != null
            ? event.getTimestamp().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                    .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
            : java.time.Instant.now().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                    .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

    Notification notification = Notification.builder()
            .userId(event.getUserId())
            .type(NotificationType.ACCOUNT_ALERT)
            .subject("Thông báo: Tài khoản của bạn đã được mở khóa - D4C Clothing Shop")
            .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
            .status(NotificationStatus.PENDING)
            .templateName("account-unlocked")
            .templateVars(templateVars)
            .provider(NotificationProvider.SMTP)
            .retryCount(0)
            .build();

    notificationRepository.save(notification);

    try {
        String htmlContent = emailTemplateService.render("account-unlocked", templateVars);

        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
        helper.setTo(event.getEmail());
        helper.setSubject(notification.getSubject());
        helper.setText(htmlContent, true);

        mailSender.send(mimeMessage);

        notification.setStatus(NotificationStatus.SENT);
        notification.setSentAt(LocalDateTime.now());
        notificationRepository.save(notification);

        log.info("Account unlocked email sent to {} for user {}", event.getEmail(), event.getUserId());

    } catch (MessagingException e) {
        log.error("Failed to send account unlocked email to {}: {}", event.getEmail(), e.getMessage());

        notification.setStatus(NotificationStatus.FAILED);
        notification.setErrorMessage(e.getMessage());
        notificationRepository.save(notification);

        throw new RuntimeException("Failed to send account unlocked email", e);
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java
git commit -m "NotificationService: implement sendAccountUnlockedEmail method"
```

---

### Task 8: Create account-unlocked.html email template

**Files:**
- Create: `NotificationService/src/main/resources/templates/email/account-unlocked.html`

- [ ] **Step 1: Create the template**

Create a new Thymeleaf email template matching the style of `account-locked.html`:

```html
<!DOCTYPE html>
<html xmlns:th="http://www.thymeleaf.org">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tài khoản đã được mở khóa - D4C Clothing Shop</title>
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
                            <h2 style="color: #16a34a; margin: 0 0 16px 0; font-size: 20px;">
                                Tài khoản của bạn đã được mở khóa
                            </h2>
                            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                Chào <span th:text="${userName}">bạn</span>,
                            </p>
                            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                                Tin vui! Tài khoản của bạn tại D4C Clothing Shop đã được mở khóa thành công. Bạn có thể đăng nhập và tiếp tục mua sắm.
                            </p>

                            <!-- Unlock Time -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto; width: 100%;">
                                <tr>
                                    <td style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; padding: 16px 20px;">
                                        <p style="color: #16a34a; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Thời gian mở khóa</p>
                                        <p style="color: #555555; font-size: 14px; margin: 0; line-height: 1.6;" th:text="${unlockedAt}">---</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
                                <tr>
                                    <td style="background-color: #1a1a2e; border-radius: 6px; text-align: center;">
                                        <a th:href="${frontendUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">Đăng nhập ngay</a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
                                Nếu bạn không yêu cầu mở khóa tài khoản, vui lòng liên hệ với quản trị viên hệ thống ngay lập tức.
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
git add NotificationService/src/main/resources/templates/email/account-unlocked.html
git commit -m "NotificationService: add account-unlocked email template"
```

---

### Task 9: Build verification

- [ ] **Step 1: Build UserService**

Run from `UserService/`:
```bash
./mvnw compile
```
Expected: BUILD SUCCESS

- [ ] **Step 2: Build NotificationService**

Run from `NotificationService/`:
```bash
./mvnw compile
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit any final fixes**

If build revealed issues, fix and commit. Otherwise:

```bash
git commit --allow-empty -m "build: verify UserService and NotificationService compile successfully"
```

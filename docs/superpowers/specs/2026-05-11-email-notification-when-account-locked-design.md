# Design Spec: Email Notification When User Account Is Locked

**Date:** 2026-05-11
**Status:** Draft — awaiting review

## Overview

When an admin locks a user account, the user should receive an email notification containing the lock reason. This requires changes across the frontend UI, UserService API, RabbitMQ event publishing, and NotificationService email delivery.

## Decisions Made

| Decision | Choice |
|----------|--------|
| Reason templates | Hardcoded in frontend with "Khác" option for custom text |
| RabbitMQ routing | New routing key `email.account.locked` on existing exchange/queue |
| Lock reason storage | Persist `lockReason` on `User` entity for audit |
| Support contact | Omitted from email (lock reason only) |
| Approach | Extend existing verification email pattern |

## Architecture

```
Admin UI → API Gateway → UserService → RabbitMQ → NotificationService → Email
```

## Module Changes

### 1. Frontend — UserManagement.tsx

#### Lock Dialog Enhancement

Add to the existing confirm dialog:
- **Select dropdown** with predefined reasons:
  - "Vi phạm quy định cộng đồng"
  - "Spam hoặc quảng cáo không mong muốn"
  - "Tài khoản giả mạo"
  - "Khác (nhập lý do)"
- **Textarea** for lock reason (required)
  - Auto-filled when a predefined reason is selected
  - User can edit the auto-filled content
- **Submit button** disabled when textarea is empty

#### API Call Change

```ts
// Before: PATCH /api/admin/users/{userId}/toggle-status (no body)
// After:  PATCH /api/admin/users/{userId}/toggle-status
// Body:   { "lockReason": "string" }
```

#### Files Modified
- `frontend/src/pages/admin/UserManagement.tsx` — add reason input to dialog
- `frontend/src/services/userAdminApi.ts` — update `toggleUserStatus` to accept `lockReason`
- `frontend/src/hooks/useUsers.ts` — update mutation to pass reason

### 2. UserService (Spring Boot)

#### API Update

**Endpoint:** `PATCH /api/admin/users/{id}/toggle-status`

**Request Body** (required when locking, optional when unlocking):
```json
{
  "lockReason": "string"
}
```

**Validation:** Reject with 400 if `lockReason` is missing/empty when the action is locking (user is currently enabled).

#### Entity Update

**`User` entity:** Add field:
```java
@Column(name = "lock_reason", length = 500)
private String lockReason;
```

#### Service Update

- `AdminUserService.toggleUserStatus(Long userId, String lockReason)` — accept reason parameter
- When locking: set `user.setLockReason(lockReason)`, then publish event
- When unlocking: clear `user.setLockReason(null)`

#### Event Publishing

**New DTO:** `AccountLockEvent`
```java
@Data @NoArgsConstructor @AllArgsConstructor
public class AccountLockEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
```

**Publish after successful lock:**
```java
rabbitTemplate.convertAndSend(
    RabbitMQConfig.EMAIL_EXCHANGE,
    RabbitMQConfig.EMAIL_LOCK_ROUTING_KEY,
    event
);
```

#### RabbitMQ Config Update

Add constant:
```java
public static final String EMAIL_LOCK_ROUTING_KEY = "email.account.locked";
```

#### Files Modified/Created
- `UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java` — accept request body
- `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java` — update signature
- `UserService/src/main/java/iuh/fit/UserService/Service/impl/AdminUserServiceImpl.java` — store reason, publish event
- `UserService/src/main/java/iuh/fit/UserService/Config/RabbitMQConfig.java` — add routing key constant
- `UserService/src/main/java/iuh/fit/UserService/domain/dto/AccountLockEvent.java` — new DTO
- `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java` — add lockReason field

### 3. NotificationService (Spring Boot)

#### RabbitMQ Config Update

Add binding for the new routing key to the existing queue:
```java
@Bean
public Binding accountLockedBinding(Queue emailNotificationsQueue, TopicExchange emailExchange) {
    return BindingBuilder.bind(emailNotificationsQueue)
            .to(emailExchange)
            .with(EMAIL_LOCK_ROUTING_KEY);
}
```

Add constant:
```java
public static final String EMAIL_LOCK_ROUTING_KEY = "email.account.locked";
```

#### New Consumer

**`AccountLockedConsumer.java`** — mirrors `EmailVerificationConsumer`:
```java
@RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE)
public void handleAccountLockedEmail(AccountLockedEvent event, Channel channel, ...) {
    notificationService.sendAccountLockedEmail(event);
    channel.basicAck(deliveryTag, false);
}
```

#### New DTO

**`AccountLockedEvent.java`**:
```java
@Data @NoArgsConstructor @AllArgsConstructor
public class AccountLockedEvent {
    private Long userId;
    private String email;
    private String fullName;
    private String lockReason;
    private Instant timestamp;
}
```

#### New Service Method

**`NotificationServiceImpl.sendAccountLockedEmail(AccountLockedEvent event)`**:
- Creates `Notification` record with type `ACCOUNT_ALERT`
- Template name: `account-locked`
- Template vars: `userName`, `lockReason`, `lockedAt`
- Sends via `JavaMailSender`

#### New Email Template

**`resources/templates/email/account-locked.html`**:
- Subject: "Thông báo: Tài khoản của bạn đã bị khóa - D4C Clothing Shop"
- Content in Vietnamese
- Shows: user name, lock reason, lock timestamp
- Standard D4C header/footer styling

#### Files Modified/Created
- `NotificationService/src/main/java/iuh/fit/notificationservice/Config/RabbitMQConfig.java` — add routing key + binding
- `NotificationService/src/main/java/iuh/fit/notificationservice/Domain/DTO/AccountLockedEvent.java` — new DTO
- `NotificationService/src/main/java/iuh/fit/notificationservice/Service/AccountLockedConsumer.java` — new consumer
- `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationService.java` — add method signature
- `NotificationService/src/main/java/iuh/fit/notificationservice/Service/NotificationServiceImpl.java` — implement method
- `NotificationService/src/main/resources/templates/email/account-locked.html` — new template

## Error Handling

| Scenario | Behavior |
|----------|----------|
| RabbitMQ down when publishing | Log error, continue (fire-and-forget, matching existing pattern) |
| Email send fails | Notification record marked as FAILED, message sent to DLQ |
| Admin tries to lock without reason | API returns 400, UI disables submit button |
| Admin tries to lock admin account | Existing check throws error (unchanged) |

## Acceptance Criteria Mapping

| Requirement | Implementation |
|-------------|---------------|
| Lock dialog has required reason input | Textarea with validation |
| Dialog displays predefined templates | Select dropdown with 4 options |
| Selecting template auto-fills reason | onChange handler fills textarea |
| Users can edit auto-filled reason | Textarea is always editable |
| Submit without reason not allowed | Button disabled when empty |
| API accepts lockReason | Request body with validation |
| API rejects missing/empty lockReason | 400 response when locking without reason |
| API stores lock reason | `User.lockReason` field persisted |
| RabbitMQ event produced after lock | `AccountLockEvent` published |
| Event contains email + reason | DTO includes all required fields |
| Notification service consumes event | `AccountLockedConsumer` listens on queue |
| Email sent to locked user | `sendAccountLockedEmail` delivers via SMTP |
| Email contains lock reason | Template renders `lockReason` variable |

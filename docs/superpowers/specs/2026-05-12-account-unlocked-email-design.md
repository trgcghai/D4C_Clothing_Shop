# Design: Account Unlocked Email Notification

## Overview

Add email notification when admin unlocks a user account. Both lock and unlock events share the same queue (`email.account.events`) and are discriminated by a `type` field.

## Architecture

```
UserService (Producer)                    NotificationService (Consumer)
├── toggleUserStatus()                    ├── AccountEventConsumer
│   ├── LOCKED → email.account.locked     │   ├── type="LOCKED" → sendAccountLockedEmail()
│   └── UNLOCKED → email.account.unlocked │   └── type="UNLOCKED" → sendAccountUnlockedEmail()
│                                         │
└── RabbitMQConfig                        ├── RabbitMQConfig
    ├── EMAIL_ROUTING_KEY = locked        │   ├── binding: email.account.events ← email.exchange
    └── EMAIL_UNLOCK_ROUTING_KEY = unlocked│   └── binding: email.account.events ← email.exchange (unlocked)
                                          │
                                          └── NotificationServiceImpl
                                              ├── sendAccountLockedEmail()
                                              └── sendAccountUnlockedEmail() (new)
```

## UserService Changes

### 1. `AccountLockEvent.java`
Add `String type` field. Values: `"LOCKED"` or `"UNLOCKED"`.

### 2. `RabbitMQConfig.java`
Add constant:
```java
public static final String EMAIL_UNLOCK_ROUTING_KEY = "email.account.unlocked";
```

### 3. `AdminUserServiceImpl.java`
In `toggleUserStatus()`:
- When locking (disabling): publish event with `type = "LOCKED"`, routing key `email.account.locked`
- When unlocking (enabling): publish event with `type = "UNLOCKED"`, routing key `email.account.unlocked`

Rename `publishAccountLockedEvent()` → `publishAccountEvent(User user, String type, String routingKey)`.

## NotificationService Changes

### 4. `RabbitMQConfig.java`
Add binding:
```java
Binding bindingAccountUnlock = BindingBuilder.bind(emailAccountQueue)
    .to(emailExchange)
    .with(RabbitMQConfig.EMAIL_UNLOCK_ROUTING_KEY);
```

### 5. `AccountLockedEvent.java` → `AccountEvent.java`
Add `String type` field. Rename class to `AccountEvent` to reflect both event types.

### 6. `AccountLockedConsumer.java` → `AccountEventConsumer.java`
Single `@RabbitListener` on `email.account.events`:
```java
public void handleAccountEvent(AccountEvent event, Channel channel, @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
    if ("LOCKED".equals(event.getType())) {
        notificationService.sendAccountLockedEmail(event);
    } else if ("UNLOCKED".equals(event.getType())) {
        notificationService.sendAccountUnlockedEmail(event);
    }
    channel.basicAck(deliveryTag, false);
}
```

### 7. `NotificationServiceImpl.java`
Add `sendAccountUnlockedEmail(AccountEvent event)`:
- Template: `account-unlocked`
- Type: `ACCOUNT_ALERT`
- Variables: `userName`, `unlockedAt` (formatted `dd/MM/yyyy HH:mm`, Asia/Ho_Chi_Minh)

### 8. `account-unlocked.html`
New Thymeleaf template in `NotificationService/src/main/resources/templates/email/`:
- Subject: "Your Account Has Been Unlocked"
- Content: greeting, account restored message, unlocked timestamp, CTA to login

## Data Flow

1. Admin calls `PATCH /api/admin/users/{id}/toggle-status`
2. `AdminUserServiceImpl.toggleUserStatus()` toggles `user.enabled`, clears `lockReason`
3. If unlocking: `publishAccountEvent(user, "UNLOCKED", "email.account.unlocked")`
4. RabbitMQ routes to `email.account.events` queue via topic exchange binding
5. `AccountEventConsumer` reads `type` field, dispatches to `sendAccountUnlockedEmail()`
6. Email rendered via Thymeleaf, sent via SMTP, notification persisted

## Error Handling

- Manual ACK mode retained
- Failed messages NACKed with `requeue=false` → DLQ
- Publisher catches `AmqpException`, logs, allows transaction to proceed

## Files Modified

| Service | File | Change |
|---|---|---|
| UserService | `domain/dto/AccountLockEvent.java` | Add `type` field |
| UserService | `Config/RabbitMQConfig.java` | Add `EMAIL_UNLOCK_ROUTING_KEY` |
| UserService | `Service/impl/AdminUserServiceImpl.java` | Publish unlock event |
| NotificationService | `Config/RabbitMQConfig.java` | Add unlock binding |
| NotificationService | `Domain/DTO/AccountLockedEvent.java` | Rename to `AccountEvent`, add `type` |
| NotificationService | `Service/AccountLockedConsumer.java` | Rename to `AccountEventConsumer`, add type dispatch |
| NotificationService | `Service/NotificationServiceImpl.java` | Add `sendAccountUnlockedEmail()` |
| NotificationService | `templates/email/account-unlocked.html` | New template |

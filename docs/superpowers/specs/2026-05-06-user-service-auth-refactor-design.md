# UserService: Auth Service Extraction + Email Verification Design

**Date:** 2026-05-06
**Status:** Approved

## Overview

Extract login/signup logic from `AuthController` into a dedicated `AuthService` layer. Add `emailVerification` field to `User` entity. After signup, generate a 6-digit verification code, store it in Redis (5-min TTL), and call NotificationService to send the verification email.

## Changes in UserService Only

### 1. New Dependencies (pom.xml)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 2. User Entity Change

Add field to `User.java`:

```java
@Column(nullable = false)
private Boolean emailVerification = false;
```

JPA `ddl-auto=update` will auto-create the column.

### 3. AuthService Interface

`UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java`

```java
public interface AuthService {
    JwtResponse login(LoginRequest request);
    void register(SignupRequest request);
}
```

### 4. AuthServiceImpl

`UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`

Moves all business logic from `AuthController.signup()` and `AuthController.authenticateUser()`:

- **login()**: authenticate via `AuthenticationManager`, generate JWT + refresh token, persist refresh token, return `JwtResponse`
- **register()**: check username/email uniqueness, create user with `emailVerification=false`, save to DB, generate 6-digit code, store in Redis with 5-min TTL, call NotificationService to send verification email

**Redis key format:** `verification:{userId}`
**Code generation:** `SecureRandom.nextInt(100000, 999999)`

**NotificationService call:**
- Use `RestTemplate` (synchronous, simple)
- URL: `${NOTIFICATION_SERVICE_URL:http://notificationservice:8083}/api/notifications/send-verification`
- Request body: `SendVerificationEmailRequest` DTO (userId, userName, email, verificationCode)
- Wrapped in try-catch — if NotificationService is down, log warning but don't block signup

### 5. AuthController (thinned)

`AuthController` keeps:
- Cookie building helpers (`buildRefreshCookie`, `extractRefreshTokenFromCookie`)
- `signOut()` endpoint (stays in controller, simple)
- `refreshToken()` endpoint (stays in controller, involves cookie handling)

`signin` and `signup` endpoints delegate to `AuthService`:

```java
@PostMapping("/signin")
public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest request) {
    JwtResponse response = authService.login(request);
    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.getRefreshToken()).toString())
            .body(response);
}

@PostMapping("/signup")
public ResponseEntity<?> registerUser(@Valid @RequestBody SignupRequest request) {
    authService.register(request);
    return ResponseEntity.ok(Map.of("message", "User registered successfully!"));
}
```

**Note:** `JwtResponse` needs a `refreshToken` field added so the controller can set the cookie.

### 6. DTOs

**Add to UserService:** `SendVerificationEmailRequest.java` (mirrors NotificationService's DTO)

```java
@Data
public class SendVerificationEmailRequest {
    private Long userId;
    private String userName;
    private String email;
    private String verificationCode;
}
```

**Modify `JwtResponse`:** add `private String refreshToken;` field

### 7. Config

**application.properties** — add:

```properties
# Redis
spring.data.redis.host=${REDIS_HOST:localhost}
spring.data.redis.port=${REDIS_PORT:6379}

# Notification Service
notification.service.url=${NOTIFICATION_SERVICE_URL:http://notificationservice:8083}
```

**.env** — add:

```
REDIS_HOST=redis
REDIS_PORT=6379
NOTIFICATION_SERVICE_URL=http://notificationservice:8083
```

**.env.example** — add:

```
REDIS_HOST=
REDIS_PORT=
NOTIFICATION_SERVICE_URL=
```

### 8. Redis Config

`UserService/src/main/java/iuh/fit/UserService/Config/RedisConfig.java`

```java
@Configuration
@EnableCaching
public class RedisConfig {
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        return template;
    }
}
```

## File Structure

```
UserService/src/main/java/iuh/fit/UserService/
  Service/
    AuthService.java                    # NEW - interface
    AuthServiceImpl.java                # NEW - implementation
  Config/
    RedisConfig.java                    # NEW
  domain/
    dto/
      SendVerificationEmailRequest.java # NEW
      JwtResponse.java                  # MODIFIED - add refreshToken field
    entity/
      User.java                         # MODIFIED - add emailVerification field
  Controller/
    AuthController.java                 # MODIFIED - thin, delegates to AuthService
  pom.xml                               # MODIFIED - add Redis dependency
  src/main/resources/
    application.properties              # MODIFIED - add Redis + notification URL
    .env                                # MODIFIED - add Redis + notification URL
    .env.example                        # MODIFIED - add Redis + notification URL
```

## Data Flow: Signup

1. User calls `POST /api/auth/signup` with `SignupRequest`
2. `AuthController` delegates to `AuthService.register()`
3. `AuthServiceImpl` validates username/email uniqueness
4. Creates `User` entity with `emailVerification=false`, saves to DB
5. Generates 6-digit code via `SecureRandom`
6. Stores code in Redis: `SET verification:{userId} {code} EX 300`
7. Calls NotificationService `POST /api/notifications/send-verification` with userId, userName, email, verificationCode
8. If NotificationService fails, logs warning — signup still succeeds
9. Returns `200 OK`

## Data Flow: Login

1. User calls `POST /api/auth/signin` with `LoginRequest`
2. `AuthController` delegates to `AuthService.login()`
3. `AuthServiceImpl` authenticates via `AuthenticationManager`
4. Generates access token + refresh token
5. Persists refresh token to DB
6. Returns `JwtResponse` with token, refreshToken, user info
7. Controller sets refresh token as HTTP-only cookie

## Error Handling

- NotificationService down: log warning, signup succeeds
- Redis down: log error, signup succeeds (verification code not stored)
- Duplicate username/email: return 400 (existing behavior)

# Email Verification Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/auth/verify-email` endpoint that validates a 6-digit code against Redis and sets user's `emailVerification` to `true`.

**Architecture:** Single endpoint in AuthController delegates to `AuthService.verifyEmail()`. Service looks up code in Redis, validates, updates user entity, deletes Redis key.

**Tech Stack:** Spring Boot 3.3.1, Java 21, Maven, Redis, Lombok

---

### Task 1: Create VerifyEmailRequest DTO

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/domain/dto/VerifyEmailRequest.java`

- [ ] **Step 1: Create DTO**

Create `UserService/src/main/java/iuh/fit/UserService/domain/dto/VerifyEmailRequest.java`:

```java
package iuh.fit.UserService.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerifyEmailRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotBlank(message = "Verification code is required")
    @Size(min = 6, max = 6, message = "Verification code must be exactly 6 digits")
    private String verificationCode;
}
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/VerifyEmailRequest.java
git commit -m "feat: add VerifyEmailRequest DTO"
```

---

### Task 2: Add verifyEmail to AuthService Interface and Implementation

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`

- [ ] **Step 1: Add method to AuthService interface**

Replace `UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java` with:

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.LoginResult;
import iuh.fit.UserService.domain.dto.SignupRequest;

public interface AuthService {
    LoginResult login(LoginRequest request);
    void register(SignupRequest request);
    void verifyEmail(Long userId, String verificationCode);
}
```

- [ ] **Step 2: Add verifyEmail implementation to AuthServiceImpl**

Add this method to `AuthServiceImpl.java` (before the closing brace of the class):

```java
    @Override
    public void verifyEmail(Long userId, String verificationCode) {
        String storedCode = redisTemplate.opsForValue().get("verification:" + userId);

        if (storedCode == null) {
            throw new RuntimeException("Verification code has expired or is invalid");
        }

        if (!storedCode.equals(verificationCode)) {
            throw new RuntimeException("Verification code is incorrect");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setEmailVerification(true);
        userRepository.save(user);

        redisTemplate.delete("verification:" + userId);

        log.info("Email verified successfully for user {}", userId);
    }
```

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java
git commit -m "feat: add verifyEmail method to AuthService"
```

---

### Task 3: Add verify-email Endpoint to AuthController

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java`

- [ ] **Step 1: Add import and endpoint**

Add `VerifyEmailRequest` to the imports in `AuthController.java`:

```java
import iuh.fit.UserService.domain.dto.VerifyEmailRequest;
```

Add this method to `AuthController.java` (after the `signup` endpoint, before `signOut`):

```java
    @PostMapping("/verify-email")
    @Operation(summary = "Verify email", description = "Verify user email with 6-digit code sent via email.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Email verified successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid or expired verification code")
    })
    public ResponseEntity<?> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request.getUserId(), request.getVerificationCode());
        return ResponseEntity.ok(Map.of("message", "Email verified successfully"));
    }
```

- [ ] **Step 2: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java
git commit -m "feat: add POST /api/auth/verify-email endpoint"
```

---

### Task 4: Verify Build

- [ ] **Step 1: Run Maven compile**

Run from `UserService/`:
```bash
./mvnw clean compile
```
Expected: BUILD SUCCESS

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: address compilation issues"
```

# Double Opt-In Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace immediate DB user creation on signup with Redis-stored pending data, only creating the DB user after email verification succeeds.

**Architecture:** Signup stores `SignupRequest` data in Redis hash with 5-minute TTL. Verification looks up pending data by email, verifies OTP, creates DB user, and cleans up Redis. Frontend sends `email` instead of `userId` to verify endpoint.

**Tech Stack:** Java 21, Spring Boot 3.3.1, Spring Data Redis, React 19, TypeScript, TanStack Query

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `UserService/.../domain/dto/VerifyEmailRequest.java` | Modify | Replace `userId` with `email` field |
| `UserService/.../Service/AuthService.java` | Modify | Change `verifyEmail(Long, String)` → `verifyEmail(String, String)` |
| `UserService/.../Service/impl/AuthServiceImpl.java` | Modify | Rewrite `register()` to use Redis, rewrite `verifyEmail()` to create DB user |
| `UserService/.../Controller/AuthController.java` | Modify | Update `verifyEmail` endpoint to pass email |
| `frontend/src/services/authApi.ts` | Modify | Update `VerifyEmailRequest` type and `verifyEmail()` payload |
| `frontend/src/pages/VerifyEmail.tsx` | Modify | Remove userId lookup, send email directly |

---

### Task 1: Update VerifyEmailRequest DTO

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/dto/VerifyEmailRequest.java`

- [ ] **Step 1: Replace userId with email field**

Replace the entire file content with:
```java
package iuh.fit.UserService.domain.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerifyEmailRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;

    @NotBlank(message = "Verification code is required")
    @Size(min = 6, max = 6, message = "Verification code must be exactly 6 digits")
    private String verificationCode;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/VerifyEmailRequest.java
git commit -m "refactor: replace userId with email in VerifyEmailRequest for double opt-in"
```

---

### Task 2: Update AuthService Interface

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java`

- [ ] **Step 1: Change verifyEmail signature**

Replace the entire file content with:
```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.domain.dto.LoginRequest;
import iuh.fit.UserService.domain.dto.LoginResult;
import iuh.fit.UserService.domain.dto.SignupRequest;

public interface AuthService {
    LoginResult login(LoginRequest request);
    void register(SignupRequest request);
    void verifyEmail(String email, String verificationCode);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS (will show error in AuthServiceImpl — that's expected, fixed in Task 3)

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/AuthService.java
git commit -m "refactor: change verifyEmail signature to use email instead of userId"
```

---

### Task 3: Rewrite AuthServiceImpl register() and verifyEmail()

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/impl/AuthServiceImpl.java`

- [ ] **Step 1: Add constants and update register() method**

Add these constants after the existing ones (after line 37):
```java
private static final String PENDING_SIGNUP_KEY_PREFIX = "pending_signup:email:";
private static final String VERIFICATION_KEY_PREFIX = "verification:email:";
private static final long PENDING_TTL_MINUTES = 5;
```

Replace the `register()` method (lines 99-121) with:
```java
@Override
public void register(SignupRequest request) {
    if (userRepository.existsByUsername(request.getUsername())) {
        throw new RuntimeException("Error: Username is already taken!");
    }

    if (userRepository.existsByEmail(request.getEmail())) {
        throw new RuntimeException("Error: Email is already taken!");
    }

    String pendingKey = PENDING_SIGNUP_KEY_PREFIX + request.getEmail().toLowerCase();
    if (Boolean.TRUE.equals(redisTemplate.hasKey(pendingKey))) {
        throw new RuntimeException("Error: Email already has pending verification. Please check your inbox.");
    }

    storePendingSignup(request);
    sendVerificationEmail(request);
}
```

- [ ] **Step 2: Add storePendingSignup() helper**

Add this private method after the `register()` method:
```java
private void storePendingSignup(SignupRequest request) {
    String key = PENDING_SIGNUP_KEY_PREFIX + request.getEmail().toLowerCase();

    redisTemplate.opsForHash().put(key, "username", request.getUsername());
    redisTemplate.opsForHash().put(key, "email", request.getEmail());
    redisTemplate.opsForHash().put(key, "fullName", request.getFullName());
    redisTemplate.opsForHash().put(key, "phoneNumber", request.getPhoneNumber());
    redisTemplate.opsForHash().put(key, "password", encoder.encode(request.getPassword()));
    redisTemplate.opsForHash().put(key, "role", request.getRole() != null ? request.getRole().name() : Role.USER.name());

    redisTemplate.expire(key, Duration.ofMinutes(PENDING_TTL_MINUTES));
}
```

- [ ] **Step 3: Rewrite sendVerificationEmail() to use email-based keys**

Replace the existing `sendVerificationEmail(User user)` method with:
```java
private void sendVerificationEmail(SignupRequest request) {
    try {
        String code = String.valueOf(secureRandom.nextInt(100000, 1000000));

        String verificationKey = VERIFICATION_KEY_PREFIX + request.getEmail().toLowerCase();
        redisTemplate.opsForValue().set(verificationKey, code, Duration.ofMinutes(PENDING_TTL_MINUTES));

        VerificationEmailEvent event = new VerificationEmailEvent(
                null,
                request.getEmail(),
                request.getFullName(),
                code);

        rabbitTemplate.convertAndSend(RabbitMQConfig.EMAIL_EXCHANGE, RabbitMQConfig.EMAIL_ROUTING_KEY, event);
        log.info("Verification email event published for pending signup ({})", request.getEmail());
    } catch (AmqpException e) {
        log.error("Failed to publish verification event for pending signup {}: {}", request.getEmail(), e.getMessage());
    }
}
```

- [ ] **Step 4: Rewrite verifyEmail() to create DB user from Redis data**

Replace the existing `verifyEmail(Long userId, String verificationCode)` method with:
```java
@Override
public void verifyEmail(String email, String verificationCode) {
    String normalizedEmail = email.toLowerCase();

    String verificationKey = VERIFICATION_KEY_PREFIX + normalizedEmail;
    String storedCode = redisTemplate.opsForValue().get(verificationKey);

    if (storedCode == null) {
        throw new RuntimeException("Verification code has expired or is invalid");
    }

    if (!storedCode.equals(verificationCode)) {
        throw new RuntimeException("Verification code is incorrect");
    }

    String pendingKey = PENDING_SIGNUP_KEY_PREFIX + normalizedEmail;
    Map<Object, Object> pendingData = redisTemplate.opsForHash().entries(pendingKey);

    if (pendingData.isEmpty()) {
        throw new RuntimeException("No pending signup found for this email. Please sign up first.");
    }

    User user = new User();
    user.setUsername((String) pendingData.get("username"));
    user.setEmail(normalizedEmail);
    user.setFullName((String) pendingData.get("fullName"));
    user.setPhoneNumber((String) pendingData.get("phoneNumber"));
    user.setPassword((String) pendingData.get("password"));
    user.setRole(Role.valueOf((String) pendingData.get("role")));
    user.setEmailVerification(true);
    user.setEnabled(true);

    userRepository.save(user);

    redisTemplate.delete(verificationKey);
    redisTemplate.delete(pendingKey);

    log.info("Email verified and account created for user {} ({})", user.getId(), normalizedEmail);
}
```

Add this import at the top of the file:
```java
import java.util.Map;
```

- [ ] **Step 5: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Service/impl/AuthServiceImpl.java
git commit -m "feat: implement double opt-in signup with Redis pending data"
```

---

### Task 4: Update AuthController verifyEmail Endpoint

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java`

- [ ] **Step 1: Update verifyEmail method**

Replace the `verifyEmail` method (lines 128-137) with:
```java
@PostMapping("/verify-email")
@Operation(summary = "Verify email", description = "Verify user email with 6-digit code sent via email. Creates account after successful verification.")
@ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Email verified successfully. Account created."),
        @ApiResponse(responseCode = "400", description = "Invalid or expired verification code")
})
public ResponseEntity<?> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
    authService.verifyEmail(request.getEmail(), request.getVerificationCode());
    return ResponseEntity.ok(Map.of("message", "Email verified successfully. Account created."));
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java
git commit -m "feat: update verify-email endpoint to accept email instead of userId"
```

---

### Task 5: Update Frontend authApi.ts

**Files:**
- Modify: `frontend/src/services/authApi.ts`

- [ ] **Step 1: Update VerifyEmailRequest type**

Replace the `VerifyEmailRequest` interface (lines 69-72) with:
```typescript
export interface VerifyEmailRequest {
  email: string;
  verificationCode: string;
}
```

- [ ] **Step 2: Remove getUserIdByEmail function**

Remove the `getUserIdByEmail` function (lines 148-158):
```typescript
// REMOVED: getUserIdByEmail - no longer needed with double opt-in
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/authApi.ts
git commit -m "refactor: update verifyEmail payload to use email instead of userId"
```

---

### Task 6: Update Frontend VerifyEmail.tsx

**Files:**
- Modify: `frontend/src/pages/VerifyEmail.tsx`

- [ ] **Step 1: Simplify the component**

Replace the entire file content with:
```tsx
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { REGEXP_ONLY_DIGITS } from "input-otp";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useVerifyEmail } from "../hooks/useAuth";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  const [otpValue, setOtpValue] = useState("");

  const { mutate, isPending, error } = useVerifyEmail();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!email) {
    navigate("/signup", { replace: true });
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);

    if (otpValue.length !== 6) return;

    mutate(
      { email, verificationCode: otpValue },
      {
        onSuccess: () => {
          setSuccessMessage(
            "Email verified successfully! Account created. Redirecting to sign in...",
          );
          setOtpValue("");
          setTimeout(() => navigate("/signin"), 1500);
        },
      },
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-md px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {email}. The code is valid for 5 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p
              className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {error.message}
            </p>
          ) : null}

          {successMessage ? (
            <p
              className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              role="status"
              aria-live="polite"
            >
              {successMessage}
            </p>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={otpValue}
                onChange={setOtpValue}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Verifying..." : "Verify"}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm text-(--sea-ink-soft)">
            <p>
              <Link to="/signin" className="font-medium">
                Back to Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default VerifyEmail;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/VerifyEmail.tsx
git commit -m "feat: simplify verify email page for double opt-in flow"
```

---

### Task 7: Update useAuth Hook

**Files:**
- Modify: `frontend/src/hooks/useAuth.ts` (or wherever `useVerifyEmail` is defined)

- [ ] **Step 1: Find and update useVerifyEmail**

Search for `useVerifyEmail` in the hooks directory. Update the mutation to use the new `VerifyEmailRequest` type (email instead of userId). The mutation key and function call should remain the same since `authApi.verifyEmail()` already accepts the updated type.

If the hook has explicit typing like `UseMutate<..., { userId: number, verificationCode: string }>`, update it to `{ email: string, verificationCode: string }`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useAuth.ts
git commit -m "refactor: update useVerifyEmail hook types for email-based verification"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run backend tests**

Run: `cd UserService && ./mvnw clean test -q`
Expected: All rate limiter tests pass (40/40). Pre-existing errors in UserControllerValidationTest and UserServiceApplicationTests are unrelated.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: BUILD SUCCESS (no TypeScript errors)

- [ ] **Step 3: Verify git log**

Run: `git log --oneline -15`

You should see commits for all 8 tasks on the branch.

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: final verification for double opt-in signup"
```

---

## Self-Review

**Spec coverage:**
- ✅ Don't create DB user on signup — Task 3 (`register()` stores in Redis only)
- ✅ Store signup data in Redis with TTL — Task 3 (`storePendingSignup()`, 5 min TTL)
- ✅ Only create DB user after verification — Task 3 (`verifyEmail()` creates user)
- ✅ Check DB for existing users first — Task 3 (`existsByUsername`, `existsByEmail`)
- ✅ Check Redis for pending signup — Task 3 (`hasKey` check)
- ✅ Verify endpoint uses email — Task 1, 2, 4, 5, 6
- ✅ Frontend updated — Task 5, 6, 7

**Placeholder scan:** No TBD, TODO, or vague instructions. All code blocks are complete.

**Type consistency:** `VerifyEmailRequest` has `email: String` (backend) and `email: string` (frontend). `verifyEmail(String email, String verificationCode)` matches across interface, implementation, and controller. Frontend mutation sends `{ email, verificationCode }` matching the API type.

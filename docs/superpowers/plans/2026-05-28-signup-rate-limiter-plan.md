# Signup Rate Limiter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rate limiting to `/api/auth/signup` endpoint using IP + email tracking via Redis, following the existing signin rate limiter pattern.

**Architecture:** Extend `RateLimitInterceptor` with signup-specific constants and logic. Extract a reusable `checkRateLimit()` helper to avoid duplicating Redis ZSet operations. Parse email from request body for signup requests.

**Tech Stack:** Java 21, Spring Boot 3.3.1, Spring Data Redis, JUnit 5, MockMvc

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java` | Modify | Add signup rate limiting constants, extract `checkRateLimit()` helper, add signup branch in `preHandle()` |
| `UserService/src/test/java/iuh/fit/UserService/Config/RateLimitInterceptorTest.java` | Create | Unit tests for signin + signup rate limiting with mocked Redis |

---

### Task 1: Rename Existing Constants

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java:20-22`

- [ ] **Step 1: Rename constants for clarity**

Change lines 20-22 from:
```java
private static final String KEY_PREFIX = "ratelimit:userservice:signin:";
private static final int LIMIT = 5;
private static final long WINDOW_MS = 60000;
```

To:
```java
private static final String SIGNIN_KEY_PREFIX = "ratelimit:userservice:signin:";
private static final int SIGNIN_LIMIT = 5;
private static final long WINDOW_MS = 60000;
```

- [ ] **Step 2: Update references to renamed constants**

In `preHandle()`, update line 35 from:
```java
String key = KEY_PREFIX + ip;
```
To:
```java
String key = SIGNIN_KEY_PREFIX + ip;
```

And update line 45 from:
```java
if (count != null && count > LIMIT) {
```
To:
```java
if (count != null && count > SIGNIN_LIMIT) {
```

- [ ] **Step 3: Verify existing signin behavior still works**

Run: `cd UserService && ./mvnw test -Dtest=SecurityConfigTest -q`
Expected: PASS (no behavior change, just renamed constants)

- [ ] **Step 4: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java
git commit -m "refactor: rename rate limiter constants to distinguish signin from signup"
```

---

### Task 2: Add Signup Constants and Extract Helper Method

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`

- [ ] **Step 1: Add signup constants**

Add after the existing constants (after `SIGNIN_LIMIT`):
```java
private static final String SIGNUP_IP_KEY_PREFIX = "ratelimit:userservice:signup:ip:";
private static final String SIGNUP_EMAIL_KEY_PREFIX = "ratelimit:userservice:signup:email:";
private static final int SIGNUP_IP_LIMIT = 3;
private static final int SIGNUP_EMAIL_LIMIT = 2;
```

- [ ] **Step 2: Extract `checkRateLimit()` helper method**

Add this private method before the closing brace of the class:
```java
private boolean checkRateLimit(String key, int limit, HttpServletResponse response, String errorType) {
    long now = System.currentTimeMillis();
    long windowStart = now - WINDOW_MS;

    try {
        redisTemplate.opsForZSet().add(key, UUID.randomUUID().toString(), (double) now);
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
        Long count = redisTemplate.opsForZSet().count(key, windowStart, now);
        redisTemplate.expire(key, 60, TimeUnit.SECONDS);

        if (count != null && count > limit) {
            response.setStatus(429);
            response.setHeader("Retry-After", "30");
            response.setHeader("Content-Type", "application/json");
            String message = "signup".equals(errorType)
                    ? "Too many signup attempts. Please try again later."
                    : "Too many login attempts. Please try again later.";
            response.getWriter().write("{\"error\":\"" + message + "\",\"retryAfter\":30}");
            return false;
        }
    } catch (IOException e) {
        log.error("[RateLimiter] Failed to write rate limit response: {}", e.getMessage());
        return false;
    } catch (Exception e) {
        log.warn("[RateLimiter] Redis unavailable, allowing request through: {}", e.getMessage());
        return true;
    }

    return true;
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java
git commit -m "feat: add signup rate limit constants and extract checkRateLimit helper"
```

---

### Task 3: Add Signup Branch in preHandle()

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`

- [ ] **Step 1: Add email extraction helper**

Add this private method after `checkRateLimit()`:
```java
private String extractEmailFromBody(HttpServletRequest request) {
    try {
        request.getInputStream().mark(Integer.MAX_VALUE);
        String body = new String(request.getInputStream().readAllBytes());
        request.getInputStream().reset();

        int emailStart = body.indexOf("\"email\"");
        if (emailStart == -1) return null;

        int colonIndex = body.indexOf(':', emailStart);
        if (colonIndex == -1) return null;

        int quoteStart = body.indexOf('"', colonIndex + 1);
        if (quoteStart == -1) return null;

        int quoteEnd = body.indexOf('"', quoteStart + 1);
        if (quoteEnd == -1) return null;

        return body.substring(quoteStart + 1, quoteEnd);
    } catch (IOException e) {
        log.warn("[RateLimiter] Failed to parse email from request body: {}", e.getMessage());
        return null;
    }
}
```

- [ ] **Step 2: Update preHandle() to handle both signin and signup**

Replace the entire `preHandle()` method with:
```java
@Override
public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
    if (!"POST".equalsIgnoreCase(request.getMethod())) {
        return true;
    }

    String uri = request.getRequestURI();

    if (uri.equals("/api/auth/signin")) {
        String ip = request.getRemoteAddr();
        String key = SIGNIN_KEY_PREFIX + ip;
        return checkRateLimit(key, SIGNIN_LIMIT, response, "signin");
    }

    if (uri.equals("/api/auth/signup")) {
        String ip = request.getRemoteAddr();
        String ipKey = SIGNUP_IP_KEY_PREFIX + ip;
        if (!checkRateLimit(ipKey, SIGNUP_IP_LIMIT, response, "signup")) {
            return false;
        }

        String email = extractEmailFromBody(request);
        if (email != null && !email.isBlank()) {
            String emailKey = SIGNUP_EMAIL_KEY_PREFIX + email.toLowerCase();
            if (!checkRateLimit(emailKey, SIGNUP_EMAIL_LIMIT, response, "signup")) {
                return false;
            }
        }
        return true;
    }

    return true;
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd UserService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java
git commit -m "feat: add signup rate limiting with IP and email tracking"
```

---

### Task 4: Write Unit Tests

**Files:**
- Create: `UserService/src/test/java/iuh/fit/UserService/Config/RateLimitInterceptorTest.java`

- [ ] **Step 1: Create test class with mocked Redis**

```java
package iuh.fit.UserService.Config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RateLimitInterceptorTest {

    private RedisTemplate<String, String> redisTemplate;
    private ZSetOperations<String, String> zSetOps;
    private RateLimitInterceptor interceptor;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(RedisTemplate.class);
        zSetOps = mock(ZSetOperations.class);
        when(redisTemplate.opsForZSet()).thenReturn(zSetOps);
        interceptor = new RateLimitInterceptor(redisTemplate);
    }

    private MockHttpServletRequest createPostRequest(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("POST");
        request.setRequestURI(uri);
        request.setRemoteAddr("192.168.1.100");
        return request;
    }

    private MockHttpServletRequest createSignupRequest(String email) {
        MockHttpServletRequest request = createPostRequest("/api/auth/signup");
        request.setContent(("{" +
                "\"username\":\"testuser\"," +
                "\"email\":\"" + email + "\"," +
                "\"password\":\"Test123!\"," +
                "\"fullName\":\"Test User\"," +
                "\"phoneNumber\":\"0123456789\"" +
                "}").getBytes());
        return request;
    }
}
```

- [ ] **Step 2: Add signin rate limit tests**

Add these test methods to the class:
```java
@Test
void signin_Allowed_WhenUnderLimit() throws Exception {
    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(3L);

    MockHttpServletRequest request = createPostRequest("/api/auth/signin");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result);
    assertEquals(200, response.getStatus());
}

@Test
void signin_Blocked_WhenOverLimit() throws Exception {
    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(6L);

    MockHttpServletRequest request = createPostRequest("/api/auth/signin");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertFalse(result);
    assertEquals(429, response.getStatus());
    assertEquals("30", response.getHeader("Retry-After"));
    assertTrue(response.getContentAsString().contains("Too many login attempts"));
}
```

- [ ] **Step 3: Add signup IP rate limit tests**

```java
@Test
void signupIp_Allowed_WhenUnderLimit() throws Exception {
    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

    MockHttpServletRequest request = createSignupRequest("test@example.com");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result);
    assertEquals(200, response.getStatus());
}

@Test
void signupIp_Blocked_WhenOverLimit() throws Exception {
    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(4L);

    MockHttpServletRequest request = createSignupRequest("test@example.com");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertFalse(result);
    assertEquals(429, response.getStatus());
    assertTrue(response.getContentAsString().contains("Too many signup attempts"));
}
```

- [ ] **Step 4: Add signup email rate limit tests**

```java
@Test
void signupEmail_Blocked_WhenOverLimit() throws Exception {
    // IP check passes (first call returns 1)
    // Email check fails (second call returns 3)
    when(zSetOps.count(anyString(), anyDouble(), anyDouble()))
            .thenReturn(1L)
            .thenReturn(3L);

    MockHttpServletRequest request = createSignupRequest("test@example.com");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertFalse(result);
    assertEquals(429, response.getStatus());
}

@Test
void signupEmail_Allowed_WhenUnderLimit() throws Exception {
    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(1L);

    MockHttpServletRequest request = createSignupRequest("test@example.com");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result);
}
```

- [ ] **Step 5: Add edge case tests**

```java
@Test
void signup_SkipsEmailCheck_WhenBodyEmpty() throws Exception {
    MockHttpServletRequest request = createPostRequest("/api/auth/signup");
    MockHttpServletResponse response = new MockHttpServletResponse();

    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result);
    // Only IP key checked, not email key
    verify(zSetOps, times(1)).count(anyString(), anyDouble(), anyDouble());
}

@Test
void signup_SkipsEmailCheck_WhenParseFails() throws Exception {
    MockHttpServletRequest request = createPostRequest("/api/auth/signup");
    request.setContent("not-json".getBytes());
    MockHttpServletResponse response = new MockHttpServletResponse();

    when(zSetOps.count(anyString(), anyDouble(), anyDouble())).thenReturn(2L);

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result);
    verify(zSetOps, times(1)).count(anyString(), anyDouble(), anyDouble());
}

@Test
void signup_Allowed_WhenRedisFails() throws Exception {
    when(zSetOps.count(anyString(), anyDouble(), anyDouble()))
            .thenThrow(new RuntimeException("Redis connection refused"));

    MockHttpServletRequest request = createSignupRequest("test@example.com");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result); // Fail-open
    assertEquals(200, response.getStatus());
}

@Test
void getRequests_NotRateLimited() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setMethod("GET");
    request.setRequestURI("/api/auth/signin");
    MockHttpServletResponse response = new MockHttpServletResponse();

    boolean result = interceptor.preHandle(request, response, null);

    assertTrue(result);
    verify(zSetOps, never()).count(anyString(), anyDouble(), anyDouble());
}
```

- [ ] **Step 6: Run all tests**

Run: `cd UserService && ./mvnw test -Dtest=RateLimitInterceptorTest -q`
Expected: All 9 tests PASS

- [ ] **Step 7: Run full test suite to verify no regressions**

Run: `cd UserService && ./mvnw test -q`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add UserService/src/test/java/iuh/fit/UserService/Config/RateLimitInterceptorTest.java
git commit -m "test: add unit tests for signup rate limiting"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full build**

Run: `cd UserService && ./mvnw clean test -q`
Expected: BUILD SUCCESS, all tests pass

- [ ] **Step 2: Verify the final file**

The final `RateLimitInterceptor.java` should have:
- 7 constants (WINDOW_MS shared, 2 signin, 4 signup)
- `checkRateLimit()` helper method
- `extractEmailFromBody()` helper method
- `preHandle()` with signin and signup branches

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "chore: final verification for signup rate limiter"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Rate limit signup by IP (3 req/60s) — Task 2, 3
- ✅ Rate limit signup by email (2 req/60s) — Task 2, 3
- ✅ Return HTTP 429 with same error format — Task 2 (`checkRateLimit`)
- ✅ Fail-open if Redis unavailable — Task 3 (edge case test)
- ✅ Extend RateLimitInterceptor, no new files — Task 1-4
- ✅ Rename existing constants — Task 1
- ✅ Extract `checkRateLimit()` helper — Task 2

**Placeholder scan:** No TBD, TODO, or vague instructions. All code blocks are complete.

**Type consistency:** All method signatures match. `checkRateLimit` returns `boolean`, takes `(String key, int limit, HttpServletResponse response, String errorType)`. `extractEmailFromBody` returns `String` or `null`.

**Test completeness:** 9 tests covering signin pass/fail, signup IP pass/fail, signup email pass/fail, empty body, parse failure, Redis failure, GET requests.

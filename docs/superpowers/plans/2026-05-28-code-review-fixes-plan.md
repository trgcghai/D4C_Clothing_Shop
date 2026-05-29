# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 code review findings across PaymentService, CartService, UserService, API Gateway, AIService, and frontend.

**Architecture:** 4 independent tasks grouped by service. Each task fixes specific findings with isolated changes. No new dependencies.

**Tech Stack:** Spring Boot 3.3.1 (Java 21), Spring Cloud Gateway, React 19 + TypeScript, Node.js/Express, Redis.

---

### Task 1: Java Services — Fix #1, #2, #6, #7

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`

- [ ] **Step 1: Fix #1 — PaymentService extract Feign call from createPayment()**

Read `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`.

Remove annotations from `createPayment()` method (lines 65-68):

```java
// BEFORE:
@Transactional
@CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallback")
@Retry(name = "orderService")
@Bulkhead(name = "orderService")
public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
    Long orderUserId = orderClient.getOrderUserId(request.getOrderId());
    // ...
}

// AFTER:
@Transactional
public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
    Long orderUserId = getOrderUserIdWithCB(request.getOrderId());
    // ...
}
```

Add new private method after the fallback methods (around line 177):

```java
@CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallback")
@Retry(name = "orderService")
@Bulkhead(name = "orderService")
private Long getOrderUserIdWithCB(Long orderId) {
    return orderClient.getOrderUserId(orderId);
}
```

- [ ] **Step 2: Fix #1 — PaymentService extract Feign call from getPaymentByOrderId()**

Remove annotations from `getPaymentByOrderId()` method (lines 122-125):

```java
// BEFORE:
@Transactional(readOnly = true)
@CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallbackForPayment")
@Retry(name = "orderService")
@Bulkhead(name = "orderService")
public PaymentResponse getPaymentByOrderId(Long orderId, Long requestingUserId) {
    Payment payment = paymentRepository.findByOrderId(orderId)
            .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));

    Long orderUserId = orderClient.getOrderUserId(orderId);
    // ...
}

// AFTER:
@Transactional(readOnly = true)
public PaymentResponse getPaymentByOrderId(Long orderId, Long requestingUserId) {
    Payment payment = paymentRepository.findByOrderId(orderId)
            .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));

    Long orderUserId = getOrderUserIdWithCB(orderId);
    // ...
}
```

Reuse the same `getOrderUserIdWithCB()` method from Step 1. Add a second fallback for this method:

```java
private Long getOrderUserIdFallbackForPayment(Long orderId, Throwable t) {
    log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", orderId, t.getMessage());
    throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
}
```

- [ ] **Step 3: Fix #2 — CartService add self-proxy for AOP**

Read `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`.

Add imports at top:

```java
import org.springframework.context.annotation.Lazy;
import org.springframework.beans.factory.annotation.Autowired;
```

Add field after the class declaration (around line 35):

```java
@Lazy
@Autowired
private CartService self;
```

Replace all internal calls to `getProductWithCircuitBreaker()`:

In `updateItemQuantity()` (line 158):
```java
// BEFORE: ProductDto product = getProductWithCircuitBreaker(item.getProductId());
// AFTER:  ProductDto product = self.getProductWithCircuitBreaker(item.getProductId());
```

In `validateCart()` (line 231):
```java
// BEFORE: ProductDto product = getProductWithCircuitBreaker(item.getProductId());
// AFTER:  ProductDto product = self.getProductWithCircuitBreaker(item.getProductId());
```

In `validateCartItems()` (line 397):
```java
// BEFORE: ProductDto product = getProductWithCircuitBreaker(item.getProductId());
// AFTER:  ProductDto product = self.getProductWithCircuitBreaker(item.getProductId());
```

- [ ] **Step 4: Fix #6 — UserService exact path match**

Read `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`.

Change line 29:

```java
// BEFORE:
if (!"POST".equalsIgnoreCase(request.getMethod()) || !request.getRequestURI().contains("/signin"))

// AFTER:
if (!"POST".equalsIgnoreCase(request.getMethod()) || !request.getRequestURI().equals("/api/auth/signin"))
```

- [ ] **Step 5: Fix #7 — UserService UUID member for sorted set**

In the same file, change line 39:

```java
// BEFORE:
redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now);

// AFTER:
redisTemplate.opsForZSet().add(key, java.util.UUID.randomUUID().toString(), (double) now);
```

Add import: `import java.util.UUID;`

- [ ] **Step 6: Verify builds**

Run:
```bash
cd PaymentService && ./mvnw clean compile && cd ../CartService && ./mvnw clean compile && cd ../UserService && ./mvnw clean compile
```

Expected: All 3 BUILD SUCCESS.

- [ ] **Step 7: Run tests**

Run:
```bash
cd PaymentService && ./mvnw test -Dtest=PaymentServiceTest && cd ../CartService && ./mvnw test -Dtest=CartServiceTest,GlobalExceptionHandlerTest
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add PaymentService/ CartService/ UserService/
git commit -m "fix: resolve code review findings #1, #2, #6, #7 for Java services"
```

---

### Task 2: API Gateway — Fix #3, #4, #5

**Files:**
- Modify: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java`
- Modify: `Api-Gateway/src/main/resources/application.properties`

- [ ] **Step 1: Fix #3 — Add fail-open on Redis failure**

Read `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java`.

Add `.onErrorResume()` to the reactive chain (before `.getOrder()`):

```java
// BEFORE (end of chain at line 55):
.doFinally(signalType -> redisTemplate.expire(key, Duration.ofSeconds(60)).subscribe());

// AFTER:
.doFinally(signalType -> redisTemplate.expire(key, Duration.ofSeconds(60)).subscribe())
.onErrorResume(e -> {
    log.warn("[RateLimiter] Redis unavailable, allowing request through: {}", e.getMessage());
    return chain.filter(exchange);
});
```

Add import: `import reactor.core.publisher.Mono;` (if not already present).

- [ ] **Step 2: Fix #4 — Use unique sorted-set member**

In the same file, change line 42:

```java
// BEFORE:
return redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now)

// AFTER:
String member = now + ":" + java.util.UUID.randomUUID();
return redisTemplate.opsForZSet().add(key, member, (double) now)
```

- [ ] **Step 3: Fix #5 — Correct backoff property paths**

Read `Api-Gateway/src/main/resources/application.properties`.

Replace lines 80-81:

```properties
# BEFORE:
spring.cloud.gateway.default-filters[0].args.firstBackoff=200ms
spring.cloud.gateway.default-filters[0].args.maxBackoff=800ms

# AFTER:
spring.cloud.gateway.default-filters[0].args.backoff.firstBackoff=200ms
spring.cloud.gateway.default-filters[0].args.backoff.maxBackoff=800ms
spring.cloud.gateway.default-filters[0].args.backoff.factor=2
spring.cloud.gateway.default-filters[0].args.backoff.basedOnPreviousValue=true
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd Api-Gateway && ./gradlew clean compileJava
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: Run tests**

Run:
```bash
cd Api-Gateway && ./gradlew test
```

Expected: All tests pass (pre-existing RouteProtectionConfigTest failure is unrelated).

- [ ] **Step 6: Commit**

```bash
git add Api-Gateway/
git commit -m "fix: resolve code review findings #3, #4, #5 for API Gateway"
```

---

### Task 3: Node.js Services — Fix #8, #9

**Files:**
- Modify: `AIService/src/middlewares/rateLimiter.middleware.js`

- [ ] **Step 1: Fix #8 — Correct retryAfter calculation**

Read `AIService/src/middlewares/rateLimiter.middleware.js`.

Replace lines 23-29:

```javascript
// BEFORE:
if (count > LIMIT) {
  const retryAfter = Math.ceil((windowStart + WINDOW_MS - Date.now()) / 1000);
  res.setHeader("Retry-After", Math.max(retryAfter, 1));
  return res.status(429).json({
    error: "Too many requests. Please try again later.",
    retryAfter: Math.max(retryAfter, 1),
  });
}

// AFTER:
if (count > LIMIT) {
  const retryAfter = 60;
  res.setHeader("Retry-After", retryAfter);
  return res.status(429).json({
    error: "Too many requests. Please try again later.",
    retryAfter,
  });
}
```

- [ ] **Step 2: Fix #9 — Use unique sorted-set member**

In the same file, change line 18:

```javascript
// BEFORE:
await redisClient.zadd(key, now, `${now}`);

// AFTER:
await redisClient.zadd(key, now, `${now}:${crypto.randomUUID()}`);
```

- [ ] **Step 3: Verify syntax**

Run:
```bash
cd AIService && node -c src/middlewares/rateLimiter.middleware.js
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add AIService/
git commit -m "fix: resolve code review findings #8, #9 for AIService rate limiter"
```

---

### Task 4: Frontend — Fix #10

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Fix #10 — Add retryCondition to skip 4xx errors**

Read `frontend/src/App.tsx`.

Replace lines 70-77:

```typescript
// BEFORE:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
    },
  },
});

// AFTER:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
      retryCondition: (error) => {
        if (!error.response) return true; // Network error
        return error.response.status >= 500;
      },
    },
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix: resolve code review finding #10 — skip 4xx errors in frontend retry"
```

---

## Self-Review

1. **Spec coverage:** ✅ All 10 findings addressed: #1 (PaymentService CB scope), #2 (CartService self-invocation), #3 (Gateway fail-open), #4 (Gateway timestamp collision), #5 (Gateway backoff paths), #6 (UserService URI match), #7 (UserService timestamp collision), #8 (AIService retryAfter), #9 (AIService timestamp collision), #10 (Frontend retryCondition).
2. **Placeholder scan:** ✅ No TBD, TODO, or vague instructions. All steps have exact code, file paths, and commands.
3. **Type consistency:** ✅ All method signatures, imports, and property names match across tasks. UUID imports added where needed.
4. **Scope:** ✅ 4 tasks, one per service group. Each independently testable and commitable.

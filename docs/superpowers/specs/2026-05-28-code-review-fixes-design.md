# Code Review Fixes — Design

**Date:** 2026-05-28
**Status:** Draft
**Author:** AI Assistant

## Summary

Fix 10 code review findings across 4 services: PaymentService, CartService, UserService, API Gateway, AIService, and frontend. Grouped by service into 4 independent tasks.

## Task 1: Java Services — Fix #1, #2, #6, #7

### Fix #1: PaymentService — CB wraps business exceptions

**File:** `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`

**Problem:** `@CircuitBreaker` on entire `createPayment()` and `getPaymentByOrderId()` catches `PaymentException` (access denied, payment not found) and routes to fallback → returns 503 instead of 403/404.

**Fix:** Extract Feign call into separate annotated method.

```java
// createPayment() — remove annotations from method, extract Feign call:
@Transactional
public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
    Long orderUserId = getOrderUserIdWithCB(request.getOrderId());
    if (!orderUserId.equals(requestingUserId)) {
        throw new PaymentException("Access denied: you do not own this order");
    }
    // ... rest unchanged
}

// New method:
@CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallback")
@Retry(name = "orderService")
@Bulkhead(name = "orderService")
private Long getOrderUserIdWithCB(Long orderId) {
    return orderClient.getOrderUserId(orderId);
}
```

Same pattern for `getPaymentByOrderId()` — extract `orderClient.getOrderUserId(orderId)` into a separate protected method with annotations.

### Fix #2: CartService — Self-invocation bypasses AOP proxy

**File:** `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`

**Problem:** `getProductWithCircuitBreaker()` is called via `this.` from `updateItemQuantity()`, `validateCart()`, `validateCartItems()`. Spring AOP proxies don't intercept self-calls, so CB/Retry/Bulkhead are not applied.

**Fix:** Inject self-proxy via `@Lazy` and call through it:

```java
// Add field:
@Lazy
@Autowired
private CartService self;

// Replace all internal calls:
// BEFORE: ProductDto product = getProductWithCircuitBreaker(item.getProductId());
// AFTER:  ProductDto product = self.getProductWithCircuitBreaker(item.getProductId());
```

Affected call sites: `updateItemQuantity()` (line 158), `validateCart()` (line 231), `validateCartItems()` (line 397).

### Fix #6: UserService RateLimiter — `/signin` substring too broad

**File:** `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`

**Problem:** `request.getRequestURI().contains("/signin")` matches any URI containing `/signin`, not just the login endpoint.

**Fix:** Use exact path match:

```java
// BEFORE:
if (!"POST".equalsIgnoreCase(request.getMethod()) || !request.getRequestURI().contains("/signin"))

// AFTER:
if (!"POST".equalsIgnoreCase(request.getMethod()) || !request.getRequestURI().equals("/api/auth/signin"))
```

### Fix #7: UserService RateLimiter — Timestamp collision

**File:** `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`

**Problem:** Multiple requests in the same millisecond use `String.valueOf(now)` as both member and score → overwrite each other.

**Fix:** Use UUID as member, timestamp as score:

```java
// BEFORE:
redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now);

// AFTER:
redisTemplate.opsForZSet().add(key, UUID.randomUUID().toString(), (double) now);
```

Add `import java.util.UUID;`.

## Task 2: API Gateway — Fix #3, #4, #5

### Fix #3: Gateway RateLimiter — No fail-open on Redis failure

**File:** `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java`

**Problem:** If Redis is down, the reactive chain throws and the gateway returns 500 instead of passing the request through.

**Fix:** Add `.onErrorResume()` to catch Redis errors:

```java
// Add to end of reactive chain (before getOrder()):
.onErrorResume(e -> {
    log.warn("[RateLimiter] Redis unavailable, allowing request through: {}", e.getMessage());
    return chain.filter(exchange);
})
```

### Fix #4: Gateway RateLimiter — Timestamp collision

**File:** `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java`

**Problem:** Multiple requests in the same millisecond use the same member value → overwrite each other.

**Fix:** Use unique member value:

```java
// BEFORE:
return redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now)

// AFTER:
String member = now + ":" + java.util.UUID.randomUUID();
return redisTemplate.opsForZSet().add(key, member, (double) now)
```

### Fix #5: Gateway Retry filter — Wrong backoff property paths

**File:** `Api-Gateway/src/main/resources/application.properties`

**Problem:** `args.firstBackoff` and `args.maxBackoff` are not the correct nested paths for Spring Cloud Gateway's Retry filter.

**Fix:**

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

## Task 3: Node.js Services — Fix #8, #9

### Fix #8: AIService rateLimiter — retryAfter calculation is wrong

**File:** `AIService/src/middlewares/rateLimiter.middleware.js`

**Problem:** `windowStart + WINDOW_MS - Date.now()` = `(now - 60000) + 60000 - now` = 0. Always clamped to 1s.

**Fix:** Use conservative fixed value of 60s:

```javascript
// BEFORE:
const retryAfter = Math.ceil((windowStart + WINDOW_MS - Date.now()) / 1000);
res.setHeader("Retry-After", Math.max(retryAfter, 1));
return res.status(429).json({
    error: "Too many requests. Please try again later.",
    retryAfter: Math.max(retryAfter, 1),
});

// AFTER:
const retryAfter = 60;
res.setHeader("Retry-After", retryAfter);
return res.status(429).json({
    error: "Too many requests. Please try again later.",
    retryAfter,
});
```

### Fix #9: AIService rateLimiter — Timestamp collision

**File:** `AIService/src/middlewares/rateLimiter.middleware.js`

**Problem:** `Date.now()` as both member and score causes overwrite on same-millisecond requests.

**Fix:** Use unique member value:

```javascript
// BEFORE:
await redisClient.zadd(key, now, `${now}`);

// AFTER:
await redisClient.zadd(key, now, `${now}:${crypto.randomUUID()}`);
```

## Task 4: Frontend — Fix #10

### Fix #10: Frontend retry — retries 4xx errors

**File:** `frontend/src/App.tsx`

**Problem:** `retry: 2` with default `retryCondition` may retry 400/401/403/404 responses.

**Fix:** Add `retryCondition` predicate:

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

## Testing

### Task 1: Java Services
- Build: `cd PaymentService && ./mvnw clean compile` and `cd CartService && ./mvnw clean compile` and `cd UserService && ./mvnw clean compile`
- Tests: `./mvnw test` in each service
- Manual: Verify 403 for access denied (not 503), verify CB fires on Feign failure

### Task 2: API Gateway
- Build: `cd Api-Gateway && ./gradlew clean compileJava`
- Tests: `./gradlew test`
- Manual: Stop Redis, verify gateway still serves requests (fail-open). Verify retry backoff is 200→400→800ms.

### Task 3: Node.js Services
- Syntax: `cd AIService && node -c src/middlewares/rateLimiter.middleware.js`
- Manual: Trigger rate limit, verify Retry-After header is 60s (not 1s)

### Task 4: Frontend
- Build: `cd frontend && npx tsc --noEmit`
- Manual: Trigger 404/401, verify no retry in Network tab. Trigger 503, verify 2 retries.

## Dependencies

No new dependencies. All fixes use existing libraries.

## Rollback

Revert the 4 commits. Each fix is isolated to its service.

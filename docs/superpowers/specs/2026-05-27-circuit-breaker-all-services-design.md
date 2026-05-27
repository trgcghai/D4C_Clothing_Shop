# Circuit Breaker Implementation — All Internal Service Calls

**Date:** 2026-05-27
**Status:** Draft
**Author:** AI Assistant

## Summary

Implement Resilience4j circuit breakers for all unprotected synchronous inter-service calls across Java and Node.js services. Uses a phased approach (4 phases) with fail-fast fallbacks for critical paths and graceful degradation for non-critical paths. Includes monitoring via Spring Boot Actuator (Java) and opossum events + health endpoints (Node.js).

## Architecture

### Java Services Pattern

```
@Service method
  ├── @CircuitBreaker(name = "targetService", fallbackMethod = "...")
  ├── @Retry(name = "targetService")
  ├── @Bulkhead(name = "targetService")
  └── FeignClient call
```

Config in `application.properties` per service. Standardized thresholds:
- Sliding window: 10 calls
- Failure threshold: 50%
- Open state wait: 30s
- Half-open test calls: 3
- Retry: 3 attempts, 1s wait
- Bulkhead: 10 concurrent calls

Monitoring: Spring Boot Actuator `/actuator/circuitbreakers` and `/actuator/circuitbreakerevents`.

### Node.js Services Pattern

```
createServiceClient() factory
  └── wraps axios call in opossum CircuitBreaker
        ├── timeout: 3000ms
        ├── errorThreshold: 50%
        ├── resetTimeout: 30000ms
        └── fallback: returns empty/partial data
```

Monitoring: opossum events (`open`, `close`, `halfOpen`, `reject`, `fallback`) + `/health` endpoint.

## Phase 1: PaymentService → OrderService

### Protected Methods

| Method | Feign Call | Purpose |
|---|---|---|
| `createPayment()` | `orderClient.getOrderUserId(orderId)` | Verify order ownership |
| `getPaymentByOrderId()` | `orderClient.getOrderUserId(orderId)` | Verify order ownership |

### Fallback

```java
public PaymentResponse getOrderUserIdFallback(Long orderId, Throwable t) {
    log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", orderId, t.getMessage());
    throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
}
```

### Config

Already exists in `PaymentService/src/main/resources/application.properties` (lines 51-63). Verify thresholds match standard.

### Changes

1. Add `@CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallback")`, `@Retry(name = "orderService")`, `@Bulkhead(name = "orderService")` on methods calling `orderClient`
2. Add `getOrderUserIdFallback()` method
3. Add `import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker` etc.

## Phase 2: CartService → ProductService (3 more methods)

### Protected Methods

| Method | Feign Call | Purpose |
|---|---|---|
| `updateItemQuantity()` | `productServiceClient.getProductById()` | Validate stock on quantity change |
| `validateCart()` | `productServiceClient.getProductById()` (loop) | Bulk cart validation |
| `validateCartItems()` | `productServiceClient.getProductById()` (loop) | Checkout validation |

### Approach

Extract `getProductById()` calls into a shared protected method:

```java
@CircuitBreaker(name = "productService", fallbackMethod = "getProductByIdFallback")
@Retry(name = "productService")
@Bulkhead(name = "productService")
public ProductDto getProductWithCircuitBreaker(Long productId) {
    return productServiceClient.getProductById(productId);
}

public ProductDto getProductByIdFallback(Long productId, Throwable t) {
    log.error("[CircuitBreaker] CartService: ProductService unavailable calling getProductById({}): {}", productId, t.getMessage());
    throw new ServiceUnavailableException("Không thể kiểm tra sản phẩm, vui lòng thử lại sau");
}
```

Replace all direct `productServiceClient.getProductById()` calls (except in `addItem()` which already has CB) with `getProductWithCircuitBreaker()`.

### Config

Already exists in `CartService/src/main/resources/application.properties` (lines 43-55) for `productService` instance. Reuse.

### Changes

1. Add `getProductWithCircuitBreaker()` method with annotations
2. Add `getProductByIdFallback()` method
3. Replace 3 call sites to use the new method
4. Add imports if missing

## Phase 3: Node.js Services

### RecommendationService

**File:** `RecommendationService/src/config/product-service-client.js`

Wrap all axios calls in opossum:

```javascript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(async (url, config) => {
  return await axiosInstance.get(url, config);
}, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10
});

breaker.fallback(() => ({ status: 'unavailable', data: null }));
breaker.on('open', () => log.warn('[CB] ProductService circuit opened'));
breaker.on('close', () => log.info('[CB] ProductService circuit closed'));

export async function getProductWithCB(url, config) {
  return breaker.fire(url, config);
}
```

**Fallback responses:**
- `fetchAllProducts()` → `[]`
- `getRecommendations()` (cold start) → `[]`
- Individual product fetch → `null` (skip unavailable)

### AIService

**File:** `AIService/src/config/service-discovery.js`

Add opossum wrapper to `createServiceClient()` factory so all 5 downstream services inherit it:

```javascript
import CircuitBreaker from 'opossum';

export function createServiceClient(appName, basePath) {
  const breaker = new CircuitBreaker(async ({ method, url, data }) => {
    return await axiosInstance({ method, url, data });
  }, {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: appName
  });

  breaker.fallback(({ method, url }) => {
    log.warn(`[CB] ${appName} unavailable, returning fallback`);
    return { status: 'unavailable', data: getDefaultFallback(appName) };
  });

  // Return wrapped client
  return {
    get: (url, config) => breaker.fire({ method: 'get', url, ...config }),
    post: (url, data) => breaker.fire({ method: 'post', url, data }),
    // ... etc
  };
}
```

**Fallback responses by target:**

| Tool → Target | Fallback |
|---|---|
| `search_products` → ProductService | `{ products: [], message: "Product search temporarily unavailable" }` |
| `get_product_details` → ProductService | `{ status: 'unavailable', message: "Product details unavailable" }` |
| `add_to_cart` → CartService | `{ status: 'error', message: "Cannot add to cart right now" }` |
| `get_checkout_summary` → CartService | `{ items: [], total: 0, message: "Cart unavailable" }` |
| `get_revenue_stats` → OrderService | `{ status: 'unavailable', data: null }` |
| `get_notification_summary` → NotificationService | `{ notifications: [] }` |
| `get_personalized_recommendations` → RecommendationService | `{ recommendations: [] }` |

### Health Endpoint (Node.js)

Add `/health` endpoint to both services:

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    circuitBreakers: {
      productService: breaker.stats,
      // ... per-service stats
    }
  });
});
```

### Changes

1. `npm install opossum` in RecommendationService and AIService
2. Create circuit breaker wrapper in client factories
3. Replace direct axios calls with wrapped calls
4. Add `/health` endpoint to both services

## Phase 4: SearchService (Optional)

Sync/reindex operations only. Skip unless complete coverage desired. If included: simple opossum wrapper with retry fallback, same pattern as RecommendationService.

## Error Handling

### Java — Fail-Fast

| Scenario | User Message |
|---|---|
| OrderService down during payment | "Không thể xác thực đơn hàng, vui lòng thử lại sau" |
| ProductService down during cart update | "Không thể cập nhật giỏ hàng, vui lòng thử lại sau" |
| ProductService down during cart validation | "Không thể kiểm tra giỏ hàng, vui lòng thử lại sau" |

- `@ControllerAdvice` maps `ServiceUnavailableException` → HTTP 503
- Circuit breaker events logged at ERROR with service name and method context
- Retry on `ServiceUnavailable`, `GatewayTimeout` only; all others fail immediately

### Node.js — Graceful Degradation

- Fallback returns empty/partial data with status indicator
- Events logged: `open`, `close`, `reject`, `fallback`
- UI shows "temporarily unavailable" messages for affected features

## Testing

### Java (JUnit 5 + Mockito)

- Test fallback invoked when Feign client throws
- Test circuit breaker opens after failure threshold
- Test retry on `ServiceUnavailable`/`GatewayTimeout`
- Test bulkhead rejects at concurrent limit
- Integration test: `@SpringBootTest` with Resilience4j test utilities

### Node.js (Jest)

- Test circuit breaker opens after error threshold
- Test fallback returns expected data structure
- Test circuit closes after reset timeout
- Test `/health` endpoint reports circuit states

### Manual Testing

- Stop target service → verify circuit opens, fallback returns within ms
- Restart target service → verify half-open → closed transition
- Check monitoring endpoints show circuit states

## Config Reference

### Java (application.properties)

```properties
resilience4j.circuitbreaker.instances.<name>.slidingWindowSize=10
resilience4j.circuitbreaker.instances.<name>.failureRateThreshold=50
resilience4j.circuitbreaker.instances.<name>.waitDurationInOpenState=30s
resilience4j.circuitbreaker.instances.<name>.permittedNumberOfCallsInHalfOpenState=3
resilience4j.circuitbreaker.instances.<name>.slowCallDurationThreshold=3000
resilience4j.circuitbreaker.instances.<name>.slowCallRateThreshold=80

resilience4j.retry.instances.<name>.maxAttempts=3
resilience4j.retry.instances.<name>.waitDuration=1s
resilience4j.retry.instances.<name>.retryExceptions=feign.FeignException$ServiceUnavailable,feign.FeignException$GatewayTimeout

resilience4j.bulkhead.instances.<name>.maxConcurrentCalls=10
resilience4j.bulkhead.instances.<name>.maxWaitDuration=2000
```

### Node.js (opossum options)

```javascript
{
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10
}
```

## Dependencies

| Service | Existing | New |
|---|---|---|
| PaymentService | `spring-cloud-starter-circuitbreaker-resilience4j`, `resilience4j-spring-boot3`, `resilience4j-reactor` | None |
| CartService | `spring-cloud-starter-circuitbreaker-resilience4j`, `resilience4j-spring-boot3`, `resilience4j-reactor` | None |
| RecommendationService | None | `opossum` |
| AIService | None | `opossum` |

## Rollout Order

1. PaymentService → OrderService (HIGH — critical path)
2. CartService → ProductService (MEDIUM — 3 more methods)
3. Node.js services (RecommendationService + AIService)
4. SearchService (optional)

Each phase independently testable and deployable.

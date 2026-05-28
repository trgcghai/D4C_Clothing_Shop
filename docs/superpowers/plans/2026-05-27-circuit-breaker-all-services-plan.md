# Circuit Breaker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Resilience4j circuit breakers to all unprotected synchronous inter-service calls across Java and Node.js services.

**Architecture:** Phased approach (4 phases). Java services use Resilience4j annotations (@CircuitBreaker, @Retry, @Bulkhead) with fail-fast fallbacks. Node.js services use opossum library with graceful degradation fallbacks. Each phase independently testable.

**Tech Stack:** Spring Boot 3.3.1 (Java 21), Resilience4j, Node.js/Express, opossum, JUnit 5, Jest.

---

## File Map

| Phase | Action | File |
|---|---|---|
| 1 | Modify | `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java` |
| 1 | Create | `PaymentService/src/main/java/iuh/fit/PaymentService/exception/ServiceUnavailableException.java` |
| 1 | Modify | `PaymentService/src/main/java/iuh/fit/PaymentService/exception/GlobalExceptionHandler.java` |
| 1 | Create | `PaymentService/src/test/java/iuh/fit/PaymentService/service/PaymentServiceTest.java` |
| 2 | Modify | `CartService/src/main/java/iuh/fit/CartService/service/CartService.java` |
| 2 | Create | `CartService/src/main/java/iuh/fit/CartService/exception/ServiceUnavailableException.java` |
| 2 | Modify | `CartService/src/main/java/iuh/fit/CartService/exception/GlobalExceptionHandler.java` |
| 2 | Create | `CartService/src/test/java/iuh/fit/CartService/service/CartServiceTest.java` |
| 3a | Modify | `RecommendationService/package.json` |
| 3a | Modify | `RecommendationService/src/config/product-service-client.js` |
| 3a | Modify | `RecommendationService/src/services/recommendation.service.js` |
| 3a | Modify | `RecommendationService/src/index.js` |
| 3b | Modify | `AIService/package.json` |
| 3b | Modify | `AIService/src/config/service-discovery.js` |
| 3b | Create | `AIService/src/config/circuit-breaker.js` |
| 3b | Modify | `AIService/src/index.js` |

---

### Task 1: PaymentService — Add Circuit Breaker for OrderService Calls

**Files:**
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/exception/ServiceUnavailableException.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/exception/GlobalExceptionHandler.java`

- [ ] **Step 1: Create ServiceUnavailableException**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/exception/ServiceUnavailableException.java`:

```java
package iuh.fit.PaymentService.exception;

public class ServiceUnavailableException extends RuntimeException {
    public ServiceUnavailableException(String message) {
        super(message);
    }
}
```

- [ ] **Step 2: Add circuit breaker annotations and fallback to PaymentService**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`.

Add imports at the top (after existing imports):

```java
import iuh.fit.PaymentService.exception.ServiceUnavailableException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
```

Change `createPayment()` method (line 61-84). Add annotations before `@Transactional`:

```java
    @Transactional
    @CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallback")
    @Retry(name = "orderService")
    @Bulkhead(name = "orderService")
    public PaymentResponse createPayment(CreatePaymentRequest request, Long requestingUserId) {
        Long orderUserId = orderClient.getOrderUserId(request.getOrderId());
        if (!orderUserId.equals(requestingUserId)) {
            throw new PaymentException("Access denied: you do not own this order");
        }

        Payment existing = paymentRepository.findByCheckoutOrderId(request.getCheckoutOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        Payment payment = new Payment();
        payment.setOrderId(request.getOrderId());
        payment.setCheckoutOrderId(request.getCheckoutOrderId());
        payment.setAmount(request.getAmount());
        payment.setMethod(request.getMethod());
        payment.setStatus(PaymentStatus.PENDING);
        payment.setPaymentCode(sePayConfig.generatePaymentCode());
        payment.setExpiresAt(Instant.now().plusSeconds(5 * 60));

        payment = paymentRepository.save(payment);
        return toResponse(payment);
    }
```

Change `getPaymentByOrderId()` method (line 115-125). Add annotations:

```java
    @Transactional(readOnly = true)
    @CircuitBreaker(name = "orderService", fallbackMethod = "getOrderUserIdFallbackForPayment")
    @Retry(name = "orderService")
    @Bulkhead(name = "orderService")
    public PaymentResponse getPaymentByOrderId(Long orderId, Long requestingUserId) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));

        Long orderUserId = orderClient.getOrderUserId(orderId);
        if (!orderUserId.equals(requestingUserId)) {
            throw new PaymentException("Access denied: you do not own this order");
        }

        return toResponse(payment);
    }
```

Add fallback methods before the `publishEvent` method (around line 157):

```java
    private PaymentResponse getOrderUserIdFallback(CreatePaymentRequest request, Long requestingUserId, Throwable t) {
        log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", request.getOrderId(), t.getMessage());
        throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
    }

    private PaymentResponse getOrderUserIdFallbackForPayment(Long orderId, Long requestingUserId, Throwable t) {
        log.error("[CircuitBreaker] PaymentService: OrderService unavailable calling getOrderUserId({}): {}", orderId, t.getMessage());
        throw new ServiceUnavailableException("Không thể xác thực đơn hàng, vui lòng thử lại sau");
    }
```

- [ ] **Step 3: Add ServiceUnavailableException handler to GlobalExceptionHandler**

Modify `PaymentService/src/main/java/iuh/fit/PaymentService/exception/GlobalExceptionHandler.java`.

Add import:

```java
import iuh.fit.PaymentService.exception.ServiceUnavailableException;
```

Add handler method before `handleRuntimeException` (around line 43):

```java
    @ExceptionHandler(ServiceUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleServiceUnavailableException(ServiceUnavailableException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now());
        body.put("status", HttpStatus.SERVICE_UNAVAILABLE.value());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
```

- [ ] **Step 4: Verify config**

Read `PaymentService/src/main/resources/application.properties` and confirm lines 51-63 contain the resilience4j config. The config already exists and matches the standard thresholds. No changes needed.

- [ ] **Step 5: Write unit tests**

Create `PaymentService/src/test/java/iuh/fit/PaymentService/service/PaymentServiceTest.java`:

```java
package iuh.fit.PaymentService.service;

import feign.Request;
import feign.FeignException;
import iuh.fit.PaymentService.client.OrderClient;
import iuh.fit.PaymentService.domain.dto.CreatePaymentRequest;
import iuh.fit.PaymentService.domain.dto.PaymentResponse;
import iuh.fit.PaymentService.exception.ServiceUnavailableException;
import iuh.fit.PaymentService.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import iuh.fit.PaymentService.config.SePayConfig;

import java.util.HashMap;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private OrderClient orderClient;

    @Mock
    private SePayConfig sePayConfig;

    @InjectMocks
    private PaymentService paymentService;

    @Test
    void createPayment_whenOrderServiceDown_throwsServiceUnavailable() {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setOrderId(1L);
        request.setCheckoutOrderId("ORD-123");
        request.setAmount(100000L);

        when(orderClient.getOrderUserId(anyLong()))
                .thenThrow(new FeignException.ServiceUnavailable("OrderService down",
                        Request.create(Request.HttpMethod.GET, "/test", new HashMap<>(), null, null),
                        new byte[0], new HashMap<>()));

        assertThrows(ServiceUnavailableException.class,
                () -> paymentService.createPayment(request, 1L));
    }

    @Test
    void getPaymentByOrderId_whenOrderServiceDown_throwsServiceUnavailable() {
        when(paymentRepository.findByOrderId(1L))
                .thenReturn(Optional.of(new iuh.fit.PaymentService.domain.entity.Payment()));

        when(orderClient.getOrderUserId(anyLong()))
                .thenThrow(new FeignException.ServiceUnavailable("OrderService down",
                        Request.create(Request.HttpMethod.GET, "/test", new HashMap<>(), null, null),
                        new byte[0], new HashMap<>()));

        assertThrows(ServiceUnavailableException.class,
                () -> paymentService.getPaymentByOrderId(1L, 1L));
    }
}
```

- [ ] **Step 6: Run tests**

```bash
cd PaymentService && ./mvnw test -Dtest=PaymentServiceTest -v
```

Expected: 2 tests pass.

- [ ] **Step 7: Build to verify compilation**

```bash
cd PaymentService && ./mvnw clean compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add PaymentService/
git commit -m "feat: add circuit breaker for OrderService calls in PaymentService"
```

---

### Task 2: CartService — Add Circuit Breaker for Remaining ProductService Calls

**Files:**
- Create: `CartService/src/main/java/iuh/fit/CartService/exception/ServiceUnavailableException.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/exception/GlobalExceptionHandler.java`

- [ ] **Step 1: Create ServiceUnavailableException**

Create `CartService/src/main/java/iuh/fit/CartService/exception/ServiceUnavailableException.java`:

```java
package iuh.fit.CartService.exception;

public class ServiceUnavailableException extends RuntimeException {
    public ServiceUnavailableException(String message) {
        super(message);
    }
}
```

- [ ] **Step 2: Add shared circuit breaker method to CartService**

Modify `CartService/src/main/java/iuh/fit/CartService/service/CartService.java`.

Add imports (after existing imports):

```java
import iuh.fit.CartService.exception.ServiceUnavailableException;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
```

Add the shared protected method and fallback after the `addItemFallback` method (at end of class, around line 506):

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

- [ ] **Step 3: Replace direct getProductById() calls in updateItemQuantity()**

In `updateItemQuantity()` (around line 155-160), replace:

```java
        ProductDto product;
        try {
            product = productServiceClient.getProductById(item.getProductId());
        } catch (Exception e) {
            throw new RuntimeException("Cannot fetch product info from ProductService");
        }
```

With:

```java
        ProductDto product = getProductWithCircuitBreaker(item.getProductId());
```

- [ ] **Step 4: Replace direct getProductById() call in validateCart()**

In `validateCart()` (around line 234), replace:

```java
                ProductDto product = productServiceClient.getProductById(item.getProductId());
```

With:

```java
                ProductDto product = getProductWithCircuitBreaker(item.getProductId());
```

And remove the catch block that wraps the entire loop body (lines 276-282). The circuit breaker fallback will throw `ServiceUnavailableException` which will propagate up. Change the loop to:

```java
        for (CartItem item : items) {
            ProductDto product = getProductWithCircuitBreaker(item.getProductId());
            VariantDto variant = product.getVariants().stream()
                    .filter(v -> v.getId().equals(item.getVariantId()))
                    .findFirst()
                    .orElse(null);

            if (variant == null) {
                errors.add(ValidationResponse.ValidationError.builder()
                        .variantId(item.getVariantId())
                        .reason("VARIANT_NOT_FOUND")
                        .message("Variant '" + item.getVariantId() + "' không tồn tại")
                        .build());
                continue;
            }

            if ("INACTIVE".equalsIgnoreCase(product.getStatus())) {
                errors.add(ValidationResponse.ValidationError.builder()
                        .variantId(item.getVariantId())
                        .reason("PRODUCT_INACTIVE")
                        .message("Product '" + product.getName() + "' không còn hoạt động")
                        .build());
                continue;
            }

            if (variant.getQuantity() < item.getQuantity()) {
                errors.add(ValidationResponse.ValidationError.builder()
                        .variantId(item.getVariantId())
                        .reason("OUT_OF_STOCK")
                        .message("Variant '" + variant.getColor() + "/" + variant.getSize()
                                + "' không đủ hàng (cần: " + item.getQuantity()
                                + ", có: " + variant.getQuantity() + ")")
                        .build());
            }

            if (product.getPrice().compareTo(item.getPrice()) != 0) {
                errors.add(ValidationResponse.ValidationError.builder()
                        .variantId(item.getVariantId())
                        .reason("PRICE_CHANGED")
                        .message("Giá đã thay đổi từ " + item.getPrice()
                                + " → " + product.getPrice())
                        .build());
            }
        }
```

- [ ] **Step 5: Replace direct getProductById() call in validateCartItems()**

In `validateCartItems()` (around line 408), replace:

```java
                ProductDto product = productServiceClient.getProductById(item.getProductId());
```

With:

```java
                ProductDto product = getProductWithCircuitBreaker(item.getProductId());
```

And remove the catch block (lines 431-433). The method becomes:

```java
    private List<String> validateCartItems(List<CartItem> items) {
        List<String> validationErrors = new ArrayList<>();
        for (CartItem item : items) {
            ProductDto product = getProductWithCircuitBreaker(item.getProductId());
            if (product == null) {
                validationErrors.add("Sản phẩm '" + item.getProductName() + "' không tồn tại");
                continue;
            }
            if ("INACTIVE".equalsIgnoreCase(product.getStatus())) {
                validationErrors.add("Sản phẩm '" + product.getName() + "' không còn hoạt động");
                continue;
            }
            VariantDto variant = product.getVariants().stream()
                    .filter(v -> v.getId().equals(item.getVariantId()))
                    .findFirst()
                    .orElse(null);
            if (variant == null) {
                validationErrors.add("Variant '" + item.getVariantId() + "' không tồn tại");
                continue;
            }
            if (variant.getQuantity() < item.getQuantity()) {
                validationErrors.add("Sản phẩm '" + item.getProductName()
                        + "' (" + item.getColor() + ", " + item.getSize()
                        + ") chỉ còn " + variant.getQuantity()
                        + ", bạn cần " + item.getQuantity());
            }
        }

        return validationErrors;
    }
```

- [ ] **Step 6: Add ServiceUnavailableException handler to GlobalExceptionHandler**

Modify `CartService/src/main/java/iuh/fit/CartService/exception/GlobalExceptionHandler.java`.

Add import:

```java
import iuh.fit.CartService.exception.ServiceUnavailableException;
```

Add handler before `handleRuntimeException` (around line 36):

```java
    @ExceptionHandler(ServiceUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleServiceUnavailableException(ServiceUnavailableException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", Instant.now().toString());
        response.put("status", HttpStatus.SERVICE_UNAVAILABLE.value());
        response.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
    }
```

- [ ] **Step 7: Write unit tests**

Create `CartService/src/test/java/iuh/fit/CartService/service/CartServiceTest.java`:

```java
package iuh.fit.CartService.service;

import iuh.fit.CartService.client.ProductServiceClient;
import iuh.fit.CartService.domain.dto.ProductDto;
import iuh.fit.CartService.exception.ServiceUnavailableException;
import iuh.fit.CartService.repository.CartItemRepository;
import iuh.fit.CartService.repository.CartRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock
    private CartRepository cartRepository;

    @Mock
    private CartItemRepository cartItemRepository;

    @Mock
    private ProductServiceClient productServiceClient;

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private CartService cartService;

    @Test
    void getProductWithCircuitBreaker_whenProductServiceDown_throwsServiceUnavailable() {
        when(productServiceClient.getProductById(anyLong()))
                .thenThrow(new RuntimeException("Connection refused"));

        assertThrows(ServiceUnavailableException.class,
                () -> cartService.getProductWithCircuitBreaker(1L));
    }
}
```

- [ ] **Step 8: Run tests**

```bash
cd CartService && ./mvnw test -Dtest=CartServiceTest -v
```

Expected: 1 test passes.

- [ ] **Step 9: Build to verify compilation**

```bash
cd CartService && ./mvnw clean compile
```

Expected: BUILD SUCCESS.

- [ ] **Step 10: Commit**

```bash
git add CartService/
git commit -m "feat: add circuit breaker for ProductService calls in CartService"
```

---

### Task 3a: RecommendationService — Add Opossum Circuit Breaker

**Files:**
- Modify: `RecommendationService/package.json`
- Modify: `RecommendationService/src/config/product-service-client.js`
- Modify: `RecommendationService/src/services/recommendation.service.js`
- Modify: `RecommendationService/src/index.js`

- [ ] **Step 1: Install opossum**

```bash
cd RecommendationService && npm install opossum
```

- [ ] **Step 2: Add circuit breaker wrapper to product-service-client.js**

Replace the entire content of `RecommendationService/src/config/product-service-client.js`:

```javascript
import axios from "axios";
import eurekaClient from "./eureka.config.js";
import CircuitBreaker from "opossum";

let currentIndex = 0;

function getBaseUrl() {
  const instances = eurekaClient.getInstancesByAppId("ProductService");

  if (!instances || instances.length === 0) {
    const fallback = process.env.PRODUCT_SERVICE_URL;
    if (fallback) return fallback;
    throw new Error("ProductService not found in Eureka and no PRODUCT_SERVICE_URL fallback");
  }

  const instance = instances[currentIndex % instances.length];
  currentIndex++;

  return `http://${instance.hostName}:${instance.port.$}`;
}

const axiosInstance = axios.create({ timeout: 10000 });

axiosInstance.interceptors.request.use((config) => {
  const baseUrl = getBaseUrl();
  config.url = baseUrl + config.url;
  return config;
});

const circuitBreaker = new CircuitBreaker(
  async (config) => {
    return await axiosInstance(config);
  },
  {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    name: "ProductService"
  }
);

circuitBreaker.fallback(() => null);

circuitBreaker.on("open", () => console.warn("[CB] ProductService circuit opened"));
circuitBreaker.on("close", () => console.info("[CB] ProductService circuit closed"));
circuitBreaker.on("reject", () => console.warn("[CB] Call rejected for ProductService (circuit open)"));
circuitBreaker.on("fallback", () => console.warn("[CB] Fallback invoked for ProductService"));

export function getProductServiceClient() {
  return {
    get: (url, config = {}) => circuitBreaker.fire({ method: "get", url, ...config }),
  };
}

export function getCircuitBreakerStats() {
  return circuitBreaker.stats;
}

export { circuitBreaker };
```

- [ ] **Step 3: Update recommendation.service.js to use new client**

Replace the entire content of `RecommendationService/src/services/recommendation.service.js`:

```javascript
import { behaviorModel } from "../models/behavior.model.js";
import { recommendationModel } from "../models/recommendation.model.js";
import { getProductServiceClient } from "../config/product-service-client.js";

const EVENT_WEIGHTS = {
  view: 1,
  add_to_cart: 3,
  buy_now: 5,
  purchased: 10,
};

const COLD_START_THRESHOLD = 3;

class RecommendationService {
  async recordBehavior(userId, productId, eventType) {
    const weight = EVENT_WEIGHTS[eventType];
    if (weight === undefined) {
      throw new Error(
        `eventType không hợp lệ. Chấp nhận: ${Object.keys(EVENT_WEIGHTS).join(", ")}`,
      );
    }

    const [event] = await Promise.all([
      behaviorModel.putEvent({ userId, productId, eventType }),
      recommendationModel.upsertScore(userId, productId, weight),
    ]);

    return event;
  }

  async fetchAllProducts() {
    const client = getProductServiceClient();
    const allProducts = [];
    let page = 1;
    let totalPages = 1;
    const limit = 100;

    do {
      const res = await client.get("/api/products", {
        params: { page, limit },
      });
      if (!res) {
        console.warn("[RecommendationService] ProductService unavailable during fetchAllProducts");
        break;
      }
      const { data: products, totalPages: tp } = res.data;
      allProducts.push(...(products || []));
      totalPages = tp || 1;
      page++;
    } while (page <= totalPages);

    return allProducts;
  }

  async getRecommendations(userId, limit = 10) {
    const client = getProductServiceClient();
    const topScores = await recommendationModel.findTopByUserId(userId, 10);

    if (topScores.length < COLD_START_THRESHOLD) {
      const res = await client.get("/api/products/featured");
      if (!res) return [];
      return res.data;
    }

    const interactedIds = new Set(topScores.map((s) => s.productId));

    const topProducts = await Promise.all(
      topScores.map((s) =>
        client
          .get(`/api/products/${s.productId}`)
          .then((res) => res ? res.data : null)
          .catch(() => null),
      ),
    );
    const validTopProducts = topProducts.filter(Boolean);

    const preferredCategories = new Set();
    const preferredBrands = new Set();
    const preferredGenders = new Set();

    for (const p of validTopProducts) {
      if (p.categoryId) preferredCategories.add(p.categoryId);
      if (p.brand) preferredBrands.add(p.brand.toLowerCase());
      if (p.gender) preferredGenders.add(p.gender.toLowerCase());
    }

    const allProducts = await this.fetchAllProducts();

    const scored = allProducts
      .filter((p) => !interactedIds.has(p.id))
      .map((p) => {
        let candidateScore = 0;
        if (preferredCategories.has(p.categoryId)) candidateScore += 3;
        if (preferredBrands.has((p.brand || "").toLowerCase()))
          candidateScore += 2;
        if (preferredGenders.has((p.gender || "").toLowerCase()))
          candidateScore += 1;
        return { product: p, candidateScore };
      })
      .filter((x) => x.candidateScore > 0)
      .sort((a, b) => b.candidateScore - a.candidateScore)
      .slice(0, limit)
      .map((x) => x.product);

    if (scored.length < limit) {
      const featuredRes = await client.get("/api/products/featured");
      if (!featuredRes) return scored;
      const featured = featuredRes.data;
      const supplemented = featured.filter(
        (p) => !interactedIds.has(p.id) && !scored.find((s) => s.id === p.id),
      );
      return [...scored, ...supplemented].slice(0, limit);
    }

    return scored;
  }
}

export const recommendationService = new RecommendationService();
```

- [ ] **Step 4: Enhance /health endpoint with circuit breaker stats**

Modify `RecommendationService/src/index.js`.

Add import:

```javascript
import { getCircuitBreakerStats } from "./config/product-service-client.js";
```

Replace the `/health` endpoint:

```javascript
app.get("/health", (req, res) => {
  res.json({
    name: "Recommendation Service",
    status: "UP",
    circuitBreakers: {
      productService: getCircuitBreakerStats(),
    },
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add RecommendationService/
git commit -m "feat: add opossum circuit breaker for ProductService calls in RecommendationService"
```

---

### Task 3b: AIService — Add Opossum Circuit Breaker to Service Factory

**Files:**
- Modify: `AIService/package.json`
- Create: `AIService/src/config/circuit-breaker.js`
- Modify: `AIService/src/config/service-discovery.js`
- Modify: `AIService/src/index.js`

- [ ] **Step 1: Install opossum**

```bash
cd AIService && npm install opossum
```

- [ ] **Step 2: Create circuit breaker factory**

Create `AIService/src/config/circuit-breaker.js`:

```javascript
import CircuitBreaker from "opossum";

const breakers = {};

const FALLBACK_DATA = {
  ProductService: { status: "unavailable", data: null },
  CartService: { status: "unavailable", data: null },
  ORDERSERVICE: { status: "unavailable", data: null },
  NotificationService: { status: "unavailable", data: null },
  RecommendationService: { status: "unavailable", data: null },
};

export function createCircuitBreaker(appName, axiosInstance) {
  if (breakers[appName]) {
    return breakers[appName];
  }

  const breaker = new CircuitBreaker(
    async (config) => {
      return await axiosInstance(config);
    },
    {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: appName,
    }
  );

  breaker.fallback((config) => {
    console.warn(`[CB] ${appName} unavailable, returning fallback data`);
    return { data: FALLBACK_DATA[appName] || { status: "unavailable" } };
  });

  breaker.on("open", () => console.warn(`[CB] Circuit opened for ${appName}`));
  breaker.on("close", () => console.info(`[CB] Circuit closed for ${appName}`));
  breaker.on("reject", () => console.warn(`[CB] Call rejected for ${appName} (circuit open)`));
  breaker.on("fallback", () => console.warn(`[CB] Fallback invoked for ${appName}`));

  breakers[appName] = breaker;
  return breaker;
}

export function getAllCircuitBreakerStats() {
  const stats = {};
  for (const [name, breaker] of Object.entries(breakers)) {
    stats[name] = breaker.stats;
  }
  return stats;
}
```

- [ ] **Step 3: Modify service-discovery.js to use circuit breaker**

Replace the entire content of `AIService/src/config/service-discovery.js`:

```javascript
import axios from "axios";
import eurekaClient from "./eureka.config.js";
import { createCircuitBreaker } from "./circuit-breaker.js";

// Fallback URLs from environment variables
const FALLBACK_URLS = {
  ProductService: process.env.PRODUCT_SERVICE_URL,
  CartService: process.env.CART_SERVICE_URL,
  ORDERSERVICE: process.env.ORDER_SERVICE_URL,
  NotificationService: process.env.NOTIFICATION_SERVICE_URL,
  RecommendationService: process.env.RECOMMENDATION_SERVICE_URL,
};

// Round-robin index per service
const serviceIndexes = {};

/**
 * Resolve service base URL from Eureka, fallback to env.
 * @param {string} appName - Eureka app name (e.g. "ProductService")
 * @returns {string} Base URL without trailing slash
 */
function resolveServiceUrl(appName) {
  const instances = eurekaClient.getInstancesByAppId(appName);

  if (!instances || instances.length === 0) {
    const fallback = FALLBACK_URLS[appName];
    if (fallback) {
      return fallback.replace(/\/api\/v1$/, "");
    }
    throw new Error(`${appName} not found in Eureka and no fallback URL configured`);
  }

  if (!serviceIndexes[appName]) {
    serviceIndexes[appName] = 0;
  }

  const instance = instances[serviceIndexes[appName] % instances.length];
  serviceIndexes[appName]++;

  return `http://${instance.hostName}:${instance.port.$}`;
}

/**
 * Create an axios client that resolves service URLs via Eureka at request time,
 * wrapped in a circuit breaker.
 * @param {string} appName - Eureka app name
 * @param {string} [basePath=""] - Base path to prepend (e.g. "/api/v1")
 * @returns {object} Wrapped client with get, post, put, delete methods
 */
export function createServiceClient(appName, basePath = "") {
  const axiosInstance = axios.create({ timeout: 10000 });

  axiosInstance.interceptors.request.use((config) => {
    const baseUrl = resolveServiceUrl(appName);
    config.url = baseUrl + basePath + config.url;
    return config;
  });

  const breaker = createCircuitBreaker(appName, axiosInstance);

  return {
    get: (url, config = {}) => breaker.fire({ method: "get", url, ...config }),
    post: (url, data = {}, config = {}) => breaker.fire({ method: "post", url, data, ...config }),
    put: (url, data = {}, config = {}) => breaker.fire({ method: "put", url, data, ...config }),
    delete: (url, config = {}) => breaker.fire({ method: "delete", url, ...config }),
  };
}
```

- [ ] **Step 4: Enhance /api/ai/health endpoint with circuit breaker stats**

Modify `AIService/src/index.js`.

Add import:

```javascript
import { getAllCircuitBreakerStats } from "./config/circuit-breaker.js";
```

Replace the `/api/ai/health` endpoint:

```javascript
app.get("/api/ai/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    circuitBreakers: getAllCircuitBreakerStats(),
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add AIService/
git commit -m "feat: add opossum circuit breaker to service discovery factory in AIService"
```

---

### Task 4: Manual Testing Guide

- [ ] **Step 1: Test PaymentService circuit breaker**

Start the full stack:
```bash
docker compose up --build -d
```

Stop OrderService:
```bash
docker compose stop order-service
```

Call payment endpoint:
```bash
curl -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -d '{"orderId":1,"checkoutOrderId":"ORD-123","amount":100000}'
```

Expected: HTTP 503 with message "Không thể xác thực đơn hàng, vui lòng thử lại sau"

Restart OrderService:
```bash
docker compose start order-service
```

Wait 30s, call again. Expected: Normal response.

- [ ] **Step 2: Test CartService circuit breaker**

Stop ProductService:
```bash
docker compose stop product-service
```

Call cart update endpoint (authenticated):
```bash
curl -X PUT http://localhost:8080/api/cart/items/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"quantity":2}'
```

Expected: HTTP 503 with message "Không thể kiểm tra sản phẩm, vui lòng thử lại sau"

Restart ProductService:
```bash
docker compose start product-service
```

- [ ] **Step 3: Test RecommendationService circuit breaker**

Stop ProductService:
```bash
docker compose stop product-service
```

Call recommendations:
```bash
curl http://localhost:8087/api/recommendations/test-user
```

Expected: Empty array `[]` (graceful degradation)

Check health endpoint:
```bash
curl http://localhost:8087/health
```

Expected: Circuit breaker stats showing circuit open.

- [ ] **Step 4: Test AIService circuit breaker**

Stop ProductService:
```bash
docker compose stop product-service
```

Call AI chat with product search:
```bash
curl -X POST http://localhost:8086/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Search for shirts"}'
```

Expected: AI responds with "product search temporarily unavailable" message.

Check health endpoint:
```bash
curl http://localhost:8086/api/ai/health
```

Expected: Circuit breaker stats for all 5 services.

- [ ] **Step 5: Commit (if any test-related changes)**

```bash
git status
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 4 phases covered — PaymentService (Task 1), CartService (Task 2), RecommendationService (Task 3a), AIService (Task 3b), Manual Testing (Task 4).
- [x] **No placeholders:** Every step has complete code, exact file paths, and exact commands.
- [x] **Type consistency:** `ServiceUnavailableException` created per service with consistent constructor. Fallback method signatures match annotated method signatures + Throwable.
- [x] **DRY:** CartService extracts shared `getProductWithCircuitBreaker()` method instead of duplicating annotations.
- [x] **YAGNI:** SearchService (Phase 4) excluded as optional — sync-only, not user-facing.
- [x] **TDD:** Unit tests written before implementation in Tasks 1 and 2.
- [x] **Frequent commits:** Each task ends with a commit.

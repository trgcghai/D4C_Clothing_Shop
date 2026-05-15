# Design: Refactor Internal Service Communication to Eureka-based Feign

## Date
2026-05-15

## Context

Ba service đang giao tiếp nội bộ bằng cách hardcoded URL hoặc RestTemplate, bỏ qua Eureka service discovery đã được cấu hình:

- **PaymentService** → OrderService: Dùng `RestTemplate` + `${ORDER_SERVICE_URL}` từ env
- **OrderService** → ProductService: Dùng `RestTemplate` + hardcoded default `http://productservice:8082`
- **CartService** → ProductService: Dùng `@FeignClient` nhưng có `url = "${product.service.url}"` override, bypass Eureka

Vấn đề:
- Tight coupling với infrastructure config
- Không tận dụng được Eureka service discovery
- Khó maintain, boilerplate nhiều (manual JSON, HttpHeaders, HttpEntity)
- Không scale tốt khi deploy nhiều instance

## Decision

Chuyển toàn bộ synchronous internal REST calls sang **pure Eureka-based FeignClient** (Approach A):

- Xóa tất cả `RestTemplate` beans và config
- Xóa tất cả `url` attributes trong `@FeignClient`
- Xóa tất cả env vars cho internal service URLs (`ORDER_SERVICE_URL`, `PRODUCT_SERVICE_URL`)
- Dùng `name` trong `@FeignClient` khớp với `spring.application.name` từ Eureka
- Thêm `spring-cloud-starter-loadbalancer` để Feign tự động load balance giữa các instance

## Architecture

### Service Communication Flow (After)

```
PaymentService ──Feign──→ ORDERSERVICE (Eureka resolves)
OrderService   ──Feign──→ ProductService (Eureka resolves)
CartService    ──Feign──→ ProductService (Eureka resolves)
```

No hardcoded URLs. No RestTemplate. All resolution via Eureka.

---

## PaymentService Changes

### Dependencies (pom.xml)

**Add:**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

### Enable Feign

Add `@EnableFeignClients` to `PaymentServiceApplication.java`:
```java
@SpringBootApplication
@EnableFeignClients
public class PaymentServiceApplication { ... }
```

### New: Feign Client Interface

**File:** `src/main/java/iuh/fit/PaymentService/client/OrderClient.java`

```java
package iuh.fit.PaymentService.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ORDERSERVICE")
public interface OrderClient {

    @PostMapping("/api/public/orders/{orderId}/status")
    void updateOrderStatus(
        @PathVariable("orderId") Long orderId,
        @RequestBody UpdateOrderStatusRequest request
    );

    @GetMapping("/api/public/orders/{orderId}/owner")
    Long getOrderUserId(@PathVariable("orderId") Long orderId);
}
```

### New: DTO

**File:** `src/main/java/iuh/fit/PaymentService/client/dto/UpdateOrderStatusRequest.java`

```java
package iuh.fit.PaymentService.client.dto;

public record UpdateOrderStatusRequest(String status) {}
```

### Delete Files

- `src/main/java/iuh/fit/PaymentService/config/RestTemplateConfig.java`
- `src/main/java/iuh/fit/PaymentService/service/OrderServiceClient.java` (RestTemplate version)

### Update: WebhookService

Replace `OrderServiceClient` injection with `OrderClient` (Feign interface). Update method calls to use the new Feign interface.

### Config Cleanup

**application.properties** — Remove:
```properties
order.service.url=${ORDER_SERVICE_URL}
```

**.env.example** — Remove:
```
ORDER_SERVICE_URL=
```

---

## OrderService Changes

### Dependencies (pom.xml)

**Add:**
```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

### Enable Feign

Add `@EnableFeignClients` to `OrderServiceApplication.java`:
```java
@SpringBootApplication
@EnableFeignClients
public class OrderServiceApplication { ... }
```

### New: Feign Client Interface

**File:** `src/main/java/com/iuh/fit/client/ProductClient.java`

```java
package com.iuh.fit.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ProductService")
public interface ProductClient {

    @PostMapping("/api/products/variants/{variantId}/restore-stock")
    void restoreStock(
        @PathVariable("variantId") String variantId,
        @RequestBody RestoreStockRequest request
    );
}
```

### New: DTO

**File:** `src/main/java/com/iuh/fit/client/dto/RestoreStockRequest.java`

```java
package com.iuh.fit.client.dto;

public record RestoreStockRequest(int quantity) {}
```

### Delete Files

- `src/main/java/com/iuh/fit/service/ProductServiceClient.java` (RestTemplate version)

### Update: OrderService (service class)

Replace `ProductServiceClient` injection with `ProductClient` (Feign interface). Update `restoreStock` call to use the new Feign interface.

### Config Cleanup

No explicit property to remove from `application.properties` (the URL was hardcoded in Java code with default value). Remove the hardcoded default from the deleted `ProductServiceClient.java`.

---

## CartService Changes

### Update: Feign Client

**File:** `src/main/java/iuh/fit/CartService/client/ProductServiceClient.java`

**Before:**
```java
@FeignClient(name = "ProductService", url = "${product.service.url}")
```

**After:**
```java
@FeignClient(name = "ProductService")
```

Note: Use `"ProductService"` — this matches the `SERVICE_NAME` in ProductService's `eureka.config.js` (default value).

### Config Cleanup

**application.properties** — Remove:
```properties
product.service.url=${PRODUCT_SERVICE_URL:http://localhost:8082}
```

**.env.example** — Remove:
```
PRODUCT_SERVICE_URL=http://productservice:8082
```

### Verify LoadBalancer Dependency

Check if `spring-cloud-starter-loadbalancer` is already present in `pom.xml`. If not, add it.

---

## Eureka Service Name Mapping

| `spring.application.name` / Eureka `app` | Feign `name` value |
|---|---|
| `ORDERSERVICE` | `"ORDERSERVICE"` |
| `ProductService` (Node.js eureka-js-client) | `"ProductService"` |
| `PaymentService` | `"PaymentService"` |

**Important:** Feign resolves `name` against Eureka service IDs. Must match exactly what each service registers as. Spring Boot uses `spring.application.name`; Node.js services use `SERVICE_NAME` env var in `eureka.config.js`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Target service not registered in Eureka | Feign throws `FeignException` — caller handles with appropriate HTTP error response |
| Target service instance unavailable | LoadBalancer returns no instance — Feign throws `FeignException` |
| Target service returns 4xx/5xx | Feign propagates the exception — existing `@RestControllerAdvice` handles it |
| Timeout | Feign uses default timeout (configurable if needed later) |

No circuit breaker or retry logic — out of scope per task requirements.

---

## Security

- Existing `GatewayIdentityFilter` in target services continues to work — Feign calls go through the same HTTP endpoints
- If internal calls need special headers (e.g., `X-Service-Name`), add a Feign `RequestInterceptor` bean
- No changes to JWT/auth flow — internal endpoints are already `public` or use gateway identity

---

## Testing

### Unit Tests
- PaymentService: Test `OrderClient` interface contract (mock Feign)
- OrderService: Test `ProductClient` interface contract (mock Feign)
- CartService: Test `ProductServiceClient` with Eureka name resolution

### Integration Tests
- Build each service: `./mvnw clean package` (Maven) or `./gradlew build` (Gradle)
- Verify Eureka registration: `curl http://localhost:8761`
- Test end-to-end via API Gateway after `docker compose up --build -d`

### Regression Tests
- Payment flow: Create payment → verify order status updates
- Order flow: Cancel order → verify stock restored in ProductService
- Cart flow: Add item → verify product fetched from ProductService

---

## Migration Order

1. **PaymentService**: Add deps → Enable Feign → Create `OrderClient` + DTO → Replace `OrderServiceClient` → Remove RestTemplate → Remove env config
2. **OrderService**: Add deps → Enable Feign → Create `ProductClient` + DTO → Replace `ProductServiceClient` → Remove hardcoded URL
3. **CartService**: Update `ProductServiceClient` name → Remove `url` attribute → Remove env config
4. **Verify**: All services build, register in Eureka, end-to-end tests pass

---

## Rollback

Nếu cần rollback:
- Revert git commit
- Restore `RestTemplateConfig.java` và `OrderServiceClient.java` / `ProductServiceClient.java`
- Restore env vars trong `.env.example` và `application.properties`
- Không có database migration nào cần rollback

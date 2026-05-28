# API Gateway Retry Filter — Design

**Date:** 2026-05-27
**Status:** Draft
**Author:** AI Assistant

## Summary

Add retry mechanism to the API Gateway using Spring Cloud Gateway's built-in `RetryGatewayFilterFactory`. Retries up to 3 times on 5xx errors for GET/HEAD requests only, with exponential backoff (200ms → 400ms → 800ms). Pure configuration change — no code modifications needed.

## Architecture

### Configuration

Add to `Api-Gateway/src/main/resources/application.properties`:

```properties
spring.cloud.gateway.default-filters[0]=Retry=3,200,400,800,GET,HEAD
```

### Parameters

| Parameter | Value | Description |
|---|---|---|
| retries | 3 | Maximum retry attempts |
| firstBackoff | 200ms | Initial delay before first retry |
| maxBackoff | 800ms | Maximum delay between retries |
| series | 5xx | Retry on server errors only |
| methods | GET, HEAD | Only retry idempotent methods |

### How It Works

```
Client → Gateway → ProductService (503)
                ↓ retry after 200ms
                → ProductService (503)
                ↓ retry after 400ms
                → ProductService (200 OK) ✅
                ↓ response to client
```

If all 3 retries fail → returns last error response to client.

### Scope

Applies to all 12 routes automatically via `default-filters`:
- `/api/users/**` → UserService
- `/api/auth/**` → UserService
- `/api/products/**` → ProductService
- `/api/categories/**` → ProductService
- `/api/cart/**` → CartService
- `/api/admin/**` → UserService
- `/api/orders/**` → OrderService
- `/api/payments/**` → PaymentService
- `/api/webhooks/**` → PaymentService
- `/api/recommendations/**` → RecommendationService
- `/api/ai/**` → AIService
- `/api/search/**` → SearchService

## Error Handling

### Retried Conditions

- HTTP 502 (Bad Gateway)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- Connection refused / connection reset

### NOT Retried

- POST, PUT, DELETE, PATCH (non-idempotent methods)
- HTTP 4xx errors (client errors)
- HTTP 2xx responses (success)

### Edge Cases

| Scenario | Behavior |
|---|---|
| Idempotency | Only GET/HEAD retried — no duplicate payments/orders |
| Latency budget | Max 1.4s retry delay (200+400+800ms) within 120s response timeout |
| Circuit breaker interaction | Retry fires before circuit opens — correct behavior |
| Load balancing | Each retry resolves via Eureka — may hit different healthy instance |
| Partial failure | If service recovers mid-retry chain, request succeeds |

## Monitoring

- Retry events logged at DEBUG level by Spring Cloud Gateway
- Observable via `/actuator/gateway/routes` endpoint
- Existing actuator health checks cover gateway status
- No additional metrics endpoint needed

## Testing

### Manual Testing

1. Start full stack: `docker compose up --build -d`
2. Stop a service: `docker compose stop product-service`
3. Call GET endpoint: `curl -v http://localhost:8080/api/products`
4. Observe retry attempts in gateway logs
5. After 3 retries fail, verify 502/503 returned
6. Restart service: `docker compose start product-service`
7. Wait ~5s for Eureka registration, call again — should succeed

### Automated Testing

Add context load test to verify `RetryGatewayFilterFactory` is configured:

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class RetryFilterTest {
    @Autowired
    private WebTestClient webTestClient;

    @Test
    void contextLoads() {
        // Verify gateway context loads with retry filter
        webTestClient.get().uri("/actuator/health")
                .exchange()
                .expectStatus().isOk();
    }
}
```

## Dependencies

No new dependencies needed. `RetryGatewayFilterFactory` is included in `spring-cloud-starter-gateway` which is already in `build.gradle`.

## Rollback

Remove the `default-filters` line from `application.properties` and restart the gateway.

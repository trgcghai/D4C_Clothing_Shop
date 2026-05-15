# Refactor Internal Service Communication

## Objective

Refactor internal service-to-service communication to align with the existing Eureka-based service discovery architecture.

This task only covers:

1. Replace `RestTemplate` with `FeignClient`
2. Remove hardcoded service URLs and use Eureka service discovery instead

Other architecture improvements (Kafka, async events, resilience, gRPC, etc.) are intentionally out of scope for this phase.

---

# Current Problems

## 1. Usage of RestTemplate

Some services still use `RestTemplate` for internal communication.

Example:

- `PaymentService -> OrderService`
- `OrderService -> ProductService`

Issues:

- Verbose boilerplate code
- Manual URL handling
- Harder to maintain
- Legacy approach in Spring ecosystem

---

## 2. Hardcoded Service URLs

Current implementation relies on environment variables such as:

```yaml
PRODUCT_SERVICE_URL=http://localhost:8082
ORDER_SERVICE_URL=http://orderservice:8081
```

Even though Eureka is already enabled, services are still manually configured with fixed URLs.

Issues:

- Tight coupling to infrastructure
- Environment-specific configuration
- Poor scalability
- Reduced portability across environments
- Duplicated configuration management

---

# Refactor Goals

## Goal 1 — Replace RestTemplate with FeignClient

Migrate all internal synchronous REST calls from:

- `RestTemplate`

to:

- Spring Cloud OpenFeign (`@FeignClient`)

---

## Goal 2 — Use Eureka Service Discovery

Remove hardcoded service URLs.

Services should communicate using Eureka service names instead of explicit URLs.

---

# Target Architecture

Before:

```text
PaymentService
   ↓
RestTemplate
   ↓
http://ORDER_SERVICE_URL
```

After:

```text
PaymentService
   ↓
FeignClient
   ↓
order-service
   ↓
Eureka resolves instance automatically
```

---

# Refactor Scope

## Included

### Replace RestTemplate usages

Current known usages:

| Source Service | Target Service |
| -------------- | -------------- |
| PaymentService | OrderService   |
| OrderService   | ProductService |

---

### Replace hardcoded URLs

Remove usages of:

```yaml
PRODUCT_SERVICE_URL
ORDER_SERVICE_URL
```

and similar service URL environment variables used for internal communication.

---

### Configure Feign + Eureka integration

Services should resolve targets using:

```java
@FeignClient(name = "product-service")
```

instead of:

```java
@FeignClient(url = "${PRODUCT_SERVICE_URL}")
```

---

# Implementation Details

## 1. Add OpenFeign Dependency

Example:

```gradle
implementation 'org.springframework.cloud:spring-cloud-starter-openfeign'
```

or Maven equivalent.

---

## 2. Enable Feign Clients

Example:

```java
@EnableFeignClients
@SpringBootApplication
public class Application
```

---

## 3. Replace RestTemplate Classes

Before:

```java
restTemplate.postForEntity(
    orderServiceUrl + "/api/public/orders/{id}/status",
    request,
    Void.class
);
```

After:

```java
@FeignClient(name = "order-service")
public interface OrderClient {

    @PostMapping("/api/public/orders/{orderId}/status")
    void updateStatus(
        @PathVariable Long orderId,
        @RequestBody UpdateStatusRequest request
    );
}
```

---

# Eureka Service Discovery Usage

## Current (to remove)

```yaml
product:
  service:
    url: http://productservice:8082
```

or:

```yaml
PRODUCT_SERVICE_URL=http://localhost:8082
```

---

## Target

No explicit service URL required.

Feign client should use Eureka service name:

```java
@FeignClient(name = "product-service")
```

Eureka will automatically:

- resolve service instances
- load balance requests
- handle instance discovery

---

# Configuration Cleanup

## Remove

- `PRODUCT_SERVICE_URL`
- `ORDER_SERVICE_URL`
- internal service URL configs used only for service-to-service calls

---

## Keep

Eureka configuration:

```yaml
eureka:
  client:
    service-url:
      defaultZone: http://eureka-server:8761/eureka
```

---

# Expected Benefits

## Cleaner communication layer

- Less boilerplate
- More maintainable code
- Declarative HTTP clients

---

## Proper service discovery usage

- No hardcoded internal endpoints
- Better scalability
- Easier deployment across environments
- Native integration with Eureka

---

# Out of Scope

The following topics are intentionally excluded from this task:

- Kafka / event-driven architecture
- Async communication
- Circuit breaker / resilience patterns
- Service mesh
- gRPC migration
- Observability improvements
- Retry strategies
- Distributed tracing
- API Gateway changes

These may be handled in future phases.

---

# Acceptance Criteria

## Functional

- All existing RestTemplate-based internal calls are migrated to FeignClient
- Internal service communication works through Eureka discovery
- No hardcoded internal service URLs remain

---

## Technical

- Services resolve each other by Eureka service name
- Application starts successfully without service URL env variables
- Existing APIs continue to function without behavior changes

---

# Suggested Migration Order

1. Add OpenFeign dependency
2. Enable Feign clients
3. Create Feign interfaces
4. Replace RestTemplate usages
5. Remove service URL configs
6. Verify Eureka resolution works correctly
7. Regression test internal APIs

```

```

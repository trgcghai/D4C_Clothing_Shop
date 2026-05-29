# API Gateway Retry Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add retry mechanism to the API Gateway for GET/HEAD requests using Spring Cloud Gateway's built-in RetryGatewayFilterFactory.

**Architecture:** Single configuration line in application.properties adds exponential backoff retry (3 attempts, 200ms-800ms) to all 12 gateway routes. No code changes needed.

**Tech Stack:** Spring Cloud Gateway, Spring Boot 3.3.1, Gradle.

---

### Task 1: Add Retry Filter Configuration

**Files:**
- Modify: `Api-Gateway/src/main/resources/application.properties`

- [ ] **Step 1: Read current application.properties**

Read `Api-Gateway/src/main/resources/application.properties` to understand current structure. The file has 90 lines with 12 route definitions (lines 4-50), CORS config (lines 52-58), Eureka config (lines 60-73), actuator config (lines 74-75), JWKS config (lines 77-79), HTTP client timeouts (lines 81-83), and Elasticsearch config (lines 85-90).

- [ ] **Step 2: Add retry filter configuration**

Add the following line after line 75 (after `management.endpoint.health.probes.enabled=true`):

```properties
# Retry filter for GET/HEAD requests (exponential backoff: 200ms -> 400ms -> 800ms)
spring.cloud.gateway.default-filters[0]=Retry=3,200,400,800,GET,HEAD
```

The full section around line 74-77 should look like:

```properties
management.endpoints.web.exposure.include=health,info
management.endpoint.health.probes.enabled=true

# Retry filter for GET/HEAD requests (exponential backoff: 200ms -> 400ms -> 800ms)
spring.cloud.gateway.default-filters[0]=Retry=3,200,400,800,GET,HEAD

# JWKS Configuration
gateway.jwks.url=${JWKS_URL:http://userservice:8081/.well-known/jwks.json}
```

- [ ] **Step 3: Verify build compiles**

Run:
```bash
cd Api-Gateway && ./gradlew clean compileJava
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Run existing tests**

Run:
```bash
cd Api-Gateway && ./gradlew test
```

Expected: All existing tests pass (ApiGatewayApplicationTests, RouteProtectionConfigTest)

- [ ] **Step 5: Commit**

```bash
git add Api-Gateway/src/main/resources/application.properties
git commit -m "feat: add retry filter to API Gateway for GET/HEAD requests"
```

---

### Task 2: Manual Testing

**Files:**
- No file changes

- [ ] **Step 1: Start full stack**

Run:
```bash
docker compose up --build -d
```

Wait for all services to register with Eureka (~30s).

- [ ] **Step 2: Verify normal GET request works**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products
```

Expected: 200

- [ ] **Step 3: Test retry on service failure**

Stop ProductService:
```bash
docker compose stop product-service
```

Wait 10s for Eureka to detect the failure.

Call GET endpoint:
```bash
curl -v http://localhost:8080/api/products 2>&1 | grep -E "< HTTP|503|502"
```

Expected: HTTP 502 or 503 after ~1.4s (3 retries with backoff)

Check gateway logs for retry attempts:
```bash
docker compose logs api-gateway | grep -i retry
```

Expected: Log entries showing retry attempts.

- [ ] **Step 4: Test recovery**

Restart ProductService:
```bash
docker compose start product-service
```

Wait ~10s for Eureka registration.

Call GET endpoint again:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/products
```

Expected: 200

- [ ] **Step 5: Verify POST is NOT retried**

Call a POST endpoint while service is down:
```bash
docker compose stop product-service
curl -v -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}' 2>&1 | grep -E "< HTTP|503|502"
```

Expected: HTTP 502/503 immediately (no retry delay)

- [ ] **Step 6: Cleanup**

```bash
docker compose start product-service
```

---

## Self-Review

1. **Spec coverage:** ✅ Retry filter added via default-filters, applies to all routes, only GET/HEAD, 3 retries with 200-800ms backoff. All spec requirements covered.
2. **Placeholder scan:** ✅ No TBD, TODO, or vague instructions. All steps have exact code and commands.
3. **Type consistency:** ✅ N/A (configuration only, no types).
4. **Scope:** ✅ Focused on single change — one line of config plus manual testing.

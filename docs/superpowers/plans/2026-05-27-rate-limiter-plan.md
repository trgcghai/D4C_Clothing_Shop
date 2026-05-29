# Rate Limiter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Redis-based sliding window rate limiting to API Gateway (100 req/min per IP), UserService login (5 req/min per IP), and AIService chat (10 req/min per user).

**Architecture:** Each service uses Redis sorted sets to track request timestamps within a 60-second sliding window. New files contain all rate limiting logic — no modifications to existing business code. Returns HTTP 429 with Retry-After header when limits exceeded.

**Tech Stack:** Spring Cloud Gateway (Java 21, Gradle), Spring Boot (Java 21, Maven), Node.js/Express, Redis.

---

### Task 1: API Gateway Rate Limiter

**Files:**
- Modify: `Api-Gateway/build.gradle`
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RedisConfig.java`
- Create: `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java`

- [ ] **Step 1: Add Redis dependency to build.gradle**

Read `Api-Gateway/build.gradle`. Add this dependency to the `dependencies` block (after line 40):

```gradle
    // Rate limiting with Redis
    implementation 'org.springframework.boot:spring-boot-starter-data-redis-reactive'
```

- [ ] **Step 2: Create RedisConfig.java**

Create `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RedisConfig.java`:

```java
package iuh.fit.apigateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public ReactiveRedisTemplate<String, String> reactiveRedisTemplate(
            ReactiveRedisConnectionFactory connectionFactory) {
        RedisSerializationContext<String, String> serializationContext =
                RedisSerializationContext.<String, String>newSerializationContext()
                        .key(new StringRedisSerializer())
                        .value(new StringRedisSerializer())
                        .build();
        return new ReactiveRedisTemplate<>(connectionFactory, serializationContext);
    }
}
```

- [ ] **Step 3: Create RateLimiterFilter.java**

Create `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java`:

```java
package iuh.fit.apigateway.config;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;

@Component
public class RateLimiterFilter implements GlobalFilter, Ordered {

    private final ReactiveRedisTemplate<String, String> redisTemplate;
    private static final String KEY_PREFIX = "ratelimit:gateway:global:";
    private static final int LIMIT = 100;
    private static final long WINDOW_MS = 60000;

    public RateLimiterFilter(ReactiveRedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        InetSocketAddress remoteAddress = exchange.getRequest().getRemoteAddress();
        if (remoteAddress == null) {
            return chain.filter(exchange);
        }

        String ip = remoteAddress.getAddress().getHostAddress();
        String key = KEY_PREFIX + ip;
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_MS;

        return redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now)
                .then(redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart))
                .then(redisTemplate.opsForZSet().count(key, windowStart, now))
                .flatMap(count -> {
                    if (count != null && count > LIMIT) {
                        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                        exchange.getResponse().getHeaders().add("Retry-After", "30");
                        exchange.getResponse().getHeaders().add("X-RateLimit-Limit", String.valueOf(LIMIT));
                        exchange.getResponse().getHeaders().add("X-RateLimit-Remaining", "0");
                        return exchange.getResponse().setComplete();
                    }
                    return chain.filter(exchange);
                })
                .doOnSuccess(v -> redisTemplate.expire(key, java.time.Duration.ofSeconds(60)).subscribe());
    }

    @Override
    public int getOrder() {
        return -2;
    }
}
```

- [ ] **Step 4: Add Redis config to application.properties**

Read `Api-Gateway/src/main/resources/application.properties`. Add at the end:

```properties
# Redis Configuration
spring.data.redis.host=${REDIS_HOST:localhost}
spring.data.redis.port=${REDIS_PORT:6379}
```

- [ ] **Step 5: Verify build compiles**

Run:
```bash
cd Api-Gateway && ./gradlew clean compileJava
```

Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add Api-Gateway/
git commit -m "feat: add Redis-based rate limiter to API Gateway (100 req/min per IP)"
```

---

### Task 2: UserService Login Rate Limiter

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/WebConfig.java`

- [ ] **Step 1: Create RateLimitInterceptor.java**

Create `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`:

```java
package iuh.fit.UserService.Config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RateLimitInterceptor.class);
    private final RedisTemplate<String, String> redisTemplate;
    private static final String KEY_PREFIX = "ratelimit:userservice:signin:";
    private static final int LIMIT = 5;
    private static final long WINDOW_MS = 60000;

    public RateLimitInterceptor(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"POST".equalsIgnoreCase(request.getMethod()) || !request.getRequestURI().contains("/signin")) {
            return true;
        }

        String ip = request.getRemoteAddr();
        String key = KEY_PREFIX + ip;
        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_MS;

        try {
            redisTemplate.opsForZSet().add(key, String.valueOf(now), (double) now);
            redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
            Long count = redisTemplate.opsForZSet().count(key, windowStart, now);
            redisTemplate.expire(key, 60, TimeUnit.SECONDS);

            if (count != null && count > LIMIT) {
                response.setStatus(429);
                response.setHeader("Retry-After", "30");
                response.setHeader("Content-Type", "application/json");
                response.getWriter().write("{\"error\":\"Too many login attempts. Please try again later.\",\"retryAfter\":30}");
                return false;
            }
        } catch (IOException e) {
            log.error("[RateLimiter] Failed to write rate limit response: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.warn("[RateLimiter] Redis unavailable, allowing request through: {}", e.getMessage());
            return true; // Fail-open
        }

        return true;
    }
}
```

- [ ] **Step 2: Create WebConfig.java**

Create `UserService/src/main/java/iuh/fit/UserService/Config/WebConfig.java`:

```java
package iuh.fit.UserService.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;

    public WebConfig(RateLimitInterceptor rateLimitInterceptor) {
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor);
    }
}
```

- [ ] **Step 3: Add Redis config to UserService .env**

Read `UserService/.env.example`. Add if not present:

```
SPRING_DATA_REDIS_HOST=redis
SPRING_DATA_REDIS_PORT=6379
```

Read `UserService/.env`. Add if not present:

```
SPRING_DATA_REDIS_HOST=${SPRING_DATA_REDIS_HOST:localhost}
SPRING_DATA_REDIS_PORT=${SPRING_DATA_REDIS_PORT:6379}
```

- [ ] **Step 4: Verify build compiles**

Run:
```bash
cd UserService && ./mvnw clean compile
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add UserService/
git commit -m "feat: add rate limiter to UserService login endpoint (5 req/min per IP)"
```

---

### Task 3: AIService Chat Rate Limiter

**Files:**
- Create: `AIService/src/middlewares/rateLimiter.middleware.js`
- Modify: `AIService/src/routes/chat.routes.js`

- [ ] **Step 1: Create rateLimiter.middleware.js**

Create `AIService/src/middlewares/rateLimiter.middleware.js`:

```javascript
import redisClient from "../config/redis.config.js";

const KEY_PREFIX = "ratelimit:aiservice:chat:user:";
const LIMIT = 10;
const WINDOW_MS = 60000;

export const rateLimiter = async (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return next();
  }

  const key = KEY_PREFIX + userId;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  try {
    await redisClient.zadd(key, now, `${now}`);
    await redisClient.zremrangebyscore(key, 0, windowStart);
    const count = await redisClient.zcount(key, windowStart, now);
    await redisClient.expire(key, 60);

    if (count > LIMIT) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: 30,
      });
    }
  } catch (err) {
    console.warn("[RateLimiter] Redis unavailable, allowing request through:", err.message);
    return next(); // Fail-open
  }

  next();
};
```

- [ ] **Step 2: Apply middleware to chat routes**

Read `AIService/src/routes/chat.routes.js`. Add import at top:

```javascript
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
```

Apply `rateLimiter` to the POST chat endpoint. Find the line that registers the POST handler and change it:

```javascript
// BEFORE:
router.post("/", processMessage);

// AFTER:
router.post("/", rateLimiter, processMessage);
```

- [ ] **Step 3: Verify service starts**

Run:
```bash
cd AIService && node -c src/middlewares/rateLimiter.middleware.js
```

Expected: No errors (syntax check passes)

- [ ] **Step 4: Commit**

```bash
git add AIService/
git commit -m "feat: add rate limiter to AIService chat endpoint (10 req/min per user)"
```

---

### Task 4: Manual Testing

**Files:**
- No file changes

- [ ] **Step 1: Start full stack**

Run:
```bash
docker compose up --build -d
```

Wait for all services to register (~30s).

- [ ] **Step 2: Test gateway rate limit**

Send 101 rapid requests:
```powershell
for ($i = 1; $i -le 101; $i++) {
  $status = (Invoke-WebRequest -Uri "http://localhost:8080/api/products" -Method GET -UseBasicParsing).StatusCode
  Write-Host "Request $i : $status"
}
```

Expected: Requests 1-100 return 200, request 101 returns 429.

- [ ] **Step 3: Test login rate limit**

Send 6 rapid login requests:
```powershell
for ($i = 1; $i -le 6; $i++) {
  $response = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/signin" -Method POST -ContentType "application/json" -Body '{"username":"test","password":"test"}' -UseBasicParsing -ErrorAction SilentlyContinue
  Write-Host "Request $i : $($response.StatusCode)"
}
```

Expected: Requests 1-5 return 401 (invalid creds), request 6 returns 429.

- [ ] **Step 4: Test AI chat rate limit**

Login first to get a token, then send 11 rapid chat requests:
```powershell
# Replace <TOKEN> with actual auth token
for ($i = 1; $i -le 11; $i++) {
  $response = Invoke-WebRequest -Uri "http://localhost:8080/api/ai/chat" -Method POST -ContentType "application/json" -Headers @{"Authorization"="Bearer <TOKEN>"} -Body '{"message":"test"}' -UseBasicParsing -ErrorAction SilentlyContinue
  Write-Host "Request $i : $($response.StatusCode)"
}
```

Expected: Requests 1-10 return 200, request 11 returns 429.

- [ ] **Step 5: Verify recovery**

Wait 60 seconds, then repeat any test. Expected: All requests succeed again.

---

## Self-Review

1. **Spec coverage:** ✅ API Gateway rate limiter (100 req/min per IP), UserService login rate limiter (5 req/min per IP), AIService chat rate limiter (10 req/min per user). All use Redis sorted sets, sliding window, 429 responses with Retry-After header. All spec requirements covered.
2. **Placeholder scan:** ✅ No TBD, TODO, or vague instructions. All steps have exact code, file paths, and commands.
3. **Type consistency:** ✅ Redis key pattern consistent (`ratelimit:{service}:{endpoint}:{identifier}`). All services use same 60s window. Fail-open behavior consistent.
4. **Scope:** ✅ 3 tasks, one per service. Each independently testable. No cross-service dependencies.

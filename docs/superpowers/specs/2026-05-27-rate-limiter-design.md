# Rate Limiter Implementation — Design

**Date:** 2026-05-27
**Status:** Draft
**Author:** AI Assistant

## Summary

Implement Redis-based sliding window rate limiting across 3 layers: API Gateway (global IP limit), UserService (login endpoint), and AIService (AI chat endpoint). Uses Redis sorted sets for accurate counting with automatic expiration. Returns HTTP 429 with `Retry-After` header when limits are exceeded.

## Architecture

### Redis Key Pattern

`ratelimit:{service}:{endpoint}:{identifier}`

Examples:
- `ratelimit:gateway:global:192.168.1.1`
- `ratelimit:userservice:signin:192.168.1.1`
- `ratelimit:aiservice:chat:user:123`

### Rate Limit Algorithm

Sliding window counter using Redis sorted sets:
1. Add current timestamp as member and score
2. Remove entries older than window (60s)
3. Count remaining entries
4. If count > limit → reject with 429
5. Set key TTL to 60s for auto-cleanup

### Limits

| Target | Endpoint | Limit | Window | Identifier |
|---|---|---|---|---|
| API Gateway | All routes | 100 req/min | 60s | Client IP |
| UserService | `/api/auth/signin` | 5 req/min | 60s | Client IP |
| AIService | `/api/ai/chat` | 10 req/min | 60s | User ID (from `x-user-id` header) |

## Implementation Details

### API Gateway

**New files:**
- `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RateLimiterFilter.java` — `GlobalFilter` implementation
- `Api-Gateway/src/main/java/iuh/fit/apigateway/config/RedisConfig.java` — RedisTemplate configuration

**Dependencies:**
- Add `spring-boot-starter-data-redis-reactive` to `build.gradle`

**Logic:**
- Extract client IP from `exchange.getRequest().getRemoteAddress()`
- Apply sliding window counter with limit 100
- Return 429 with `Retry-After: 30` header if exceeded
- Filter order: -2 (before routing)

### UserService

**New files:**
- `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java` — `HandlerInterceptor`
- `UserService/src/main/java/iuh/fit/UserService/Config/WebConfig.java` — register interceptor

**Dependencies:** Already has `spring-boot-starter-data-redis` and `RedisTemplate`

**Logic:**
- Intercept only `/api/auth/signin` POST requests
- Apply sliding window counter with limit 5
- Return 429 with JSON error message if exceeded
- Allow all other requests through

### AIService

**New files:**
- `AIService/src/middlewares/rateLimiter.middleware.js` — Express middleware

**Dependencies:** Already has `ioredis`

**Logic:**
- Apply to POST `/api/ai/chat` route
- Extract user ID from `x-user-id` header
- Apply sliding window counter with limit 10
- Return 429 with JSON error and `retryAfter` field if exceeded
- Pass through if no user ID (unauthenticated requests not rate limited at this layer)

## 429 Response Format

**Headers:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1716800000
```

**Body:**
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 30
}
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Redis unavailable | Allow request through (fail-open) — log warning |
| Invalid IP | Skip rate limiting for that request |
| Missing user ID (AIService) | Skip rate limiting |
| Concurrent requests | Redis sorted set operations are atomic |

## Testing

### Manual Testing

1. Start full stack: `docker compose up --build -d`
2. Test gateway limit: Send 101 rapid GET requests to `/api/products`
   - Expected: First 100 succeed, 101st returns 429
3. Test login limit: Send 6 rapid POST requests to `/api/auth/signin`
   - Expected: First 5 process, 6th returns 429
4. Test AI limit: Send 11 rapid POST requests to `/api/ai/chat` (with valid auth)
   - Expected: First 10 process, 11th returns 429
5. Verify recovery: Wait 60s, send request again — should succeed

### Automated Testing

- Unit tests for each rate limiter component with mocked Redis
- Integration tests verifying 429 response and headers
- Test Redis fail-open behavior

## Monitoring

- Redis keys auto-expire after 60s
- Log rate limit violations at WARN level
- Can monitor Redis key count: `KEYS ratelimit:*`
- Gateway actuator metrics can track 429 responses

## Dependencies

| Service | New Dependency |
|---|---|
| API Gateway | `spring-boot-starter-data-redis-reactive` |
| UserService | None (already has Redis) |
| AIService | None (already has ioredis) |

## Rollback

Remove rate limiter filters/middleware and dependencies. All rate limiting logic is isolated in new files — no modifications to existing business logic.

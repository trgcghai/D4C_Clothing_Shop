# Signup Rate Limiter Design

**Date:** 2026-05-28
**Status:** Approved

## Problem

The `/api/auth/signup` endpoint has no rate limiting. Attackers can spam signup requests to:
- Flood the database with zombie accounts
- Squat on usernames
- Abuse the email verification system
- Enumerate available usernames/emails

The existing `RateLimitInterceptor` only protects `/api/auth/signin`.

## Requirements

- Rate limit signup by **IP address** (3 req/60s) AND **email** (2 req/60s)
- Return HTTP 429 with same error format as signin
- Fail-open if Redis is unavailable (same as signin)
- Follow existing patterns — extend `RateLimitInterceptor`, no new files

## Architecture

### Redis Key Structure

| Endpoint | Key Pattern | Window | Limit |
|----------|-------------|--------|-------|
| Signin | `ratelimit:userservice:signin:{ip}` | 60s | 5 |
| Signup (IP) | `ratelimit:userservice:signup:ip:{ip}` | 60s | 3 |
| Signup (Email) | `ratelimit:userservice:signup:email:{email}` | 60s | 2 |

### Flow

```
POST /api/auth/signup
  ↓
Interceptor: check IP key → if > 3, return 429
  ↓
Interceptor: parse email from body → check email key → if > 2, return 429
  ↓
Both pass → allow request through
```

### Response Format

```
HTTP 429
Retry-After: 30
Content-Type: application/json

{"error":"Too many signup attempts. Please try again later.","retryAfter":30}
```

## Implementation

### File: `UserService/src/main/java/iuh/fit/UserService/Config/RateLimitInterceptor.java`

**Changes:**
1. Add constants: `SIGNUP_IP_KEY_PREFIX`, `SIGNUP_EMAIL_KEY_PREFIX`, `SIGNUP_IP_LIMIT`, `SIGNUP_EMAIL_LIMIT`
2. In `preHandle()`: add branch for `/api/auth/signup` POST requests
3. Extract email from request body using `BufferedReader` on `request.getInputStream()`
4. Check IP limit first, then email limit (fail fast)
5. If email parsing fails, skip email rate limit (don't block legitimate requests)
6. Extract `checkRateLimit()` helper method to avoid duplicating Redis ZSet logic

### File: `UserService/src/main/java/iuh/fit/UserService/Config/WebConfig.java`

**No changes** — interceptor already registered.

### File: `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java`

**No changes** — interceptor runs before controller.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Redis unavailable | Log warning, allow request through (fail-open) |
| Email parse error | Log warning, skip email rate limit, check IP only |
| Request body empty | Skip email rate limit, check IP only |
| IO exception writing response | Log error, return false (block request) |

## Testing

- Unit test: IP rate limit blocks after 3 requests
- Unit test: Email rate limit blocks after 2 requests
- Unit test: Different IPs can signup independently
- Unit test: Different emails from same IP both rate limited independently
- Unit test: Redis failure allows request through
- Unit test: Malformed body skips email rate limit

## Rollback

If issues arise, revert `RateLimitInterceptor.java` to previous version. No database or config changes needed.

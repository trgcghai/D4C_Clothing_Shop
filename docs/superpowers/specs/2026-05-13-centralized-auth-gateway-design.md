# Centralized Authentication & Authorization at API Gateway

**Date:** 2026-05-13
**Status:** Draft — awaiting review

## Problem

Currently only UserService has JWT authentication. All other services (ProductService, CartService, OrderService, PaymentService, NotificationService) are completely unprotected behind the API Gateway. Any client can call these services directly without authentication.

## Solution Overview

Move all JWT validation to the API Gateway using asymmetric RSA keys. Gateway validates tokens locally, strips the Authorization header, and forwards user identity via `X-User-*` headers. Downstream services trust the Gateway and read identity from headers.

## Architecture

```
Frontend → Api-Gateway (:8080) → Downstream Services
                │
                ├── JWT Validation (RSA public key, local)
                ├── Strip Authorization header
                ├── Inject X-User-Id, X-User-Username, X-User-Email, X-User-Roles
                └── Route to service (lb://SERVICENAME)
```

## Components

### 1. UserService — Token Issuer & JWKS Provider

**RSA Key Pair:**
- On first startup: generate RSA-256 key pair and persist to `config/rsa-private.pem` and `config/rsa-public.pem` (or load from `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` env vars if set)
- On subsequent restarts: load existing keys from file or env — **do NOT regenerate**
- Private key: used only for signing JWTs, never leaves UserService
- Public key: exposed via JWKS endpoint
- Key rotation: manual operation — generate new pair, redeploy both services, old tokens expire naturally via their `exp` claim

**JWKS Endpoint:**
- `GET /.well-known/jwks.json`
- Returns public key in standard JWKS format
- Used by Gateway to verify tokens without sharing secrets

**JWT Payload (updated):**
| Claim | Type | Description |
|---|---|---|
| `sub` | String | Username |
| `userId` | Long | User ID |
| `email` | String | User email |
| `roles` | List\<String\> | User roles (e.g., ["USER", "ADMIN"]) |
| `iat` | Date | Issued at |
| `exp` | Date | Expiration |

**Changes:**
- `JwtUtils`: Switch from HMAC to RSA signing, add email claim
- Add `RsaKeyUtils` for key pair generation and persistence
- Add `JwksController` for `/.well-known/jwks.json`
- Remove `JwtAuthenticationFilter` — auth responsibility moves to Gateway

**Refresh Token Flow (unchanged, handled by UserService):**
- `/api/auth/refresh` is a public route — Gateway does NOT validate tokens on this endpoint
- Frontend sends: `{ "refreshToken": "<refresh_token>" }` to `/api/auth/refresh`
- UserService validates refresh token against `user_db` (existing logic)
- If valid: issues new access token (signed with persisted RSA private key) + new refresh token
- If invalid/expired/revoked: returns `401`
- Frontend stores new access token, uses it through Gateway for subsequent requests
- Refresh token rotation: old refresh token is consumed and replaced with a new one (existing behavior)

### 2. Api-Gateway — Token Validator & Identity Forwarder

**Dependencies:**
- `jjwt` (jjwt-api, jjwt-impl, jjwt-jackson) with RSA support
- `spring-boot-starter-webflux` (already present via Gateway)

**JwtValidationFilter (GlobalFilter):**
- On startup: fetch JWKS from `http://userservice/.well-known/jwks.json`, cache public key
- On each request:
  1. Check if route requires auth (see route table below)
  2. If public → pass through
  3. Extract `Authorization: Bearer <token>`
  4. If missing → return `401`
  5. Validate JWT: signature, expiry, structure
  6. If invalid → return `401`
  7. Extract claims, strip `Authorization`, inject headers:
     - `X-User-Id`
     - `X-User-Username`
     - `X-User-Email`
     - `X-User-Roles` (comma-separated)
  8. Forward to downstream service

**Admin Role Check Filter:**
- For `/api/admin/**` routes: check `X-User-Roles` contains `ADMIN`
- If not → return `403 Forbidden`

**Route Protection Table:**
| Route Pattern | Auth Required | Notes |
|---|---|---|
| `/api/auth/**` | No | Login, register, refresh token — handled entirely by UserService |
| `/api/products/**` | No | Public browsing |
| `/api/categories/**` | No | Public browsing |
| `/api/users/**` | Yes | User profile |
| `/api/admin/**` | Yes + ADMIN role | Admin operations |
| `/api/cart/**` | Yes | Shopping cart |
| `/api/orders/**` | Yes | Order management |
| `/api/payments/**` | Yes | Payment processing |
| `/api/webhooks/**` | No | External payment callbacks |

**JWKS Cache Strategy:**
- Fetch on startup, cache in memory
- TTL: 5 minutes
- On validation failure: re-fetch JWKS once, retry validation (handles key rotation)

### 3. Downstream Services — Trusted Consumers

**Changes per service (ProductService, CartService, OrderService, PaymentService, NotificationService):**
- Remove `JwtAuthenticationFilter` and JWT-related security config
- Update `SecurityConfig` to permit all requests (Gateway is the only entry point)
- Read user identity from headers when needed:
  - `request.getHeader("X-User-Id")`
  - `request.getHeader("X-User-Email")`
  - `request.getHeader("X-User-Roles")`
- Recommended: reject requests missing `X-User-Id` header (prevents direct access bypass)

## Error Handling

| Scenario | HTTP Status | Response |
|---|---|---|
| Missing Authorization on protected route | 401 | `{ "error": "Unauthorized", "message": "Missing authentication token" }` |
| Invalid or expired JWT | 401 | `{ "error": "Unauthorized", "message": "Invalid or expired token" }` |
| Non-ADMIN accessing `/api/admin/**` | 403 | `{ "error": "Forbidden", "message": "Admin access required" }` |
| JWKS unavailable at Gateway startup | Fail to start | Log error, retry with exponential backoff |
| Invalid or revoked refresh token | 401 | `{ "error": "Unauthorized", "message": "Invalid or expired refresh token" }` |

## Environment Variables

### UserService
| Variable | Description |
|---|---|
| `JWT_EXPIRATION_MS` | Access token TTL |
| `JWT_REFRESH_EXPIRATION_MS` | Refresh token TTL |
| `JWT_PRIVATE_KEY` | RSA private key (PEM format, optional — auto-generated if not set) |
| `JWT_PUBLIC_KEY` | RSA public key (PEM format, optional — auto-generated if not set) |

### Api-Gateway
| Variable | Description |
|---|---|
| `JWKS_URL` | URL to UserService JWKS endpoint (default: `http://userservice/.well-known/jwks.json`) |
| `JWKS_CACHE_TTL_MS` | JWKS cache time-to-live (default: 300000 = 5 min) |

## Migration Order

1. UserService: Add RSA key generation, JWKS endpoint, update JWT payload with email
2. Api-Gateway: Add JWT validation filter, JWKS fetcher, header injection, route protection
3. Each downstream service: Remove JWT filters, update SecurityConfig, read from headers
4. Test end-to-end flow
5. Remove old HMAC `jwt.secret` from all configs

## Security Considerations

- Private key never leaves UserService
- Gateway strips Authorization header before forwarding — downstream services never see the token
- Downstream services should bind to internal network only (not exposed to frontend)
- `X-User-*` headers should be rejected if they come from external clients (prevent header injection)
- Gateway MUST strip any incoming `X-User-*` headers from client requests before validation — only inject them after successful JWT validation
- JWKS endpoint should be accessible only within the internal network

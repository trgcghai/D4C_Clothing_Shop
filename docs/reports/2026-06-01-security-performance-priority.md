# Security & Performance Improvement Priority Report

**Date:** 2026-06-01
**Goal:** Raise Security from 3/10 → 6-7/10, Performance from 4/10 → 6-7/10
**Status:** Report only — no changes made

---

## Security: 3/10 → 6-7/10

### Current Score Breakdown (3/10)

| Category | Score | Notes |
|---|---|---|
| Authentication | 1/10 | Header-only trust, no shared secret |
| Authorization | 2/10 | 3/4 services `.anyRequest().permitAll()` |
| Transport Security | 0/10 | Zero HTTPS/TLS |
| Credential Management | 2/10 | Default passwords, guest:guest fallbacks |
| Rate Limiting | 4/10 | Gateway + UserService + AIService already cover all traffic |
| Input Validation | 4/10 | Java OK, Node.js has zero schema validation |
| Good Practices | 8/10 | RS256 JWT, HMAC webhooks, non-root Docker, parameterized queries |

### Priority Tiers

#### TIER 1 — Must Fix (3/10 → 5.5/10) — Effort: 3-4 days

| # | Fix | Impact | Effort | Files Affected |
|---|---|---|---|---|
| **S1** | **Add shared secret verification to GatewayIdentityFilter** | Eliminates header spoofing. Gateway signs headers with HMAC, services verify. Single curl command no longer bypasses auth. | High | All 4 Java services `GatewayIdentityFilter.java`, Api-Gateway `JwtValidationFilter.java` |
| **S2** | **Fix `.anyRequest().permitAll()` on PaymentService, OrderService, CartService** | Spring Security becomes a real fallback layer instead of decorative. | Low | 3 `SecurityConfig.java` files |
| **S3** | **Add Spring Security + GatewayIdentityFilter to NotificationService** | Currently has zero authentication. Any service can trigger email sends. | Medium | NotificationService: new `SecurityConfig.java`, new `GatewayIdentityFilter.java`, add `spring-boot-starter-security` |
| **S4** | **Strip `Authorization` header at gateway after JWT validation** | Prevents JWT exposure to downstream services. Defense in depth. | Low | Api-Gateway `JwtValidationFilter.java` |
| **S6** | **Add request body validation to Node.js services (Zod)** | Prevents malformed data reaching DynamoDB. Schema validation for all POST/PUT endpoints in ProductService, RecommendationService, AIService. | Medium | ProductService, RecommendationService, AIService: new validation middleware |

#### TIER 2 — Should Fix (5.5/10 → 6.5/10) — Effort: 1 day

| # | Fix | Impact | Effort | Files Affected |
|---|---|---|---|---|
| **S8** | **Protect SearchService admin endpoints with auth middleware** | `/api/search/admin/sync` and `/api/search/admin/dlq/retry` currently have no protection or inconsistent `x-internal-token`. Replace with `requireAuth` + `requireAdmin` middleware matching ProductService pattern for consistency. | Low | SearchService `admin.controller.js`, new `auth.middleware.js`, routes |
| **S9** | **Fix AIService `requireAdmin` null check** | Crashes with 500 instead of returning 403 when `x-user-roles` header missing. | Trivial | AIService `auth.middleware.js` |

### Recommended Implementation Order

```
S1 → S2 → S3 → S4 → S6 → S8 → S9
```

**S1 is the single highest-impact fix.** It closes the "one curl command" vulnerability. Without S1, all other auth improvements can be bypassed by sending requests directly to service ports.

**S6 moved to Tier 1** because Node.js services handle product mutations, stock operations, and recommendation data — unvalidated input can corrupt DynamoDB tables directly.

**S5 (per-service rate limiting) removed** — Gateway rate limiter (100 req/60s per IP) already covers all inbound traffic. Per-service rate limiting is redundant unless ports are directly exposed, which S1 mitigates by making header spoofing impossible.

---

## Performance: 4/10 → 6-7/10

### Current Score Breakdown (4/10)

| Category | Score | Notes |
|---|---|---|
| Database Queries | 1/10 | 100% DynamoDB Scan, no GSIs, in-memory pagination |
| Caching | 5/10 | CartService Redis OK, ProductService zero caching |
| Connection Pooling | 3/10 | Default HikariCP (10), default Tomcat (200 threads) |
| Message Processing | 3/10 | Single consumer threads, no concurrency |
| Resource Management | 2/10 | No Docker limits, no CDN |
| Good Practices | 7/10 | Cart Redis caching, async payment, order pagination+EntityGraph, circuit breakers, outbox |

### Priority Tiers

#### TIER 1 — Must Fix (4/10 → 5.5/10) — Effort: 2-3 days

| # | Fix | Impact | Effort | Files Affected |
|---|---|---|---|---|
| **P1** | **Add GSIs to DynamoDB + replace Scan with Query** | Reduces RCU consumption by 10-100×. Product reads go from O(N) table scan to O(1) index lookup. Critical for catalog >1000 items. | High | `product.model.js` (all read methods), `category.model.js`, `variant.model.js`, DynamoDB table setup |
| **P2** | **Add Redis caching for product catalog (5-15min TTL)** | Eliminates 90% of DynamoDB reads for hot products. Cache product listings, categories, featured items. | Medium | ProductService: new cache layer in `product.service.js`, `category.service.js`, Redis config |
| **P3** | **Fix in-memory pagination to database-level pagination** | Current: scan ALL products → filter in JS → `Array.slice()`. Fix: Query with GSI + DynamoDB `Limit`/`ExclusiveStartKey` for true cursor pagination. | Medium | `product.service.js` `getProductsWithFilters()`, `searchProducts()` |

#### TIER 2 — Should Fix (5.5/10 → 6.5/10) — Effort: 1 day

| # | Fix | Impact | Effort | Files Affected |
|---|---|---|---|---|
| **P4** | **Batch cart validation endpoint** | Replace N sequential HTTP calls with 1 batch call. Cart with 10 items: 10× latency → 1× latency. | Medium | ProductService: new `POST /api/products/validate-batch` endpoint, CartService: update `validateCart()` |
| **P5** | **Tune HikariCP pool size (30-50 per service)** | Prevents connection exhaustion under concurrent load. Default 10 is too low for services handling checkout + catalog + payments. | Low | All Java services `application.properties`: 4-5 lines each |
| **P6** | **Add RabbitMQ consumer concurrency (5-10 threads)** | NotificationService processes emails 5-10× faster. Prevents queue buildup during order spikes. | Low | `NotificationService/application.properties`: 2 lines |

### Recommended Implementation Order

```
P1 → P2 → P3 → P4 → P5 → P6
```

**P1 is the single highest-impact fix.** DynamoDB Scan on every product read is the biggest performance bottleneck. With 1000 products, each listing page reads 1000 rows. With 10,000 products, it reads 10,000 rows. This does not scale.

**P9 (CloudFront CDN) removed from plan** — requires external AWS infrastructure configuration (CloudFront distribution, DNS/CNAME, origin setup) that has never been configured in this project. It is an operational change, not a code change. If you want CDN later, it can be added as a separate infrastructure task.

---

## Combined Priority Matrix

### Quick Wins (High Impact, Low Effort)

| Priority | Fix | Score Impact | Effort |
|---|---|---|---|
| **S2** | Fix `.anyRequest().permitAll()` | +0.5 security | Low |
| **S4** | Strip Authorization header | +0.25 security | Low |
| **P5** | Tune HikariCP | +0.5 performance | Low |
| **P6** | RabbitMQ concurrency | +0.5 performance | Low |

### High Impact (Must Do)

| Priority | Fix | Score Impact | Effort |
|---|---|---|---|
| **S1** | Gateway shared secret (HMAC) | +1.0 security | High |
| **S3** | Secure NotificationService | +0.5 security | Medium |
| **S6** | Node.js request validation (Zod) | +0.5 security | Medium |
| **P1** | DynamoDB GSIs + Query | +1.0 performance | High |
| **P2** | Redis product caching | +0.5 performance | Medium |
| **P3** | Database-level pagination | +0.5 performance | Medium |

### Medium Impact (Should Do)

| Priority | Fix | Score Impact | Effort |
|---|---|---|---|
| **S8** | SearchService auth middleware | +0.25 security | Low |
| **S9** | Fix AIService null check | +0.1 security | Trivial |
| **P4** | Batch cart validation | +0.5 performance | Medium |

---

## Effort Summary

| Phase | Fixes | Est. Effort | Score After |
|---|---|---|---|
| **Phase 1: Quick Wins** | S2, S4, P5, P6 | 0.5 day | Security 4/10, Performance 5.5/10 |
| **Phase 2: Critical Fixes** | S1, S3, P1, P2, P3 | 3-4 days | Security 5.5/10, Performance 6.5/10 |
| **Phase 3: Hardening** | S6, P4 | 2 days | Security 6/10, Performance 7/10 |
| **Phase 4: Polish** | S8, S9 | 1 day | Security 6.5/10, Performance 7/10 |

**Total estimated effort: 6.5-8.5 days** to reach ~6.5/10 security, ~7/10 performance.

**Minimum viable: Phase 1 + Phase 2 (3.5-4.5 days)** → Security 5.5/10, Performance 6.5/10.

---

## Risk Assessment

| Fix | Risk | Mitigation |
|---|---|---|
| S1 (HMAC shared secret) | Medium — breaks all service-to-service calls if misconfigured | Test in dev first, add detailed logging during rollout |
| P1 (DynamoDB GSIs) | Medium — GSI creation takes time on large tables, may affect writes | Create GSIs during low-traffic window, use backfill |
| P2 (Redis caching) | Low — cache invalidation bugs possible | Short TTL (5min), invalidate on mutations, cache-aside pattern |
| P3 (Pagination) | Low — API response format may change slightly | Keep same response shape, add `lastEvaluatedKey` for cursor |
| S3 (NotificationService security) | Low — may break existing internal calls | Add public paths for legitimate internal callers |
| S6 (Zod validation) | Low — may reject previously-accepted requests | Start with permissive schemas, tighten after monitoring |

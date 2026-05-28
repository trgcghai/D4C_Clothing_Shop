# D4C Clothing Shop — Microservices Architecture Review

**Date:** 2026-05-28
**Reviewer:** AI Assistant (microservices-architect skill)
**Scope:** Full system review — service boundaries, business flows, communication, fault tolerance, security, observability, data consistency, deployment

---

## Scorecard

| Area                                      | Status                      | Severity     |
| ----------------------------------------- | --------------------------- | ------------ |
| Service Boundaries                        | ✅ Good                     | Low          |
| Checkout Flow (Idempotency, Saga)         | ⚠️ Idempotent but no Saga   | **High**     |
| Communication (HTTP + MQ)                 | ✅ Good mix                 | Low          |
| Message Queue (Outbox, DLQ, Retry)        | ⚠️ DLQ has no consumers     | **High**     |
| Fault Tolerance (CB, Retry, Rate Limit)   | ✅ Well covered             | Medium       |
| Security (JWT, Auth, Input Validation)    | ⚠️ Partial coverage         | Medium       |
| Observability (Tracing, Metrics, Logging) | ❌ No tracing, no metrics   | **Critical** |
| Data Consistency                          | ⚠️ No reconciliation        | Medium       |
| Deployment & Operations                   | ✅ Docker Compose, no CI/CD | Medium       |

---

## 1. Main Business Flow (Checkout: Cart → Order → Payment → Notification)

### Current Flow

```
Frontend → POST /api/orders/checkout
  → OrderService.createOrderFromCheckout() [@Transactional]
    → 1. Deduct stock via ProductClient.batchDeductStock() [SYNC Feign]
    → 2. Create Order (PENDING_PAYMENT) in MariaDB
    → 3. Publish ORDER_CREATED event (after commit) via TransactionSynchronization
  → Frontend → POST /api/payments
    → PaymentService.createPayment() [@Transactional]
      → 1. Verify order ownership via OrderClient.getOrderUserId() [SYNC Feign]
      → 2. Create Payment (PENDING, 5min expiry)
  → SePay webhook → PaymentService.markAsPaid()
    → Publish PAYMENT_CONFIRMED event → RabbitMQ
  → OrderService listens payment.confirmed.queue
    → Updates order to PAID
    → Publishes ORDER_PAID event
  → CartService listens order.paid.queue → clears cart
  → NotificationService listens email.exchange → sends email
```

### ✅ What's Done Well

- **Idempotent order creation** — checks `userId + checkoutOrderId` before creating (`OrderService.java:57-62`)
- **Idempotent payment creation** — checks `checkoutOrderId` before creating (`PaymentService.java:75-79`)
- **Idempotent event consumers** — all RabbitMQ consumers check current state before acting (e.g., "already PAID, skipping")
- **TransactionSynchronization** — ORDER_CREATED event published after DB commit, not before
- **ShedLock on PaymentExpiryJob** — prevents duplicate expiry processing in multi-instance
- **Grace period for late webhooks** — accepts payment webhook up to 1h after expiry
- **Race condition handling** — PaymentExpiryJob re-checks status after expiry

### ❌ Critical Gaps

- **No Saga compensation for stock deduction**: Stock is deducted via Feign call _inside_ `@Transactional`. If stock succeeds but DB transaction rolls back, inventory is permanently lost. `batchRestoreStock` fallback swallows errors silently (`OrderService.java:249-251`).

```
Current flow (risky):
  1. batchDeductStock() → DynamoDB ✅
  2. Create Order → DB ❌ (constraint violation)
  3. Transaction rolls back
  4. batchRestoreStock() called → but may also fail → inventory lost
```

- **Payment expiry uses direct RabbitMQ publish** (not outbox): If RabbitMQ is down, expired payments are marked but OrderService never cancels the order.
- **No end-to-end checkout timeout**: User could have stock deducted, order created, but payment never initiated. No auto-cancel for stale `PENDING_PAYMENT` orders.

---

## 2. Service Communication

### Sync (HTTP/Feign) — 6 call patterns

| Caller → Target                        | Purpose              | Resilience               |
| -------------------------------------- | -------------------- | ------------------------ |
| OrderService → ProductService          | Stock deduct/restore | ✅ CB + Retry + Bulkhead |
| PaymentService → OrderService          | Verify ownership     | ✅ CB + Retry + Bulkhead |
| CartService → ProductService           | Product lookup       | ✅ CB + Retry + Bulkhead |
| AIService → 5 services                 | AI tool calls        | ✅ CB (opossum)          |
| RecommendationService → ProductService | Product lookup       | ✅ CB (opossum)          |
| SearchService → ProductService         | Data sync            | ❌ No CB                 |

### Async (RabbitMQ) — 4 producers, 8+ queues

| Producer       | Events                                                | Consumers                   | Exchange |
| -------------- | ----------------------------------------------------- | --------------------------- | -------- |
| OrderService   | ORDER_CREATED, ORDER_PAID, ORDER_CANCELLED            | Notification, Cart, Product | Topic    |
| PaymentService | PAYMENT_CONFIRMED, PAYMENT_EXPIRED, PAYMENT_CANCELLED | OrderService                | Topic    |
| UserService    | EMAIL_VERIFICATION, ACCOUNT_LOCKED                    | NotificationService         | Topic    |
| ProductService | product.created/updated/deleted                       | SearchService               | Topic    |

### ⚠️ Concerns

- **Mixed sync/async in same flow**: Stock deduction is sync, order events are async. User gets "order created" before stock is guaranteed.
- **No API versioning** in Feign clients — breaking changes cascade.
- **Chatty interface**: CartService calls ProductService per-item in validation loops.

---

## 3. Message Queue Processing

### ✅ Done Well

- **Outbox pattern** implemented with feature flag (disabled by default)
- **DLQ configured** for all services (Notification, Order, Payment, Search, Product)
- **Message TTL** (300s) on most queues
- **Publisher confirms** on RabbitTemplate
- **SearchService has DLQ retry admin endpoint** with max 5 retries

### ❌ Critical Gaps

- **DLQs have NO consumers** in Java services — dead letters accumulate forever with no automated retry or alerting. Only SearchService handles DLQ.
- **Outbox disabled by default** (`feature.outbox.enabled=false`) — direct publish path loses events if RabbitMQ is down
- **No ShedLock on OutboxPublisherJob** — multi-instance race condition on duplicate event publishing
- **No retry backoff** on outbox — failed events retried every 5s with no exponential delay
- **No message deduplication** at consumer level — only aggregate state check, not event-level dedup

---

## 4. Fault Tolerance

### ✅ Done Well

- **Resilience4j** on all Java inter-service calls (CB + Retry + Bulkhead)
- **opossum** on Node.js services (AIService, RecommendationService)
- **API Gateway retry** — 3 retries with exponential backoff (200→400→800ms) on GET/HEAD
- **Rate limiting** at 3 layers (Gateway 100/min, Login 5/min, AI 10/min/user)
- **Graceful fallbacks** — Vietnamese error messages, empty data for non-critical paths

### ⚠️ Concerns

- **No Feign timeout config** — default 10s connect / 60s read
- **No RabbitMQ consumer retry** — message goes straight to DLQ on first failure
- **No graceful degradation for search** — Typesense down = complete failure

---

## 5. Security

### ✅ Done Well

- **JWT validation at Gateway** with JWKS from UserService
- **Gateway strips Authorization** → forwards `X-User-Id`, `X-User-Roles` headers
- **GatewayIdentityFilter** in Java services validates internal requests
- **Node.js services have `auth.middleware.js`** — ProductService, RecommendationService, AIService all validate `X-User-Id` header:
  - **ProductService**: `requireAuth` on stock operations, `requireAdmin` on CRUD. Public GET routes (browse, search, featured) intentionally open.
  - **RecommendationService**: `requireAuth` on personalized recommendations and behavior tracking.
  - **AIService**: `requireAuth` on all chat endpoints.
- **Admin role filter** on `/api/admin/**` routes
- **Rate limiting** on login (brute force protection)
- **Sensitive headers stripped** from audit logs

### ⚠️ Concerns

- **SearchService has NO auth middleware** — all search routes are fully open. Acceptable for public search but worth noting.
- **GatewayIdentityFilter trusts any header value** — no cryptographic verification headers came from gateway. An attacker on the internal network can forge `X-User-Id` headers.
- **No CSRF protection** — cookie-based refresh tokens vulnerable without `SameSite=Strict`
- **SePay webhook is publicly accessible** — no signature verification, no API key
- **No HTTPS** in development

---

## 6. Observability

### ✅ Done Well

- **Audit logging** at Gateway → Elasticsearch with traceId, userId, duration
- **Structured logging** via Logstash JSON encoder
- **Health checks** on all services via Docker Compose
- **Kibana** deployed for log visualization

### ❌ Critical Gaps

- **No distributed tracing** — no OpenTelemetry, Jaeger, or Micrometer Tracing. Impossible to trace a checkout flow across services.
- **No correlation IDs in RabbitMQ messages** — can't trace async boundaries
- **No metrics collection** — no Prometheus, no Grafana, no RED/USE metrics
- **No alerting** — no alerts for service down, high error rate, circuit breaker open, queue depth
- **No log aggregation pipeline** — services log to stdout but no shipper to ES

---

## 7. Data Consistency

### ✅ Done Well

- **Price snapshot at checkout** — `snapshotPriceAtCheckout` prevents price drift
- **Server-side total validation** — rejects if client total doesn't match calculated
- **Eventual consistency via events** — Order → Payment → Notification flow

### ⚠️ Concerns

- **Stock deduction sync, order creation eventual** — if stock succeeds but event lost, services are inconsistent
- **No cache invalidation** — CartService caches product data but no invalidation on product change
- **No data reconciliation jobs** — no periodic check for inconsistencies between services
- **No event schema versioning** — adding/removing fields breaks consumers

---

## 8. Deployment & Operations

### ✅ Done Well

- **Docker Compose** with health checks, dependency ordering, persistent volumes
- **Dev mode with hot reload** via `docker-compose.dev.yml`
- **Eureka service discovery** for dynamic routing
- **JDWP debug ports** for Java services

### ⚠️ Concerns

- **Gateway depends on ALL services** — if one fails, entire gateway waits
- **No resource limits** — runaway service can starve others
- **No backup strategy** — MariaDB, Redis data has no automated backup
- **No CI/CD pipeline** — no GitHub Actions, no staging, no canary deployment

---

## 🎯 Top 5 Priority Fixes

| #   | Fix                                       | Why                                                                                                                              | Effort |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Enable outbox by default**              | Event loss = data integrity risk. Orders/Payments can be silently lost.                                                          | Medium |
| 2   | **Add DLQ consumers with retry**          | Dead letters accumulate forever. Failed messages are never retried.                                                              | Medium |
| 3   | **Implement Saga compensation for stock** | Inventory permanently lost on order creation failure. Unacceptable for e-commerce.                                               | High   |
| 4   | **Add data reconciliation jobs**          | No periodic check for inconsistencies between services (stock vs orders, search vs products). Silent data drift goes undetected. | Medium |

---

## Summary

**Solid foundation** for a microservices e-commerce platform. The idempotency, outbox pattern, circuit breakers, and rate limiting show good architectural thinking. The critical gaps are:

1. **DLQ handling** — configured but unused, dead letters accumulate forever
2. **Saga compensation** — inventory loss risk on order creation failure
3. **Outbox disabled by default** — event loss is a real data integrity risk
4. **No data reconciliation** — stock, search, and order data can silently drift between services with no detection

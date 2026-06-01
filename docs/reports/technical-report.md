# Báo Cáo Kỹ Thuật — D4C ClothingShop

**Ngày:** 2026-06-01  
**Branch:** `fix/fix-remain-concerns`

---

## a) Design Patterns

### 1. Singleton

**Spring Beans (tất cả Java services)**
- Tất cả `@Service`, `@Component`, `@Configuration` classes là Spring-managed singletons (default scope)
- Ví dụ: `OrderService`, `PaymentService`, `CartService`, `JwtValidationFilter`, `JwksCache`

**ES Module Singletons (Node.js services)**
```javascript
// ProductService/src/services/product.service.js:393
export const productService = new ProductService();

// ProductService/src/services/stock.service.js:114
export const stockService = new StockService();

// RecommendationService/src/services/recommendation.service.js:119
export const recommendationService = new RecommendationService();
```

**Circuit Breaker Registry (AIService)**
```javascript
// AIService/src/config/circuit-breaker.js:3
const breakers = {}; // Singleton registry cho opossum circuit breakers
```

### 2. Factory Pattern

**Circuit Breaker Factory (AIService)**
```javascript
// AIService/src/config/circuit-breaker.js:13-44
function createCircuitBreaker(appName, axiosInstance) {
    // Creates and caches opossum circuit breaker per downstream service
}
```

**Service Client Factory (RecommendationService)**
```javascript
// RecommendationService/src/config/product-service-client.js:51-55
function getProductServiceClient() {
    // Returns axios client wrapped in opossum circuit breaker
}
```

### 3. Observer Pattern

**RabbitMQ Event Publishing/Consuming** — cơ chế observer chính của hệ thống:

| Publisher | Event | Consumers |
|---|---|---|
| **OrderService** | `ORDER_CREATED`, `ORDER_PAID`, `ORDER_CANCELLED` | NotificationService, CartService, ProductService |
| **PaymentService** | `PAYMENT_CONFIRMED`, `PAYMENT_CANCELLED`, `PAYMENT_EXPIRED` | OrderService |
| **ProductService** | `product.created/updated/deleted` | SearchService |
| **UserService** | `VerificationEmailEvent`, `AccountEvent` | NotificationService |

### 4. Decorator Pattern

**Gateway Filter Chain** — mỗi filter bọc `GatewayFilterChain`, thêm behavior trước/sau khi delegate:
- `RateLimiterFilter` (order=-2) → Rate limiting
- `JwtValidationFilter` (order=-1) → JWT validation + header injection
- `AdminRoleFilter` (order=0) → Admin role check
- `AuditLoggingFilter` (order=1) → Audit logging
- `CookieForwardFilter` → Cookie forwarding

**Request Wrapper Decorator**
```java
// UserService/CachedBodyFilter.java
ContentCachingRequestWrapper // Decorates request để re-read body
```

### 5. Adapter Pattern

**Feign Client Adapters**
```java
// OrderService/client/ProductClient.java
@FeignClient(name = "ProductService")
public interface ProductClient {
    // Adapts HTTP REST API thành Java interface
}
```

**JWKS Adapter (Api-Gateway)**
```java
// Api-Gateway/config/JwksCache.java
// Adapts JWKS JSON → java.security.PublicKey cho JWT verification
```

**Eureka Discovery Adapter (Node.js)**
```javascript
// RecommendationService/config/product-service-client.js
// Adapts Eureka service discovery → axios base URL
```

### 6. Proxy Pattern

**Spring AOP Proxies (Resilience4j Circuit Breaker)**
```java
// OrderService.java:247
@CircuitBreaker(name = "productService")
public BatchStockResponse batchDeductStock(...) {
    // Spring tạo AOP proxy intercept call, apply circuit breaker logic
}
```

**Self-Injection Proxy** (cho self-invocation qua AOP)
```java
// CartService.java:42-44
@Lazy @Autowired private CartService self;
// Đảm bảo @CircuitBreaker AOP proxy được gọi ngay cả với internal method calls
```

### 7. Builder Pattern

**Lombok @Builder** — sử dụng rộng rãi:
- `OutboxEvent.builder()...build()`
- `OrderResponse.builder()...build()`
- `CartResponse.builder()...build()`
- `AuditLog.builder()...build()`
- `Notification.builder()...build()`

### 8. Repository Pattern

**Spring Data JPA** (tất cả Java services)
```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = {"items"})
    Optional<Order> findByIdAndUserId(Long id, Long userId);
}
```

**DynamoDB Model Pattern** (Node.js — tương đương Repository)
```javascript
// ProductService/models/product.model.js
class ProductModel {
    async findAll() { ... }
    async findById(id) { ... }
    async create(data) { ... }
}
```

### 9. Service Layer Pattern

Tất cả services có lớp `@Service` (Java) hoặc service class (Node.js) tách biệt business logic khỏi controller/repository.

### 10. DTO/Value Object Pattern

**Java Records và DTOs** — sử dụng extensively:
- `OrderResponse`, `CreateOrderFromCheckoutRequest`, `CheckoutItemDto`
- `PaymentResponse`, `CreatePaymentRequest`
- `CartResponse`, `CartItemDto`, `CheckoutResponse`
- `BatchStockRequest` (record), `BatchStockResponse` (record)

### 11. Chain of Responsibility Pattern

**Gateway Filter Chain** — mỗi filter xử lý request và quyết định pass hay short-circuit:
```
RateLimiterFilter → JwtValidationFilter → AdminRoleFilter → AuditLoggingFilter → Route
```

**Servlet Filter Chain** (UserService, downstream services)
```
CachedBodyFilter → GatewayIdentityFilter → Spring Security Filter Chain → Controller
```

### 12. Circuit Breaker Pattern

**Resilience4j** (Java services):
- OrderService → ProductService (stock deduction)
- PaymentService → OrderService (getOrderUserId)
- CartService → ProductService (getProductById)

**opossum** (Node.js services):
- RecommendationService → ProductService
- AIService → 5 downstream services

### 13. Outbox Pattern

**OrderService + PaymentService** — full implementation:
- `OutboxEvent` entity saved trong cùng `@Transactional`
- `OutboxPublisherJob` poll mỗi 5s với ShedLock
- Exponential backoff retry (5s × 2^n + jitter, cap 5min)
- `OutboxCleanupJob` archive/delete old events

### 14. Saga Pattern (Partial)

**Choreography-based Saga** với compensating actions trong `OrderService.createOrderFromCheckout()`:
```
1. Deduct stock (sync Feign call)
2. Save order (@Transactional)
3. Nếu step 2 fail → restoreStockForOrder() (compensation)
4. Nếu compensation fail → publish StockRestoreFailedEvent (retry via outbox)
```

---

## b) CQRS (Command Query Responsibility Segregation)

**CQRS KHÔNG được implement chính thức**, nhưng có các pattern tương tự một phần:

### Partial CQRS: SearchService + Typesense

| Nhánh | Thành phần | Database |
|---|---|---|
| **Write (Command)** | ProductService | DynamoDB (`d4c_products`) |
| **Read (Query)** | SearchService | Typesense (`d4c_products` collection) |

**Cơ chế đồng bộ**:
```
ProductService CRUD → publish event → RabbitMQ → SearchService consume → upsert Typesense
```

**Lợi ích**: Typesense optimized cho full-text search với typo tolerance — nhanh hơn nhiều so với DynamoDB Scan cho search queries.

### CartService Cache-Aside Pattern

```
Read:  Redis cache (cart:{userId}) → fast response
Write: MariaDB → invalidate Redis cache → next read loads fresh data
```

### KHÔNG phải CQRS thật sự vì:

1. **Không có separate Command/Query models** — tất cả services dùng chung entity classes cho reads và writes
2. **Không có separate read/write databases** per service (ngoại trừ SearchService)
3. **Không có materialized views** cho query optimization
4. **Không có event sourcing** — state được lưu trực tiếp, không phải qua event replay

### Verdict

**Partial CQRS** — chỉ áp dụng cho search domain (ProductService → SearchService). Phần còn lại của hệ thống dùng traditional CRUD với single data store per service.

---

## c) Event Sourcing

**Event Sourcing KHÔNG được implement.**

### OutboxEvent KHÔNG phải Event Store

| Đặc điểm | Outbox Pattern | Event Sourcing |
|---|---|---|
| **Mục đích** | Reliable message delivery | State reconstruction |
| **Immutability** | Mutable (PENDING → PUBLISHED/FAILED) | Immutable, append-only |
| **Replay** | Không có cơ chế replay | Replay events để rebuild state |
| **Lifecycle** | Cleaned up sau khi publish | Giữ mãi mãi |
| **State source** | Entity state là source of truth | Events là source of truth |

### AuditLog KHÔNG phải Event Sourcing

`AuditService` trong OrderService ghi lại thay đổi order status (ai, khi nào, tại sao) — đây là **audit trail**, không phải event sourcing. Order entity lưu trạng thái hiện tại trực tiếp; `AuditLog` chỉ là supplementary record.

### Verdict

**Không có Event Sourcing**. Hệ thống dùng event-driven architecture (RabbitMQ) và Transactional Outbox cho reliable inter-service communication, nhưng không dùng Event Sourcing cho state management.

---

## d) Sync/Async

### Xử lý đồng bộ (Synchronous)

| Thành phần | Công nghệ | Ví dụ |
|---|---|---|
| **Frontend → Gateway** | HTTP/REST (Axios) | Tất cả API calls |
| **Gateway → Backend** | Spring Cloud Gateway (WebFlux) | Route qua `lb://SERVICE_NAME` |
| **OrderService → ProductService** | Feign Client + CircuitBreaker | `batchDeductStock()`, `batchRestoreStock()` |
| **PaymentService → OrderService** | Feign Client + CircuitBreaker | `getOrderUserId()`, `updateOrderStatus()` |
| **CartService → ProductService** | Feign Client + CircuitBreaker | `getProductById()`, `deductStock()` |
| **RecommendationService → ProductService** | Axios + Eureka discovery | Get product details for recommendations |
| **AIService → 5 services** | Axios + Circuit Breaker | Health check, data fetch |

**Đặc điểm**:
- Feign timeout: connect 2s, read 5s
- CircuitBreaker: sliding window 10, 50% failure threshold, 30s open state
- Retry: 3 attempts, 1s wait (fixed, không exponential)
- Bulkhead: max 10 concurrent calls, 2s max wait

### Xử lý bất đồng bộ (Asynchronous)

| Thành phần | Công nghệ | Cơ chế |
|---|---|---|
| **NotificationService** | RabbitMQ + `@RabbitListener` | Email sending (order confirmation, verification, account events) |
| **OrderService** | RabbitMQ + `@RabbitListener` | Payment confirmed/cancelled/expired → update order status |
| **CartService** | RabbitMQ + `@RabbitListener` | Order paid → clear cart |
| **ProductService** | RabbitMQ consumer (amqplib) | Order cancelled → restore stock |
| **SearchService** | RabbitMQ consumer (amqplib) | Product CRUD → sync Typesense index |

**RabbitMQ Configuration**:

| Exchange | Type | Routing Keys |
|---|---|---|
| `email.exchange` | TopicExchange | `email.verification`, `email.order.created/paid/cancelled`, `email.account.locked/unlocked` |
| `order.exchange` | TopicExchange | `order.paid`, `order.cancelled`, `stock.restore.failed` |
| `payment.exchange` | TopicExchange | `payment.confirmed`, `payment.cancelled`, `payment.expired` |
| Product exchange | TopicExchange | `product.created/updated/deleted`, `category.created/updated/deleted` |

**Consumer characteristics**:
- NotificationService: Manual ack, prefetch=10, quorum queues, 5min TTL
- OrderService: Auto ack (default), single consumer per queue
- CartService: Auto ack (default), single consumer per queue
- ProductService: Manual ack, nack → DLX after TTL

### Hybrid Patterns

**Sync validation + Async notification** (Checkout flow):
```
1. POST /api/cart/checkout → CartService (sync)
2. POST /api/orders → OrderService (sync: deduct stock + save order)
3. ORDER_CREATED event → RabbitMQ → NotificationService (async: send email)
4. POST /api/payments → PaymentService (sync: create payment)
5. SePay webhook → markAsPaid (sync)
6. PAYMENT_CONFIRMED → RabbitMQ → OrderService (async: update status)
```

**Outbox feature flag** — linh hoạt giữa direct publish và outbox pattern:
```properties
feature.outbox.enabled=true  # Outbox (reliable, async polling)
feature.outbox.enabled=false # Direct publish (fire-and-forget)
```

---

## e) Database Migration

### Chiến lược hiện tại: Hibernate Auto-DDL

**Tất cả Java services** sử dụng:
```properties
spring.jpa.hibernate.ddl-auto=update
```

| Service | File | Giá trị |
|---|---|---|
| UserService | `application.properties:16` | `update` |
| OrderService | `application.properties:12` | `update` |
| PaymentService | `application.properties:12` | `update` |
| CartService | `application.properties:10` | `update` |
| NotificationService | `application.properties:16` | `update` |

**Test profile** dùng `create-drop` để tạo schema sạch cho mỗi test run.

### KHÔNG có Migration Tool chính thức

| Tool | Trạng thái |
|---|---|
| **Flyway** | Không có dependency, không có `db/migration` folder |
| **Liquibase** | Không có dependency, không có changelog files |
| **Manual SQL scripts** | Chỉ có `V2__create_shedlock_table.sql` cho ShedLock table |

### Database Initialization

**Docker init scripts** — chạy khi MariaDB container khởi động lần đầu:
```
docker/init/01-init-databases.sql  → Tạo databases: user_db, notification_db, order_db, payment_db
docker/init/02-cart-db.sql         → Tạo cart_db
```

### DynamoDB (ProductService, RecommendationService)

- Tables created **on-demand** qua AWS SDK hoặc manual configuration
- Table names qua environment variables: `TABLE_NAME`, `CATEGORY_TABLE_NAME`, `VARIANT_TABLE_NAME`
- **Không có migration scripts** — schema changes handled by application code (thêm attributes mới vào items)

### Rủi ro của cách tiếp cận hiện tại

| Rủi ro | Mô tả |
|---|---|
| **No version control** | Không biết schema version nào đang chạy |
| **No rollback** | Không thể revert schema change nếu có vấn đề |
| **Schema drift** | Schema có thể khác nhau giữa environments (dev, staging, prod) |
| **Destructive changes** | `update` không handle column rename hoặc type change tốt |
| **No migration testing** | Không thể test migration script trước khi deploy |

### Khuyến nghị

Cho production, nên chuyển sang **Flyway** hoặc **Liquibase**:
- Versioned migration scripts (`V1__init.sql`, `V2__add_indexes.sql`, ...)
- Rollback capability
- Schema consistency across environments
- Migration testing trong CI/CD pipeline

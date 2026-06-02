# Báo Cáo Kiến Trúc Hệ Thống — D4C ClothingShop

**Ngày:** 2026-06-01  
**Branch:** `fix/fix-remain-concerns`

---

## a) Loại kiến trúc

**Microservices Architecture** với API Gateway, Service Discovery, và Event-Driven Communication.

### Thành phần chính

| Tầng | Thành phần | Công nghệ |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind | Port 5173 |
| **API Gateway** | Spring Cloud Gateway (WebFlux) | Port 8080 |
| **Service Discovery** | Spring Boot + Eureka Server | Port 8761 |
| **Business Services (Java)** | UserService, OrderService, PaymentService, CartService, NotificationService | Spring Boot 3.x, Java 21 |
| **Business Services (Node.js)** | ProductService, RecommendationService, AIService, SearchService | Express.js, Node 20 |
| **Message Broker** | RabbitMQ | Port 5672 (AMQP), 15672 (mgmt UI) |
| **Relational DB** | MariaDB | Port 3308→3306 |
| **Cache** | Redis | Port 6379 |
| **NoSQL** | AWS DynamoDB | Cloud (Products, Variants, Categories, Recommendations) |
| **Search Engine** | Typesense | Port 8108 |
| **Object Storage** | AWS S3 | Cloud (Avatars, Product images) |
| **Audit Log** | Elasticsearch + Kibana | Port 9200, 5601 |

### Mô hình giao tiếp

- **Đồng bộ ( synchronous )**: REST/Feign giữa các service (OrderService → ProductService, PaymentService → OrderService, CartService → ProductService)
- **Bất đồng bộ ( asynchronous )**: RabbitMQ event-driven (Payment confirmed → Order status update, Order created → Email notification, Product CRUD → Search index sync)
- **Hybrid**: Transactional Outbox pattern đảm bảo sự kiện được publish sau khi DB commit thành công

---

## b) Lý do lựa chọn

### Tại sao chọn Microservices?

1. **Đa dạng workload**: Hệ thống có các yêu cầu khác biệt rõ rệt — user management (relational, ACID), product catalog (read-heavy, scalable), real-time search (full-text), async notifications (message queue). Microservices cho phép chọn công nghệ phù hợp cho từng domain.

2. **Độc lập triển khai**: Mỗi service có thể build, deploy, scale độc lập. Ví dụ: ProductService (Node.js + DynamoDB) có thể scale riêng khi traffic sản phẩm tăng, trong khi OrderService (Java + MariaDB) giữ nguyên.

3. **Fault isolation**: Khi ProductService gặp sự cố, Circuit Breaker trong OrderService/CartService ngăn lỗi lan truyền. CartService vẫn hoạt động được (cache Redis), chỉ stock validation bị ảnh hưởng.

4. **Team ownership**: Kiến trúc cho phép nhiều team làm việc song song trên các service khác nhau mà không xung đột codebase.

### Tại sao API Gateway + Eureka?

- **API Gateway** là single entry point cho client, xử lý JWT validation, rate limiting, CORS, retry, routing — giúp backend services tập trung vào business logic.
- **Eureka** cho phép service discovery động — services tự đăng ký khi khởi động, Gateway tự động resolve URL qua `lb://SERVICE_NAME`, không cần hardcode endpoint.

### Tại sao đa database (Polyglot Persistence)?

| Database | Lý do chọn |
|---|---|
| **MariaDB** | ACID transactions cho user, order, payment, cart — dữ liệu quan trọng cần consistency |
| **DynamoDB** | Product catalog read-heavy (>90% reads), cần throughput cao, schema linh hoạt cho variants |
| **Redis** | Sub-millisecond cart reads, idempotency keys, rate limiting |
| **Typesense** | Full-text search với typo tolerance, đơn giản hơn Elasticsearch cho use case product search |
| **Elasticsearch** | Audit log storage, full-text search trên request logs |

---

## c) Thuộc tính chất lượng

### Availability (Sẵn sàng) — Mức: Trung bình

| Cơ chế | Triển khai |
|---|---|
| **Circuit Breaker** | Resilience4j (Java) + Opossum (Node.js) — 50% failure threshold, 30s recovery |
| **Retry** | 3 attempts với fixed 1s wait (Java), exponential backoff 200→400→800ms (Gateway) |
| **Outbox Pattern** | OrderService + PaymentService — sự kiện không bị mất khi RabbitMQ down |
| **Health Checks** | Tất cả containers có health check trong docker-compose.yml |

**Điểm yếu**: Không có circuit breaker ở Gateway level, không có graceful degradation (tất cả fallbacks đều throw exception), single instance cho mọi service.

### Scalability (Mở rộng) — Mức: Trung bình

| Khả năng | Trạng thái |
|---|---|
| **Horizontal scaling** | Services stateless, có thể scale qua `deploy.replicas` (chưa cấu hình) |
| **Database scaling** | MariaDB single instance — chỉ scale dọc. DynamoDB tự động scale ngang |
| **Cache scaling** | Redis single instance — chưa có Sentinel/Cluster |
| **Message queue scaling** | RabbitMQ single-node — chưa có cluster |

**Điểm nghẽn**: DynamoDB Scan operations trong ProductService — mỗi request đọc toàn bộ bảng, không scale được với dữ liệu lớn.

### Security (Bảo mật) — Mức: Thấp (3/10)

| Cơ chế | Trạng thái |
|---|---|
| **Authentication** | JWT (RS256) qua API Gateway — tốt |
| **Authorization** | GatewayIdentityFilter — nhưng chỉ check header presence, dễ spoof |
| **HTTPS** | Không có — tất cả traffic HTTP plaintext |
| **Secrets** | Hardcoded trong `.env` (AWS keys, Gmail password, DB passwords) |
| **Rate Limiting** | Redis-based, 100 req/min — nhưng fails open khi Redis down |

### Maintainability (Bảo trì) — Mức: Khá tốt

| Yếu tố | Đánh giá |
|---|---|
| **Code organization** | Nhất quán: controller → service → repository (Java), controllers → services → models (Node.js) |
| **Dependency Injection** | Constructor injection (Java), ES module singletons (Node.js) |
| **Testing** | JUnit 5 cho Java services (38/39 tests pass), Vitest cho ProductService |
| **Documentation** | OpenAPI/Swagger cho Java services, Swagger cho Node.js services |
| **Logging** | SLF4J (Java), console.log (Node.js), audit logs → Elasticsearch |

---

## d) Quản lý phụ thuộc

### Dependency Injection

**Java Services — Spring DI (Constructor Injection)**

Tất cả Java services sử dụng constructor injection (Spring-recommended):

```java
// OrderService.java
public OrderService(OrderRepository orderRepository, AuditService auditService,
        ProductClient productClient, OrderEventPublisher orderEventPublisher) {
    this.orderRepository = orderRepository;
    this.auditService = auditService;
    this.productClient = productClient;
    this.orderEventPublisher = orderEventPublisher;
}
```

Annotations: `@Service`, `@Component`, `@Configuration`, `@Bean`, `@Repository` (Spring Data JPA interfaces).

**Node.js Services — ES Module Singletons**

```javascript
// product.service.js
export const productService = new ProductService();
// stock.service.js
export const stockService = new StockService();
```

Dependencies resolved qua static `import` — không có DI container formal.

### Loosely Coupled qua Event-Driven Pattern

Các services giao tiếp qua RabbitMQ với **Transactional Outbox Pattern**:

1. Business operation + outbox event saved trong cùng `@Transactional`
2. Transaction commit thành công
3. `OutboxPublisherJob` poll pending events mỗi 5 giây (ShedLock distributed locking)
4. Publish event → RabbitMQ → consumers xử lý bất đồng bộ

**Lợi ích**: Services không cần biết nhau trực tiếp. OrderService publish `ORDER_CREATED` event, NotificationService consume để gửi email — nếu NotificationService down, event nằm trong outbox và được retry sau.

### Inter-Service Communication

| Loại | Công nghệ | Ví dụ |
|---|---|---|
| **Synchronous** | Feign Client (Java), Axios (Node.js) | OrderService → ProductService (stock deduction) |
| **Asynchronous** | RabbitMQ (TopicExchange) | PaymentService → OrderService (payment confirmed) |
| **Service Discovery** | Eureka Server | Gateway resolve `lb://ORDERSERVICE` → actual URL |

---

## e) Tính nhất quán dữ liệu

### ACID Transactions (Strong Consistency)

Các thao tác quan trọng sử dụng `@Transactional` trong MariaDB:

| Service | Operation | Đảm bảo |
|---|---|---|
| **OrderService** | `createOrderFromCheckout` | Order + OrderItems saved atomically |
| **OrderService** | `updateOrderStatus` | Status update + audit log + stock restore (nếu cancel) |
| **PaymentService** | `markAsPaid` | Payment status + event publish (optimistic locking) |
| **CartService** | `addItem`, `updateItemQuantity`, `clearCart` | Cart + CartItem consistency |

### Eventual Consistency (Nhất quán sau một khoảng thời gian)

| Kịch bản | Cơ chế | Độ trễ |
|---|---|---|
| Order created → Email notification | Outbox → RabbitMQ → NotificationService | ≤ 5 giây (outbox polling) |
| Payment confirmed → Order status update | RabbitMQ → OrderService consumer | Near real-time |
| Product CRUD → Search index sync | RabbitMQ → SearchService → Typesense | Near real-time |
| Order paid → Cart cleared | RabbitMQ → CartService consumer | Near real-time |

### Distributed Transaction — Saga Pattern

Checkout flow sử dụng **Choreography-based Saga** với compensating actions:

```
1. Deduct stock (ProductService via Feign)
   ↓ Nếu fail → BadRequestException, không tạo order
2. Save order (MariaDB @Transactional)
   ↓ Nếu fail → Compensating: restoreStockForOrder()
      ↓ Nếu compensation fail → Publish StockRestoreFailedEvent (outbox retry)
3. Publish ORDER_CREATED event (after commit)
```

### DynamoDB Transactions (ProductService)

Stock deduction sử dụng `TransactWriteCommand` với `ConditionExpression`:
```javascript
ConditionExpression: "attribute_exists(id) AND quantity >= :qty"
```
Atomic check-and-decrement —防止 overselling.

### Idempotency

| Operation | Cơ chế |
|---|---|
| Stock deduction | Redis idempotency key (`idempotency:${key}`, TTL 1h) |
| Order creation | Unique constraint trên `checkoutOrderId` |
| Payment webhook | `WebhookLog` table prevents duplicate processing by `transactionId` |
| Outbox events | `event_id` (UUID unique) prevents duplicate publishing |

---

## f) Luồng đi của Request

### Ví dụ: User đặt hàng (Checkout → Payment)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (React)                                                  │
│    - User nhấn "Đặt hàng" trên CheckoutPage                          │
│    - Axios interceptor gắn Bearer token từ Zustand store             │
│    - POST http://localhost:8080/api/orders/checkout                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. API GATEWAY (Spring Cloud Gateway, port 8080)                     │
│    ┌───────────────────────────────────────────────────────────┐    │
│    │ RateLimiterFilter (order=-2): Check Redis rate limit       │    │
│    │ JwtValidationFilter (order=-1):                            │    │
│    │   - Fetch JWKS từ UserService /.well-known/jwks.json       │    │
│    │   - Verify JWT signature (RS256)                           │    │
│    │   - Extract: userId, username, email, roles                │    │
│    │   - Inject headers: X-User-Id, X-User-Username, ...        │    │
│    │ AdminRoleFilter (order=0): Check ADMIN role cho /api/admin │    │
│    │ AuditLoggingFilter (order=1): Log to Elasticsearch         │    │
│    └───────────────────────────────────────────────────────────┘    │
│    Route: /api/orders/** → lb://ORDERSERVICE (Eureka lookup)        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ORDERSERVICE (Spring Boot, port 8085)                             │
│    ┌───────────────────────────────────────────────────────────┐    │
│    │ GatewayIdentityFilter: Validate X-User-Id header exists    │    │
│    │ SecurityConfig: .anyRequest().permitAll()                  │    │
│    └───────────────────────────────────────────────────────────┘    │
│                                                                      │
│    OrderService.createOrderFromCheckout(@Transactional):             │
│    a. Check duplicate order (idempotency via checkoutOrderId)        │
│    b. Validate total amount                                          │
│    c. ProductClient.batchDeductStock() ← Feign call (CircuitBreaker) │
│       → ORDERSERVICE → PRODUCTSERVICE (HTTP POST)                    │
│    d. Save Order + OrderItems → MariaDB                              │
│    e. Register TransactionSynchronization.afterCommit()              │
│       → publish ORDER_CREATED event                                  │
│    f. Return OrderResponse                                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
┌──────────────────────┐    ┌────────────────────────────────────────┐
│ 4a. PRODUCTSERVICE   │    │ 4b. After DB commit                    │
│     (Node.js, 8082)  │    │     OrderEventPublisher:               │
│                      │    │     - Save to outbox_events table      │
│  TransactWriteCmd:   │    │     - OutboxPublisherJob polls (5s)    │
│  - Check quantity    │    │     - Publish to RabbitMQ              │
│  - Decrement stock   │    │       → email.exchange                 │
│  - Atomic operation  │    │       → order.exchange                 │
│  DynamoDB            │    └───────────────┬────────────────────────┘
└──────────────────────┘                    │
                                            ▼
                          ┌─────────────────────────────────────────┐
                          │ 5. RABBITMQ                               │
                          │    Exchanges:                             │
                          │    - email.exchange → NotificationService │
                          │    - order.exchange → ProductService      │
                          │      (stock restore), CartService         │
                          └───────────────┬───────────────────────────┘
                                          │
                               ┌──────────┴──────────┐
                               ▼                     ▼
              ┌────────────────────────┐  ┌────────────────────────┐
              │ 6a. NOTIFICATION SVC   │  │ 6b. PRODUCTSERVICE     │
              │     (Java, 8083)       │  │     (consumer)         │
              │                        │  │                        │
              │ @RabbitListener:       │  │ order.cancelled queue: │
              │ - email.order.created  │  │ - Restore stock        │
              │ - Send email via SMTP  │  │ - DynamoDB TransactWrite│
              └────────────────────────┘  └────────────────────────┘
```

### Response flow

```
OrderService → API Gateway → Frontend (OrderResponse JSON)
     ↓
Frontend hiển thị "Đặt hàng thành công"
     ↓
Frontend gọi POST /api/payments → PaymentService → SePay API
     ↓
User thanh toán trên SePay portal
     ↓
SePay webhook → PaymentService → markAsPaid(@Transactional)
     ↓
PaymentService publish PAYMENT_CONFIRMED → RabbitMQ
     ↓
OrderService consume → update order status → PAID
CartService consume → clear cart
NotificationService consume → send payment confirmation email
```

---

## g) Giải pháp bộ nhớ đệm

### Tại sao sử dụng Redis?

1. **CartService — Cache-Aside Pattern**: Cart data được đọc thường xuyên nhưng thay đổi không liên tục. Redis cung cấp sub-millisecond reads, giảm tải cho MariaDB.

2. **ProductService — Idempotency Keys**: Stock deduction cần idempotency để tránh duplicate khi client retry. Redis là lựa chọn tối ưu cho key-value với TTL.

3. **API Gateway — Rate Limiting**: Redis sorted set đếm requests per IP trong sliding window.

### Chiến lược lưu cache

| Service | Key Pattern | TTL | Dữ liệu |
|---|---|---|---|
| **CartService** | `cart:{userId}` | 30 phút | Full CartResponse (items, totals) |
| **ProductService** | `idempotency:{key}` | 1 giờ | Kết quả stock deduction |
| **Api-Gateway** | `ratelimit:{ip}` | 60 giây | Request timestamps (sorted set) |
| **JwksCache** | In-memory `AtomicReference` | Manual refresh | RSA public key |

### Chiến lược xóa cache (Invalidation)

**CartService — Cache-Aside với Write-Through Invalidation**:

```
Read:  Redis hit → return immediately
       Redis miss → load from MariaDB → cache → return

Write: invalidateCache(userId) → redisTemplate.delete("cart:" + userId)
       → next read will be cache miss → load fresh data
```

Invalidation được gọi sau MỌI write operation:
- `addItem()` → invalidate
- `updateItemQuantity()` → invalidate
- `removeItem()` → invalidate
- `clearCart()` → invalidate
- `removeItemsBulk()` → invalidate

### Điểm yếu

- **Không có product catalog caching**: ProductService đọc trực tiếp từ DynamoDB cho MỌI request. Với e-commerce (>90% reads), đây là gap lớn nhất.
- **JwksCache không có TTL-based refresh**: Key cache vô thời hạn, chỉ refresh khi gọi `refresh()` thủ công hoặc restart.
- **Không có local caching** (Caffeine/Guava) cho dữ liệu ít thay đổi (categories, product details).

---

## h) Đánh đổi kiến trúc

### Bottlenecks (Điểm nghẽn)

| Điểm nghẽn | Mức độ | Mô tả |
|---|---|---|
| **DynamoDB Scan** | CRITICAL | ProductService dùng Scan cho mọi read operation — đọc toàn bộ bảng, tiêu thụ RCU khổng lồ, không scale được |
| **Stock deduction trong @Transactional** | CRITICAL | HTTP call đến ProductService giữ DB lock — timeout 5s × concurrent requests = connection pool exhaustion |
| **HikariCP default (10 connections)** | HIGH | 5 Java services × 10 = 50 max DB connections cho 1 MariaDB — flash sale sẽ exhaust ngay |
| **Cart validateCart N+1** | HIGH | 10 items = 10 sequential HTTP calls đến ProductService |
| **Gateway retry amplification** | HIGH | 3 retries per failed GET — service degradation bị khuếch đại 3× |
| **Single instance mọi thành phần** | HIGH | MariaDB, Redis, RabbitMQ, Eureka, Gateway — tất cả single point of failure |
| **RabbitMQ single consumer/queue** | MEDIUM | Email processing sequential — 1000 order confirmations = minutes to process |
| **No product caching** | MEDIUM | 90%+ traffic là reads, tất cả hit DynamoDB trực tiếp |

### Trade-offs (Sự đánh đổi)

| Trade-off | Mặt lợi | Mặt hại |
|---|---|---|
| **Microservices vs Monolith** | Độc lập deploy, fault isolation, tech diversity | Network overhead, distributed complexity, harder debugging |
| **Synchronous stock deduction** | Consistency — không tạo order nếu hết hàng | Tight coupling, latency, cascade failure risk |
| **Async event notification** | Decoupled, resilient, retryable | Eventual consistency — email có thể trễ vài giây |
| **DynamoDB cho products** | Auto-scaling, high read throughput | No SQL joins, Scan operations expensive, vendor lock-in |
| **MariaDB shared instance** | Đơn giản, dễ setup | SPOF, resource contention giữa services |
| **Hibernate auto-DDL** | Không cần migration scripts | No version control, no rollback, schema drift risk |
| **No HTTPS** | Đơn giản cho development | Tất cả data (JWT, password, payment) truyền plaintext |
| **Outbox feature flag** | Linh hoạt bật/tắt | Nếu tắt nhầm → fire-and-forget, mất event |
| **GatewayIdentityFilter (header-only)** | Đơn giản, lightweight | Dễ spoof — không có shared secret verification |

### Estimated Breaking Point

- **~50-100 concurrent checkout attempts** trước khi checkout flow collapse
- **~200 concurrent product listing requests** trước khi DynamoDB throttling
- **Redis down** → rate limiting fails open, cart cache miss, toàn bộ hệ thống vẫn hoạt động nhưng chậm hơn

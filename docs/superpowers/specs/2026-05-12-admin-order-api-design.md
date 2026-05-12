# Admin Order Management API — Design Spec

**Date**: 2026-05-12
**Scope**: OrderService (Spring Boot 3) + Frontend (React)
**Approach**: Extend OrderService with admin endpoints (follow UserService `AdminUserController` pattern)

---

## 1. API Endpoints

Base path: `/api/admin/orders` (requires `ADMIN` authority)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/orders` | List all orders with filters, sort, pagination |
| `GET` | `/api/admin/orders/{id}` | Get single order with items |
| `PATCH` | `/api/admin/orders/{id}/status` | Update order status + write audit log |
| `GET` | `/api/admin/orders/{id}/audit` | Get audit history for an order |
| `GET` | `/api/admin/orders/export` | Export filtered orders as CSV |
| `GET` | `/api/admin/orders/stats` | Dashboard statistics |

### GET /api/admin/orders — Query Parameters

```
status       String   Comma-separated: PENDING_PAYMENT,PAID,CANCELLED
startDate    String   ISO date (createdAt >=)
endDate      String   ISO date (createdAt <=)
search       String   Match against orderId (checkoutOrderId) or userId
username     String   Filter by username (optional, requires lookup)
sortBy       String   createdAt | totalAmount | status  (default: createdAt)
sortDir      String   asc | desc  (default: desc)
page         Integer  Zero-based (default: 0)
size         Integer  (default: 20)
```

### PATCH /api/admin/orders/{id}/status — Request Body

```json
{
  "status": "CANCELLED",
  "reason": "Customer requested cancellation"
}
```

### GET /api/admin/orders/{id}/audit — Response

```json
{
  "orderId": 1,
  "auditEntries": [
    {
      "id": 1,
      "adminId": 2,
      "adminUsername": "admin",
      "oldStatus": "PAID",
      "newStatus": "CANCELLED",
      "reason": "Customer requested cancellation",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-05-12T10:30:00Z"
    }
  ]
}
```

### GET /api/admin/orders/export

Same query params as list endpoint. Returns `Content-Type: text/csv` with columns:
orderId, userId, status, totalAmount, itemCount, createdAt, updatedAt

### GET /api/admin/orders/stats — Response

```json
{
  "totalOrders": 150,
  "totalRevenue": 125000000,
  "byStatus": {
    "PENDING_PAYMENT": 10,
    "PAID": 120,
    "CANCELLED": 20
  },
  "dailyStats": [
    { "date": "2026-05-12", "orderCount": 5, "revenue": 4200000 }
  ]
}
```
Daily stats default to last 7 days. Accept optional query param `?days=30`.

---

## 2. Data Model Changes

### 2.1 AuditLog Entity (new table `audit_logs`)

```java
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "admin_id", nullable = false)
    private Long adminId;

    @Column(name = "admin_username", nullable = false, length = 100)
    private String adminUsername;

    @Column(name = "old_status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private OrderStatus oldStatus;

    @Column(name = "new_status", nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private OrderStatus newStatus;

    @Column(length = 500)
    private String reason;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
```

### 2.2 Order Entity — add relationship

```java
// Add to Order.java:
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
@OrderBy("createdAt ASC")
private List<AuditLog> auditLogs = new ArrayList<>();
```

No other changes to `Order` or `OrderItem`.

---

## 3. Status Transition Rules

Enforced in `AdminOrderService.updateOrderStatus()`:

| From \ To | PENDING_PAYMENT | PAID | CANCELLED |
|-----------|:---:|:---:|:---:|
| PENDING_PAYMENT | — | ✅ | ✅ |
| PAID | ❌ | — | ✅ |
| CANCELLED | ❌ | ❌ | ❌ (terminal) |

Invalid transitions return `400 Bad Request` with message like: "Cannot transition from PAID to PENDING_PAYMENT".

---

## 4. RBAC / Security

### OrderService SecurityConfig changes

```java
// In SecurityConfig.java, update authorizeHttpRequests:
auth
    .requestMatchers("/api/admin/**").hasAuthority("ADMIN")
    .anyRequest().authenticated();
```

### JWT role extraction

Currently OrderService's `JwtAuthenticationFilter` uses `AuthorityUtils.NO_AUTHORITIES`. Must be updated to extract roles from JWT claims and create `SimpleGrantedAuthority` instances, so `hasAuthority("ADMIN")` works.

The JWT already includes a `role` claim (set by UserService). The filter needs to parse it.

---

## 5. Filtering Implementation

Use Spring Data JPA `Specification` for dynamic query building:

```java
public class OrderSpecification {
    public static Specification<Order> hasStatuses(List<OrderStatus> statuses) { ... }
    public static Specification<Order> createdBetween(Instant start, Instant end) { ... }
    public static Specification<Order> searchByTerm(String term) { ... } // checkoutOrderId LIKE or userId =
    public static Specification<Order> byUsername(String username) { ... } // subquery if user data stored locally
}
```

These specifications combine via `Specification.where().and()`. The repository extends `JpaSpecificationExecutor<Order>`.

**Note**: `username` filter requires user data. Two options:
- **(Chosen)** Store `username` and `email` denormalized in `orders` table (added columns). Populated at order creation from JWT claims. No cross-service call needed for filtering.
- Alternative: Call UserService API — adds latency and coupling.

Add columns to `orders` table:
```java
@Column(name = "user_username", length = 100)
private String userUsername;

@Column(name = "user_email", length = 255)
private String userEmail;
```

---

## 6. CSV Export

- Accepts same filter params as list endpoint
- Returns `text/csv` with `Content-Disposition: attachment; filename="orders-2026-05-12.csv"`
- Uses `SuperCsv` or manual `PrintWriter` writing
- Columns: Order ID, User ID, Username, Status, Total Amount, Item Count, Created At, Updated At

---

## 7. Frontend

### 7.1 Route & Layout

- Route: `/admin/orders` → protected by AdminLayout's existing role guard
- Sidebar: add "Orders" link with `Package` icon in AdminLayout.tsx

### 7.2 Pages & Components

**AdminOrders.tsx** (main page):
- `StatsCards` — 4 stat cards at top (from stats API)
- `FilterBar` — status multi-select, date range, search input, export button
- `OrdersTable` — sortable columns, pagination, status badges, action buttons

**StatusUpdateDialog.tsx**:
- Dropdown: shows only valid target statuses based on current status
- Textarea for reason (required)
- Confirm/cancel buttons

**AuditLogSheet.tsx** (slide-in panel):
- Timeline-style list of status changes
- Shows admin username, old→new, reason, timestamp, IP, user agent

### 7.3 Data Layer

New files:
- `frontend/src/services/adminOrderApi.ts`
- `frontend/src/hooks/useAdminOrders.ts`
- `frontend/src/hooks/useAdminOrderStats.ts`

Use project's existing axios instance (`_axios.ts`) with automatic token injection.

---

## 8. Implementation Order

1. **OrderService data layer**: AuditLog entity, Order denormalized fields, repository
2. **OrderService security**: JWT filter role extraction, SecurityConfig RBAC
3. **OrderService admin endpoints**: AdminOrderController, AdminOrderService, Specification
4. **OrderService CSV & stats**: Export and statistics endpoints
5. **Frontend API layer**: adminOrderApi.ts, hooks
6. **Frontend UI**: AdminOrders page, dialogs, sidebar link
7. **Integration test**: Manual verification flow

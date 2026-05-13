# Replace Manual Getters/Setters with Lombok — CartService & OrderService

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all manually written getters, setters, constructors, and builder classes in the `domain/` packages of CartService and OrderService with Lombok annotations (`@Data`, `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder`).

**Architecture:** Each domain class (entity or DTO) currently has hand-written accessors and sometimes hand-written builder inner classes. We replace these with equivalent Lombok annotations, preserving all existing behavior. Entities use `@NoArgsConstructor` + `@Setter` + `@Getter` (not `@Data` because JPA entities need a no-arg constructor and mutable setters). DTOs use `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`.

**Tech Stack:** Java 21, Spring Boot 3.3.1, Lombok, Maven

---

## Annotation Strategy

| Class type | Annotations | Reason |
|---|---|---|
| **JPA Entity** | `@Getter` `@Setter` `@NoArgsConstructor` | JPA requires no-arg constructor; setters needed for ORM |
| **DTO (simple)** | `@Data` `@Builder` `@NoArgsConstructor` `@AllArgsConstructor` | Immutable-friendly, builder pattern for construction |
| **DTO with inner classes** | Same on outer + each inner | Each class gets its own annotations |
| **Entity with custom methods** | `@Getter` `@Setter` `@NoArgsConstructor` | Keep custom methods (e.g. `prePersist`, `addItem`) untouched |

### Files to modify

**CartService** (10 files, 15 classes):
1. `CartService/src/main/java/iuh/fit/CartService/domain/entity/Cart.java`
2. `CartService/src/main/java/iuh/fit/CartService/domain/entity/CartItem.java`
3. `CartService/src/main/java/iuh/fit/CartService/domain/dto/AddCartItemRequest.java`
4. `CartService/src/main/java/iuh/fit/CartService/domain/dto/CartResponse.java` (outer + CartItemDto inner)
5. `CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutResponse.java` (outer + CheckoutItem + Snapshot)
6. `CartService/src/main/java/iuh/fit/CartService/domain/dto/DeductStockRequest.java`
7. `CartService/src/main/java/iuh/fit/CartService/domain/dto/ProductDto.java`
8. `CartService/src/main/java/iuh/fit/CartService/domain/dto/UpdateCartItemRequest.java`
9. `CartService/src/main/java/iuh/fit/CartService/domain/dto/ValidationResponse.java` (outer + ValidationError inner)
10. `CartService/src/main/java/iuh/fit/CartService/domain/dto/VariantDto.java`

**OrderService** (8 files, 11 classes):
1. `OrderService/src/main/java/com/iuh/fit/domain/entity/AuditLog.java`
2. `OrderService/src/main/java/com/iuh/fit/domain/entity/Order.java`
3. `OrderService/src/main/java/com/iuh/fit/domain/entity/OrderItem.java`
4. `OrderService/src/main/java/com/iuh/fit/domain/dto/AuditLogResponse.java`
5. `OrderService/src/main/java/com/iuh/fit/domain/dto/CreateOrderFromCheckoutRequest.java` (outer + CheckoutItemDto + SnapshotDto)
6. `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderResponse.java` (outer + OrderItemResponse inner)
7. `OrderService/src/main/java/com/iuh/fit/domain/dto/PagedResponse.java`
8. `OrderService/src/main/java/com/iuh/fit/domain/dto/UpdateOrderStatusRequest.java`

---

### Task 1: CartService Entities — Cart.java & CartItem.java

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/entity/Cart.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/entity/CartItem.java`

- [ ] **Step 1.1: Rewrite Cart.java with Lombok**

Replace entire file content with:

```java
package iuh.fit.CartService.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "carts")
@Getter
@Setter
@NoArgsConstructor
@Builder
@AllArgsConstructor
public class Cart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", unique = true, nullable = false)
    private Long userId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

Remove: all manual getters, setters, both constructors, `CartBuilder` inner class.

- [ ] **Step 1.2: Rewrite CartItem.java with Lombok**

Replace entire file content with:

```java
package iuh.fit.CartService.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "cart_items", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"cart_id", "variant_id"})
})
@Getter
@Setter
@NoArgsConstructor
@Builder
@AllArgsConstructor
public class CartItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    @Column(name = "variant_id", nullable = false, length = 36)
    private String variantId;

    @Column(name = "product_id", nullable = false, length = 36)
    private String productId;

    @Column(name = "product_name", nullable = false)
    private String productName;

    @Column(nullable = false, length = 50)
    private String color;

    @Column(nullable = false, length = 20)
    private String size;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer quantity;

    @Column(length = 100)
    private String sku;

    @Column(name = "image_url")
    private String imageUrl;

    public BigDecimal getSubtotal() {
        return price.multiply(BigDecimal.valueOf(quantity));
    }
}
```

Remove: all manual getters, setters, both constructors, `CartItemBuilder` inner class. Keep `getSubtotal()` as a custom method.

- [ ] **Step 1.3: Verify CartService compiles**

Run: `cd CartService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 2: CartService DTOs — Simple DTOs (4 files)

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/AddCartItemRequest.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/DeductStockRequest.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/UpdateCartItemRequest.java`
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/VariantDto.java`

- [ ] **Step 2.1: Rewrite AddCartItemRequest.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddCartItemRequest {
    private String productId;
    private String variantId;
    private Integer quantity;
}
```

- [ ] **Step 2.2: Rewrite DeductStockRequest.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeductStockRequest {
    private Integer quantity;
}
```

- [ ] **Step 2.3: Rewrite UpdateCartItemRequest.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCartItemRequest {
    private Integer quantity;
}
```

- [ ] **Step 2.4: Rewrite VariantDto.java**

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VariantDto {
    private String id;
    private String productId;
    private String color;
    private String size;
    private Integer quantity;
    private String sku;
}
```

- [ ] **Step 2.5: Verify CartService compiles**

Run: `cd CartService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 3: CartService DTOs — ProductDto.java

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/ProductDto.java`

- [ ] **Step 3.1: Rewrite ProductDto.java**

Read the current file to confirm all fields, then replace with:

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {
    private String id;
    private String name;
    private String description;
    private BigDecimal price;
    private String categoryId;
    private String gender;
    private String brand;
    private List<String> tags;
    private boolean featured;
    private String imageUrl;
    private String status;
    private List<VariantDto> variants;
}
```

- [ ] **Step 3.2: Verify CartService compiles**

Run: `cd CartService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 4: CartService DTOs — CartResponse.java (outer + inner CartItemDto)

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/CartResponse.java`

- [ ] **Step 4.1: Rewrite CartResponse.java**

Replace entire file. Remove both manual builder inner classes. Apply `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor` to both outer and inner class.

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartResponse {
    private Long cartId;
    private Long userId;
    private List<CartItemDto> items;
    private BigDecimal totalAmount;
    private Integer totalItems;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CartItemDto {
        private Long id;
        private String variantId;
        private String productId;
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        private Integer quantity;
        private BigDecimal subtotal;
        private String sku;
        private String imageUrl;
    }
}
```

- [ ] **Step 4.2: Verify CartService compiles**

Run: `cd CartService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 5: CartService DTOs — CheckoutResponse.java (outer + CheckoutItem + Snapshot)

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/CheckoutResponse.java`

- [ ] **Step 5.1: Rewrite CheckoutResponse.java**

Replace entire file. Remove all three manual builder inner classes.

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutResponse {
    private String orderId;
    private String status;
    private List<CheckoutItem> items;
    private BigDecimal totalAmount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckoutItem {
        private String variantId;
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        private Integer quantity;
        private Snapshot snapshot;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Snapshot {
        private BigDecimal priceAtCheckout;
        private String productName;
        private String variantSku;
    }
}
```

- [ ] **Step 5.2: Verify CartService compiles**

Run: `cd CartService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 6: CartService DTOs — ValidationResponse.java (outer + ValidationError)

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/domain/dto/ValidationResponse.java`

- [ ] **Step 6.1: Rewrite ValidationResponse.java**

Replace entire file. Remove both manual builder inner classes.

```java
package iuh.fit.CartService.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationResponse {
    private boolean valid;
    private List<ValidationError> errors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValidationError {
        private String variantId;
        private String reason;
        private String message;
    }
}
```

- [ ] **Step 6.2: Verify full CartService build**

Run: `cd CartService && mvn clean compile`
Expected: BUILD SUCCESS

---

### Task 7: OrderService Entities — Order.java, OrderItem.java, AuditLog.java

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/entity/Order.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/entity/OrderItem.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/entity/AuditLog.java`

- [ ] **Step 7.1: Rewrite Order.java with Lombok**

Replace entire file. Keep `prePersist()`, `preUpdate()`, `addItem()`, `clearItems()` custom methods.

```java
package com.iuh.fit.domain.entity;

import com.iuh.fit.domain.enums.OrderStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders", uniqueConstraints = {
        @UniqueConstraint(name = "uk_orders_user_checkout_order_id", columnNames = {"user_id", "checkout_order_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "checkout_order_id", nullable = false, length = 128)
    private String checkoutOrderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private OrderStatus status;

    @Column(name = "total_amount", precision = 19, scale = 2, nullable = false)
    private BigDecimal totalAmount;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void clearItems() {
        items.forEach(i -> i.setOrder(null));
        items.clear();
    }
}
```

- [ ] **Step 7.2: Rewrite OrderItem.java with Lombok**

```java
package com.iuh.fit.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "color", length = 64)
    private String color;

    @Column(name = "size", length = 64)
    private String size;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 19, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "line_total", precision = 19, scale = 2, nullable = false)
    private BigDecimal lineTotal;

    @Column(name = "snapshot_product_name", length = 255)
    private String snapshotProductName;

    @Column(name = "snapshot_variant_sku", length = 128)
    private String snapshotVariantSku;

    @Column(name = "snapshot_price_at_checkout", precision = 19, scale = 2)
    private BigDecimal snapshotPriceAtCheckout;
}
```

- [ ] **Step 7.3: Rewrite AuditLog.java with Lombok**

Read current file first to confirm all fields, then replace with:

```java
package com.iuh.fit.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "admin_user_id")
    private Long adminUserId;

    @Column(name = "previous_status", length = 32)
    private String previousStatus;

    @Column(name = "new_status", nullable = false, length = 32)
    private String newStatus;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
```

- [ ] **Step 7.4: Verify OrderService compiles**

Run: `cd OrderService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 8: OrderService DTOs — Simple DTOs (3 files)

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/dto/AuditLogResponse.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/dto/PagedResponse.java`
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/dto/UpdateOrderStatusRequest.java`

- [ ] **Step 8.1: Rewrite AuditLogResponse.java**

```java
package com.iuh.fit.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {
    private Long id;
    private Long orderId;
    private Long adminUserId;
    private String previousStatus;
    private String newStatus;
    private String note;
    private Instant createdAt;
}
```

- [ ] **Step 8.2: Rewrite PagedResponse.java**

```java
package com.iuh.fit.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PagedResponse<T> {
    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;
}
```

- [ ] **Step 8.3: Rewrite UpdateOrderStatusRequest.java**

```java
package com.iuh.fit.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateOrderStatusRequest {
    @NotBlank
    private String status;
    private String note;
}
```

- [ ] **Step 8.4: Verify OrderService compiles**

Run: `cd OrderService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 9: OrderService DTOs — OrderResponse.java (outer + OrderItemResponse)

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/dto/OrderResponse.java`

- [ ] **Step 9.1: Rewrite OrderResponse.java**

Replace entire file. Remove manual builder if present. Apply annotations to both outer and inner class.

```java
package com.iuh.fit.domain.dto;

import com.iuh.fit.domain.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private Long id;
    private String checkoutOrderId;
    private Long userId;
    private OrderStatus status;
    private BigDecimal totalAmount;
    private List<OrderItemResponse> items;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemResponse {
        private Long id;
        private String productName;
        private String color;
        private String size;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal lineTotal;
        private String snapshotProductName;
        private String snapshotVariantSku;
        private BigDecimal snapshotPriceAtCheckout;
    }
}
```

- [ ] **Step 9.2: Verify OrderService compiles**

Run: `cd OrderService && mvn compile`
Expected: BUILD SUCCESS

---

### Task 10: OrderService DTOs — CreateOrderFromCheckoutRequest.java (outer + CheckoutItemDto + SnapshotDto)

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/domain/dto/CreateOrderFromCheckoutRequest.java`

- [ ] **Step 10.1: Rewrite CreateOrderFromCheckoutRequest.java**

Replace entire file. Keep `@Valid` and `@NotBlank`/`@NotNull`/`@NotEmpty` validation annotations on fields. Apply `@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor` to all three classes.

```java
package com.iuh.fit.domain.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrderFromCheckoutRequest {

    @NotBlank
    private String orderId;

    @NotEmpty
    @Valid
    private List<CheckoutItemDto> items;

    @NotNull
    private BigDecimal totalAmount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckoutItemDto {
        @NotBlank
        private String productName;
        private String color;
        private String size;
        private BigDecimal price;
        @NotNull
        private Integer quantity;
        @NotNull
        @Valid
        private SnapshotDto snapshot;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SnapshotDto {
        @NotNull
        private BigDecimal priceAtCheckout;
        private String productName;
        private String variantSku;
    }
}
```

- [ ] **Step 10.2: Verify full OrderService build**

Run: `cd OrderService && mvn clean compile`
Expected: BUILD SUCCESS

---

### Task 11: Final verification — build both services

- [ ] **Step 11.1: Full clean build of CartService**

Run: `cd CartService && mvn clean compile`
Expected: BUILD SUCCESS, no Lombok-related errors

- [ ] **Step 11.2: Full clean build of OrderService**

Run: `cd OrderService && mvn clean compile`
Expected: BUILD SUCCESS, no Lombok-related errors

- [ ] **Step 11.3: Run tests if available**

Run: `cd CartService && mvn test`
Run: `cd OrderService && mvn test`
Expected: All tests pass (or skip if no tests exist)

---

## Self-Review

1. **Spec coverage:** All 18 domain files (10 CartService + 8 OrderService) are covered across Tasks 1-10. Each file's manual getters/setters/constructors/builders are replaced with Lombok annotations.

2. **Placeholder scan:** No TBD/TODO placeholders. All code blocks contain complete file contents.

3. **Type consistency:** All field names, types, and annotations match the original files. Validation annotations (`@NotBlank`, `@NotNull`, `@NotEmpty`, `@Valid`) are preserved on DTO fields. JPA annotations are preserved on entities. Custom methods (`getSubtotal`, `prePersist`, `preUpdate`, `addItem`, `clearItems`) are retained.

4. **Builder compatibility:** Classes that had manual builders (Cart, CartItem, CartResponse, CheckoutResponse, ValidationResponse) now use Lombok `@Builder`. Any code calling `.builder()` on these classes will continue to work since Lombok generates the same `builder()` static method pattern.

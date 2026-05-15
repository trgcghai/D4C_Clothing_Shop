# Refactor Internal Service Communication to Eureka-based Feign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all RestTemplate and hardcoded URL-based internal service calls with pure Eureka-resolved FeignClient interfaces across PaymentService, OrderService, and CartService.

**Architecture:** Three services will be refactored. PaymentService and OrderService get new OpenFeign dependencies + Feign interfaces replacing RestTemplate clients. CartService's existing Feign interface gets its `url` attribute removed. All service URL env vars are deleted. Eureka resolves targets by service name.

**Tech Stack:** Java 21, Spring Boot 3.3.1, Spring Cloud 2023.0.1, OpenFeign, Spring Cloud LoadBalancer, Eureka, Maven

---

### Task 1: PaymentService — Add OpenFeign dependencies

**Files:**
- Modify: `PaymentService/pom.xml`

- [ ] **Step 1: Add OpenFeign and LoadBalancer dependencies to pom.xml**

Insert these two dependencies after the `spring-cloud-starter-netflix-eureka-client` dependency block (around line 63):

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

The `spring-cloud-dependencies` BOM at version `2023.0.1` is already present, so no version override needed.

- [ ] **Step 2: Verify the build compiles**

Run: `cd PaymentService && ./mvnw compile -q`
Expected: BUILD SUCCESS, no errors

- [ ] **Step 3: Commit**

```bash
git add PaymentService/pom.xml
git commit -m "refactor: add OpenFeign and LoadBalancer dependencies to PaymentService"
```

---

### Task 2: PaymentService — Enable Feign and create OrderClient

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/PaymentServiceApplication.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/client/OrderClient.java`
- Create: `PaymentService/src/main/java/iuh/fit/PaymentService/client/dto/UpdateOrderStatusRequest.java`

- [ ] **Step 1: Add @EnableFeignClients to PaymentServiceApplication**

Replace the entire file content:

```java
package iuh.fit.PaymentService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class PaymentServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(PaymentServiceApplication.class, args);
	}
}
```

- [ ] **Step 2: Create the Feign client interface**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/client/OrderClient.java`:

```java
package iuh.fit.PaymentService.client;

import iuh.fit.PaymentService.client.dto.UpdateOrderStatusRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ORDERSERVICE")
public interface OrderClient {

    @PostMapping("/api/public/orders/{orderId}/status")
    void updateOrderStatus(
        @PathVariable("orderId") Long orderId,
        @RequestBody UpdateOrderStatusRequest request
    );

    @GetMapping("/api/public/orders/{orderId}/owner")
    Long getOrderUserId(@PathVariable("orderId") Long orderId);
}
```

Note: `name = "ORDERSERVICE"` matches `spring.application.name=ORDERSERVICE` in OrderService's `application.properties`.

- [ ] **Step 3: Create the DTO**

Create `PaymentService/src/main/java/iuh/fit/PaymentService/client/dto/UpdateOrderStatusRequest.java`:

```java
package iuh.fit.PaymentService.client.dto;

public record UpdateOrderStatusRequest(String status) {}
```

- [ ] **Step 4: Verify compilation**

Run: `cd PaymentService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/PaymentServiceApplication.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/client/
git commit -m "refactor: create OrderClient Feign interface for PaymentService"
```

---

### Task 3: PaymentService — Replace OrderServiceClient and delete RestTemplate

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java`
- Delete: `PaymentService/src/main/java/iuh/fit/PaymentService/service/OrderServiceClient.java`
- Delete: `PaymentService/src/main/java/iuh/fit/PaymentService/config/RestTemplateConfig.java`
- Modify: `PaymentService/src/main/resources/application.properties`

- [ ] **Step 1: Update WebhookService to use OrderClient**

Replace the `OrderServiceClient` injection and usage in `WebhookService.java`. The key changes:

1. Change import from `iuh.fit.PaymentService.service.OrderServiceClient` to `iuh.fit.PaymentService.client.OrderClient`
2. Change the field type and injection
3. Update the `updateOrderStatus` call to use the new DTO

Replace the entire file content:

```java
package iuh.fit.PaymentService.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.PaymentService.client.OrderClient;
import iuh.fit.PaymentService.client.dto.UpdateOrderStatusRequest;
import iuh.fit.PaymentService.config.SePayConfig;
import iuh.fit.PaymentService.domain.dto.SePayWebhookPayload;
import iuh.fit.PaymentService.domain.entity.WebhookLog;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.exception.PaymentException;
import iuh.fit.PaymentService.repository.WebhookLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

@Service
public class WebhookService {

    private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
    private static final DateTimeFormatter SEPAY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long MAX_TRANSACTION_AGE_HOURS = 24;

    @Autowired
    private WebhookLogRepository webhookLogRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private OrderClient orderClient;

    @Autowired
    private SePayConfig sePayConfig;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean verifyHmacSignature(String rawBody, String timestamp, String signature) {
        if (signature == null || signature.isBlank() || timestamp == null || timestamp.isBlank()) {
            log.warn("Missing signature or timestamp headers");
            return false;
        }

        String secret = sePayConfig.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            log.error("SEPAY_WEBHOOK_SECRET is not configured");
            return false;
        }

        try {
            String stringToSign = timestamp + "." + rawBody;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(keySpec);
            byte[] hash = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            String expected = "sha256=" + bytesToHex(hash);
            boolean valid = expected.equals(signature);
            if (!valid) {
                log.warn("HMAC mismatch - expected: {}, received: {}", expected, signature);
            }
            return valid;
        } catch (Exception e) {
            log.error("HMAC verification failed", e);
            return false;
        }
    }

    @Transactional(noRollbackFor = PaymentException.class)
    public boolean processWebhook(String rawBody) {
        SePayWebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, SePayWebhookPayload.class);
        } catch (Exception e) {
            log.error("Failed to parse webhook payload", e);
            throw new PaymentException("Invalid webhook payload");
        }

        log.info("Processing webhook - id: {}, code: {}, content: {}, amount: {}, transferType: {}",
                payload.getId(), payload.getCode(), payload.getContent(),
                payload.getTransferAmount(), payload.getTransferType());

        if (isReplayAttack(payload)) {
            log.warn("Replay attack detected - transaction too old: {}", payload.getTransactionDate());
            return true;
        }

        if (webhookLogRepository.findByTransactionId(payload.getId()).isPresent()) {
            log.info("Duplicate webhook, transaction already processed: {}", payload.getId());
            return true;
        }

        if (!validateContent(payload)) {
            log.warn("Content validation failed for webhook: {}", payload.getId());
            return true;
        }

        WebhookLog webhookLog = new WebhookLog();
        webhookLog.setTransactionId(payload.getId());
        webhookLog.setBody(rawBody);
        webhookLogRepository.save(webhookLog);

        if (!"in".equals(payload.getTransferType())) {
            log.info("Ignoring outgoing transaction: {}", payload.getId());
            return true;
        }

        String webhookCode = extractPaymentCode(payload);
        if (webhookCode == null || webhookCode.isBlank()) {
            log.warn("No payment code found in webhook: {}", payload.getId());
            return true;
        }

        String paymentCode = resolvePaymentCode(webhookCode, payload.getTransferAmount());
        if (paymentCode == null) {
            log.warn("No matching pending payment found for webhook code: {}", webhookCode);
            return true;
        }

        try {
            var statusResponse = paymentService.markAsPaid(paymentCode, payload.getId(), payload.getGateway());

            if (statusResponse.getStatus() == PaymentStatus.PAID) {
                log.info("Payment marked as PAID: {} (SePay tx: {})", paymentCode, payload.getId());

                var payment = paymentService.findPaymentByPaymentCodeOrNull(paymentCode);
                if (payment != null && payment.getCheckoutOrderId() != null) {
                    try {
                        orderClient.updateOrderStatus(payment.getOrderId(), new UpdateOrderStatusRequest("PAID"));
                        log.info("Order {} updated to PAID", payment.getOrderId());
                    } catch (Exception e) {
                        log.error("Failed to update order status for order {}: {}", payment.getOrderId(), e.getMessage());
                    }
                } else {
                    log.warn("Payment found but checkoutOrderId is null for code: {}", paymentCode);
                }
            }
        } catch (PaymentException e) {
            log.warn("Payment processing warning for code {}: {}", paymentCode, e.getMessage());
        }

        return true;
    }

    private boolean isReplayAttack(SePayWebhookPayload payload) {
        if (payload.getTransactionDate() == null || payload.getTransactionDate().isBlank()) {
            return false;
        }

        try {
            LocalDateTime transactionTime = LocalDateTime.parse(payload.getTransactionDate(), SEPAY_DATE_FORMAT);
            Instant transactionInstant = transactionTime.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
            long hoursAgo = ChronoUnit.HOURS.between(transactionInstant, Instant.now());

            if (hoursAgo > MAX_TRANSACTION_AGE_HOURS) {
                log.warn("Transaction is {} hours old (max: {})", hoursAgo, MAX_TRANSACTION_AGE_HOURS);
                return true;
            }
            return false;
        } catch (Exception e) {
            log.warn("Failed to parse transaction date: {}", payload.getTransactionDate());
            return false;
        }
    }

    private boolean validateContent(SePayWebhookPayload payload) {
        if (payload.getTransferAmount() == null || payload.getTransferAmount() <= 0) {
            log.warn("Invalid transfer amount: {}", payload.getTransferAmount());
            return false;
        }

        if (payload.getAccountNumber() != null && !payload.getAccountNumber().isBlank()) {
            String expectedAccount = sePayConfig.getBankAccount();
            if (expectedAccount != null && !expectedAccount.isBlank()
                    && !payload.getAccountNumber().equals(expectedAccount)) {
                log.warn("Account number mismatch - expected: {}, received: {}",
                        expectedAccount, payload.getAccountNumber());
                return false;
            }
        }

        return true;
    }

    private String extractPaymentCode(SePayWebhookPayload payload) {
        if (payload.getContent() != null && !payload.getContent().isBlank()) {
            String content = payload.getContent().trim();
            String[] parts = content.split("\\s+");
            if (parts.length > 0) {
                String candidate = parts[0];
                log.info("Extracted payment code from content: {}", candidate);
                return candidate;
            }
        }

        if (payload.getCode() != null && !payload.getCode().isBlank()) {
            log.info("Using payment code from code field: {}", payload.getCode());
            return payload.getCode();
        }

        return null;
    }

    private String resolvePaymentCode(String webhookCode, Long transferAmount) {
        String normalized = webhookCode.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();

        var payment = paymentService.findPaymentByPaymentCodeOrNull(normalized);
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            log.info("Matched payment by normalized code: {}", normalized);
            return payment.getPaymentCode();
        }

        payment = paymentService.findPaymentByPaymentCodeOrNull(webhookCode);
        if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
            log.info("Matched payment by exact code: {}", webhookCode);
            return payment.getPaymentCode();
        }

        if (transferAmount != null) {
            var pendingPayments = paymentService.getPendingPaymentsByAmount(transferAmount);
            for (var p : pendingPayments) {
                String storedNormalized = p.getPaymentCode().replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
                if (storedNormalized.equals(normalized) || storedNormalized.contains(normalized) || normalized.contains(storedNormalized)) {
                    log.info("Matched payment by amount+code fuzzy: {} (amount: {})", p.getPaymentCode(), transferAmount);
                    return p.getPaymentCode();
                }
            }
        }

        return null;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
```

Key changes from original:
- Import changed: `OrderServiceClient` → `OrderClient` + `UpdateOrderStatusRequest`
- Field changed: `OrderServiceClient orderServiceClient` → `OrderClient orderClient`
- Call changed: `orderServiceClient.updateOrderStatus(payment.getOrderId(), "PAID")` → `orderClient.updateOrderStatus(payment.getOrderId(), new UpdateOrderStatusRequest("PAID"))`

- [ ] **Step 2: Delete the old RestTemplate-based client**

Delete: `PaymentService/src/main/java/iuh/fit/PaymentService/service/OrderServiceClient.java`

- [ ] **Step 3: Delete the RestTemplate config**

Delete: `PaymentService/src/main/java/iuh/fit/PaymentService/config/RestTemplateConfig.java`

- [ ] **Step 4: Remove order.service.url from application.properties**

Remove this line from `PaymentService/src/main/resources/application.properties`:

```properties
# OrderService
order.service.url=${ORDER_SERVICE_URL}
```

The file should now end at the SePay section, followed directly by the Actuator section.

- [ ] **Step 5: Remove ORDER_SERVICE_URL from .env.example**

Remove these lines from `PaymentService/.env.example`:

```
# OrderService (internal call to update order status)
ORDER_SERVICE_URL=
```

- [ ] **Step 6: Verify compilation**

Run: `cd PaymentService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 7: Run existing tests**

Run: `cd PaymentService && ./mvnw test`
Expected: All tests pass (PaymentServiceApplicationTests context load)

- [ ] **Step 8: Commit**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/WebhookService.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/OrderServiceClient.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/config/RestTemplateConfig.java
git add PaymentService/src/main/resources/application.properties
git add PaymentService/.env.example
git commit -m "refactor: replace RestTemplate OrderServiceClient with Feign OrderClient in PaymentService"
```

---

### Task 4: OrderService — Add OpenFeign dependencies

**Files:**
- Modify: `OrderService/pom.xml`

- [ ] **Step 1: Add OpenFeign and LoadBalancer dependencies to pom.xml**

Insert these two dependencies after the `spring-cloud-starter-netflix-eureka-client` dependency block (around line 80):

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-openfeign</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd OrderService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add OrderService/pom.xml
git commit -m "refactor: add OpenFeign and LoadBalancer dependencies to OrderService"
```

---

### Task 5: OrderService — Enable Feign and create ProductClient

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java`
- Create: `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`
- Create: `OrderService/src/main/java/com/iuh/fit/client/dto/RestoreStockRequest.java`

- [ ] **Step 1: Add @EnableFeignClients to OrderServiceApplication**

Replace the entire file content:

```java
package com.iuh.fit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

- [ ] **Step 2: Create the Feign client interface**

Create `OrderService/src/main/java/com/iuh/fit/client/ProductClient.java`:

```java
package com.iuh.fit.client;

import com.iuh.fit.client.dto.RestoreStockRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ProductService")
public interface ProductClient {

    @PostMapping("/api/products/variants/{variantId}/restore-stock")
    void restoreStock(
        @PathVariable("variantId") String variantId,
        @RequestBody RestoreStockRequest request
    );
}
```

Note: `name = "ProductService"` matches the `SERVICE_NAME` in ProductService's `eureka.config.js` (Node.js eureka-js-client registration name).

- [ ] **Step 3: Create the DTO**

Create `OrderService/src/main/java/com/iuh/fit/client/dto/RestoreStockRequest.java`:

```java
package com.iuh.fit.client.dto;

public record RestoreStockRequest(int quantity) {}
```

- [ ] **Step 4: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/OrderServiceApplication.java
git add OrderService/src/main/java/com/iuh/fit/client/
git commit -m "refactor: create ProductClient Feign interface for OrderService"
```

---

### Task 6: OrderService — Replace ProductServiceClient

**Files:**
- Modify: `OrderService/src/main/java/com/iuh/fit/service/OrderService.java`
- Delete: `OrderService/src/main/java/com/iuh/fit/service/ProductServiceClient.java`

- [ ] **Step 1: Update OrderService to use ProductClient**

Replace the import and field type in `OrderService.java`. Changes:

1. Remove import: `com.iuh.fit.service.ProductServiceClient`
2. Add import: `com.iuh.fit.client.ProductClient`
3. Add import: `com.iuh.fit.client.dto.RestoreStockRequest`
4. Change field type: `ProductServiceClient` → `ProductClient`
5. Change constructor parameter type: `ProductServiceClient` → `ProductClient`
6. Update the `restoreStock` call in `restoreStockForOrder` method

Replace the entire file content:

```java
package com.iuh.fit.service;

import com.iuh.fit.client.ProductClient;
import com.iuh.fit.client.dto.RestoreStockRequest;
import com.iuh.fit.domain.dto.CreateOrderFromCheckoutRequest;
import com.iuh.fit.domain.dto.OrderResponse;
import com.iuh.fit.domain.dto.PagedResponse;
import com.iuh.fit.domain.dto.UpdateOrderStatusRequest;
import com.iuh.fit.domain.entity.Order;
import com.iuh.fit.domain.entity.OrderItem;
import com.iuh.fit.domain.enums.OrderStatus;
import com.iuh.fit.exception.BadRequestException;
import com.iuh.fit.exception.ResourceNotFoundException;
import com.iuh.fit.repository.OrderRepository;
import com.iuh.fit.service.OrderEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final AuditService auditService;
    private final ProductClient productClient;
    private final OrderEventPublisher orderEventPublisher;
    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    public OrderService(OrderRepository orderRepository, AuditService auditService,
            ProductClient productClient,
            OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.auditService = auditService;
        this.productClient = productClient;
        this.orderEventPublisher = orderEventPublisher;
    }

    @Transactional
    public OrderResponse createOrderFromCheckout(Long userId, String email, CreateOrderFromCheckoutRequest request) {
        Order existing = orderRepository
                .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        BigDecimal calculatedTotal = calculateTotal(request.getItems());
        BigDecimal requestTotal = normalizeMoney(request.getTotalAmount());
        if (calculatedTotal.compareTo(requestTotal) != 0) {
            throw new BadRequestException(
                    "Total amount mismatch. expected=" + calculatedTotal + ", actual=" + requestTotal);
        }

        Order order = new Order();
        order.setUserId(userId);
        order.setCheckoutOrderId(request.getOrderId());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setTotalAmount(calculatedTotal);
        order.setPaymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod() : "CASH");
        order.setEmail(email);

        for (CreateOrderFromCheckoutRequest.CheckoutItemDto itemDto : request.getItems()) {
            if (itemDto.getQuantity() == null || itemDto.getQuantity() <= 0) {
                throw new BadRequestException("Item quantity must be greater than 0");
            }
            BigDecimal unitPrice = normalizeMoney(itemDto.getSnapshot().getPriceAtCheckout());
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemDto.getQuantity())).setScale(2,
                    RoundingMode.HALF_UP);

            OrderItem item = new OrderItem();
            item.setProductName(itemDto.getProductName());
            item.setProductId(itemDto.getProductId());
            item.setColor(itemDto.getColor());
            item.setSize(itemDto.getSize());
            item.setQuantity(itemDto.getQuantity());
            item.setUnitPrice(unitPrice);
            item.setLineTotal(lineTotal);
            item.setSnapshotProductName(itemDto.getSnapshot().getProductName());
            item.setSnapshotVariantSku(itemDto.getSnapshot().getVariantSku());
            item.setSnapshotPriceAtCheckout(unitPrice);
            item.setVariantId(itemDto.getVariantId());
            order.addItem(item);
        }

        try {
            Order saved = orderRepository.save(order);
            publishOrderCreatedEvent(saved);
            return toResponse(saved);
        } catch (DataIntegrityViolationException ex) {
            Order duplicated = orderRepository
                    .findByUserIdAndCheckoutOrderId(userId, request.getOrderId())
                    .orElseThrow(() -> ex);
            return toResponse(duplicated);
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getMyOrders(Long userId, int page, int size) {
        if (page < 1) {
            throw new BadRequestException("Page must be >= 1");
        }
        if (size <= 0 || size > 100) {
            throw new BadRequestException("Size must be between 1 and 100");
        }

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orderPage = orderRepository.findAllByUserId(userId, pageable);

        PagedResponse<OrderResponse> response = new PagedResponse<>();
        response.setContent(orderPage.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList()));
        response.setPage(orderPage.getNumber() + 1);
        response.setSize(orderPage.getSize());
        response.setTotalElements(orderPage.getTotalElements());
        response.setTotalPages(orderPage.getTotalPages());
        response.setFirst(orderPage.isFirst());
        response.setLast(orderPage.isLast());
        return response;
    }

    @Transactional(readOnly = true)
    public OrderResponse getMyOrderById(Long userId, Long id) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public Long getOrderUserId(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return order.getUserId();
    }

    @Transactional
    public OrderResponse updateOrderStatus(Long userId, Long id, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        OrderStatus requestedStatus = com.iuh.fit.domain.enums.OrderStatus
                .valueOf(request.getStatus());
        validateStatusTransition(order.getStatus(), requestedStatus);
        String prev = order.getStatus() != null ? order.getStatus().name() : null;
        order.setStatus(requestedStatus);
        Order saved = orderRepository.save(order);
        // record audit for user's own change with actor = userId
        auditService.record(id, userId, prev, requestedStatus.name(), request.getNote());

        if (OrderStatus.valueOf(request.getStatus()) == OrderStatus.CANCELLED && prev != null) {
            restoreStockForOrder(saved);
        }

        return toResponse(saved);
    }

    @Transactional
    public void updateOrderStatusByPaymentService(Long orderId, OrderStatus status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        validateStatusTransition(order.getStatus(), status);
        String prev = order.getStatus() != null ? order.getStatus().name() : null;
        order.setStatus(status);
        orderRepository.save(order);

        if (status == OrderStatus.CANCELLED && prev != null) {
            restoreStockForOrder(order);
        }
    }

    private void restoreStockForOrder(Order order) {
        for (OrderItem item : order.getItems()) {
            if (item.getVariantId() != null && !item.getVariantId().isBlank()) {
                productClient.restoreStock(item.getVariantId(), new RestoreStockRequest(item.getQuantity()));
            }
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<OrderResponse> getOrdersForAdmin(com.iuh.fit.domain.enums.OrderStatus status,
            java.time.Instant from,
            java.time.Instant to,
            int page,
            int size) {
        if (page < 1)
            throw new BadRequestException("Page must be >= 1");
        if (size <= 0 || size > 200)
            throw new BadRequestException("Size must be between 1 and 200");

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orderPage;
        if (status != null && from != null && to != null) {
            orderPage = orderRepository.findAllByStatusAndCreatedAtBetween(status, from, to, pageable);
        } else if (status != null) {
            orderPage = orderRepository.findAllByStatus(status, pageable);
        } else if (from != null && to != null) {
            orderPage = orderRepository.findAllByCreatedAtBetween(from, to, pageable);
        } else {
            orderPage = orderRepository.findAll(pageable);
        }

        PagedResponse<OrderResponse> response = new PagedResponse<>();
        response.setContent(orderPage.getContent().stream().map(this::toResponse).collect(Collectors.toList()));
        response.setPage(orderPage.getNumber() + 1);
        response.setSize(orderPage.getSize());
        response.setTotalElements(orderPage.getTotalElements());
        response.setTotalPages(orderPage.getTotalPages());
        response.setFirst(orderPage.isFirst());
        response.setLast(orderPage.isLast());
        return response;
    }

    @Transactional
    public OrderResponse updateOrderStatusAsAdmin(Long adminUserId, Long orderId, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        com.iuh.fit.domain.enums.OrderStatus requestedStatus = com.iuh.fit.domain.enums.OrderStatus
                .valueOf(request.getStatus());
        validateStatusTransition(order.getStatus(), requestedStatus);
        String prev = order.getStatus() != null ? order.getStatus().name() : null;
        order.setStatus(requestedStatus);
        Order saved = orderRepository.save(order);
        auditService.record(orderId, adminUserId, prev, requestedStatus.name(), request.getNote());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderByIdForAdmin(Long id) {
        Order order = orderRepository.findOneById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return toResponse(order);
    }

    private void validateStatusTransition(com.iuh.fit.domain.enums.OrderStatus current,
            com.iuh.fit.domain.enums.OrderStatus requested) {
        if (current == requested)
            return;
        if (current == null)
            return; // no prior state

        switch (current) {
            case PENDING_PAYMENT -> {
                if (requested != com.iuh.fit.domain.enums.OrderStatus.PAID
                        && requested != com.iuh.fit.domain.enums.OrderStatus.CANCELLED) {
                    throw new BadRequestException("Invalid status transition from PENDING_PAYMENT to " + requested);
                }
            }
            case PAID -> {
                if (requested != com.iuh.fit.domain.enums.OrderStatus.CANCELLED) {
                    throw new BadRequestException("Invalid status transition from PAID to " + requested);
                }
            }
            case CANCELLED -> throw new BadRequestException("Cannot change status of a CANCELLED order");
            default -> throw new BadRequestException("Unsupported current order status: " + current);
        }
    }

    @Transactional
    public void deleteMyOrder(Long userId, Long id) {
        Order order = orderRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        orderRepository.delete(order);
    }

    private void publishOrderCreatedEvent(Order saved) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    String userEmail = saved.getEmail();
                    if (userEmail != null && !userEmail.isBlank()) {
                        orderEventPublisher.publishOrderCreated(saved.getId(), saved.getUserId(), userEmail);
                    } else {
                        log.warn("Order {} has no email, skipping order created event", saved.getId());
                    }
                } catch (Exception e) {
                    log.error("Failed to publish order created event for orderId {}: {}", saved.getId(), e.getMessage(), e);
                }
            }
        });
    }

    private BigDecimal calculateTotal(List<CreateOrderFromCheckoutRequest.CheckoutItemDto> items) {
        return items.stream()
                .map(i -> normalizeMoney(i.getSnapshot().getPriceAtCheckout())
                        .multiply(BigDecimal.valueOf(i.getQuantity()))
                        .setScale(2, RoundingMode.HALF_UP))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        if (value == null) {
            throw new BadRequestException("Amount cannot be null");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private OrderResponse toResponse(Order order) {
        OrderResponse response = new OrderResponse();
        response.setId(order.getId());
        response.setCheckoutOrderId(order.getCheckoutOrderId());
        response.setUserId(order.getUserId());
        response.setStatus(order.getStatus());
        response.setTotalAmount(order.getTotalAmount());
        response.setPaymentMethod(order.getPaymentMethod());
        response.setEmail(order.getEmail());
        response.setCreatedAt(order.getCreatedAt());
        response.setUpdatedAt(order.getUpdatedAt());

        List<OrderResponse.OrderItemResponse> itemResponses = order.getItems().stream()
                .map(item -> {
                    OrderResponse.OrderItemResponse r = new OrderResponse.OrderItemResponse();
                    r.setId(item.getId());
                    r.setProductId(item.getProductId());
                    r.setProductName(item.getProductName());
                    r.setColor(item.getColor());
                    r.setSize(item.getSize());
                    r.setQuantity(item.getQuantity());
                    r.setUnitPrice(item.getUnitPrice());
                    r.setLineTotal(item.getLineTotal());
                    r.setSnapshotProductName(item.getSnapshotProductName());
                    r.setSnapshotVariantSku(item.getSnapshotVariantSku());
                    r.setSnapshotPriceAtCheckout(item.getSnapshotPriceAtCheckout());
                    return r;
                })
                .collect(Collectors.toList());
        response.setItems(itemResponses);
        return response;
    }
}
```

Key changes from original:
- Imports: `ProductServiceClient` → `ProductClient` + `RestoreStockRequest`
- Field: `ProductServiceClient productServiceClient` → `ProductClient productClient`
- Constructor param: `ProductServiceClient` → `ProductClient`
- Call in `restoreStockForOrder`: `productServiceClient.restoreStock(item.getVariantId(), item.getQuantity())` → `productClient.restoreStock(item.getVariantId(), new RestoreStockRequest(item.getQuantity()))`

- [ ] **Step 2: Delete the old RestTemplate-based client**

Delete: `OrderService/src/main/java/com/iuh/fit/service/ProductServiceClient.java`

- [ ] **Step 3: Verify compilation**

Run: `cd OrderService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 4: Run existing tests**

Run: `cd OrderService && ./mvnw test`
Expected: All tests pass (OrderServiceApplicationTests context load)

- [ ] **Step 5: Commit**

```bash
git add OrderService/src/main/java/com/iuh/fit/service/OrderService.java
git add OrderService/src/main/java/com/iuh/fit/service/ProductServiceClient.java
git commit -m "refactor: replace RestTemplate ProductServiceClient with Feign ProductClient in OrderService"
```

---

### Task 7: CartService — Remove URL override from Feign client

**Files:**
- Modify: `CartService/src/main/java/iuh/fit/CartService/client/ProductServiceClient.java`
- Modify: `CartService/pom.xml`
- Modify: `CartService/src/main/resources/application.properties`
- Modify: `CartService/.env.example`

- [ ] **Step 1: Remove url attribute from ProductServiceClient**

Replace the entire file content:

```java
package iuh.fit.CartService.client;

import iuh.fit.CartService.domain.dto.DeductStockRequest;
import iuh.fit.CartService.domain.dto.ProductDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "ProductService")
public interface ProductServiceClient {

    @GetMapping("/api/products/{id}")
    ProductDto getProductById(@PathVariable("id") String id);

    @PostMapping("/api/products/variants/{variantId}/deduct-stock")
    void deductStock(@PathVariable("variantId") String variantId, @RequestBody DeductStockRequest request);
}
```

Key change: Removed `url = "${product.service.url}"` — now Feign resolves `ProductService` via Eureka.

- [ ] **Step 2: Add LoadBalancer dependency to pom.xml**

CartService already has `spring-cloud-starter-openfeign` but is missing `spring-cloud-starter-loadbalancer`. Add it after the openfeign dependency:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

- [ ] **Step 3: Remove product.service.url from application.properties**

Remove this line from `CartService/src/main/resources/application.properties`:

```properties
product.service.url=${PRODUCT_SERVICE_URL:http://localhost:8082}
```

- [ ] **Step 4: Remove PRODUCT_SERVICE_URL from .env.example**

Remove this line from `CartService/.env.example`:

```
PRODUCT_SERVICE_URL=http://productservice:8082
```

- [ ] **Step 5: Verify compilation**

Run: `cd CartService && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 6: Run existing tests**

Run: `cd CartService && ./mvnw test`
Expected: All tests pass (CartServiceApplicationTests context load)

- [ ] **Step 7: Commit**

```bash
git add CartService/src/main/java/iuh/fit/CartService/client/ProductServiceClient.java
git add CartService/pom.xml
git add CartService/src/main/resources/application.properties
git add CartService/.env.example
git commit -m "refactor: remove URL override from CartService ProductServiceClient for pure Eureka resolution"
```

---

### Task 8: Final verification — Build all services

**Files:** No file changes.

- [ ] **Step 1: Build all three services**

Run:
```bash
cd PaymentService && ./mvnw clean package -DskipTests -q && cd ..
cd OrderService && ./mvnw clean package -DskipTests -q && cd ..
cd CartService && ./mvnw clean package -DskipTests -q && cd ..
```
Expected: All three BUILD SUCCESS

- [ ] **Step 2: Run all tests**

Run:
```bash
cd PaymentService && ./mvnw test -q && cd ..
cd OrderService && ./mvnw test -q && cd ..
cd CartService && ./mvnw test -q && cd ..
```
Expected: All tests pass

- [ ] **Step 3: Commit final verification**

```bash
git add -A
git commit -m "chore: verify all services build and tests pass after Feign refactor"
```

---

### Task 9: Docker integration test (optional, requires Docker)

**Files:** No file changes.

- [ ] **Step 1: Build and start all services via Docker Compose**

Run:
```bash
docker compose up --build -d
```

- [ ] **Step 2: Verify Eureka registration**

Run:
```bash
curl -s http://localhost:8761/eureka/apps | grep -E "<name>|<status>"
```
Expected: All services registered (ORDERSERVICE, ProductService, PaymentService, CartService, etc.)

- [ ] **Step 3: Verify end-to-end payment flow**

1. Create an order via the API Gateway
2. Process a payment (or simulate via SePay webhook)
3. Verify order status updates to PAID (tests PaymentService → OrderService Feign call)
4. Cancel the order
5. Verify stock is restored in ProductService (tests OrderService → ProductService Feign call)
6. Add item to cart
7. Verify cart fetches product from ProductService (tests CartService → ProductService Feign call)

- [ ] **Step 4: Stop Docker Compose**

Run:
```bash
docker compose down
```

# SEPAY Payment Details in OrderDetail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display SEPAY payment details (paymentCode, sepayTransactionId, sepayGateway, paidAt) on the OrderDetail page for QR payments with PAID status.

**Architecture:** Add a new query endpoint `GET /api/payments?orderId={id}` in PaymentService. Frontend OrderDetail fetches payment details when `paymentMethod === "QR"` and conditionally renders a payment details section. Security enforced via JWT userId verification against OrderService.

**Tech Stack:** Java Spring Boot, JPA, React 19, TypeScript, TanStack Query, Axios

---

### Task 1: Add `findByOrderId` to PaymentRepository

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/repository/PaymentRepository.java`

- [ ] **Step 1: Add findByOrderId query method**

Add this method to `PaymentRepository.java` after the existing `findByCheckoutOrderId` method:

```java
Optional<Payment> findByOrderId(Long orderId);
```

This enables querying payments by the orderId field that already exists in the Payment entity.

---

### Task 2: Add `getPaymentByOrderId` to PaymentService

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`

- [ ] **Step 1: Add the service method**

Add this method to `PaymentService.java` after `getPaymentByPaymentCode`:

```java
@Transactional(readOnly = true)
public PaymentResponse getPaymentByOrderId(Long orderId) {
    Payment payment = paymentRepository.findByOrderId(orderId)
            .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));
    return toResponse(payment);
}
```

This reuses the existing `toResponse` mapper which already includes all fields needed: paymentCode, sepayTransactionId (via Payment entity), sepayGateway, paidAt, status, method.

Note: The `toResponse` method already sets `qrUrl` only for QR+PENDING payments, so PAID payments won't have a qrUrl - which is correct behavior.

---

### Task 3: Add `GET /api/payments?orderId={id}` endpoint to PaymentController

**Files:**
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java`

- [ ] **Step 1: Add the query parameter endpoint**

Add this method to `PaymentController.java` after the existing `getPayment` method:

```java
@GetMapping
@Operation(summary = "Get payment by orderId query param", description = "Get payment details by orderId query parameter")
public ResponseEntity<PaymentResponse> getPaymentByOrderId(@RequestParam Long orderId) {
    return ResponseEntity.ok(paymentService.getPaymentByOrderId(orderId));
}
```

This creates `GET /api/payments?orderId={id}` which returns a single PaymentResponse. The endpoint requires JWT authentication (class-level `@SecurityRequirement`).

**Important:** This endpoint coexists with `@GetMapping("/{id}")`. Spring will route `/api/payments?orderId=123` to this new method and `/api/payments/123` to `getPayment(@PathVariable Long id)` because of the path variable distinction.

---

### Task 4: Add security - verify order ownership via OrderServiceClient

**Files:**
- Modify: `PaymentService/src/main/java/ihu/fit/PaymentService/service/OrderServiceClient.java`
- Modify: `PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java`

- [ ] **Step 1: Add getOrderUserId method to OrderServiceClient**

Add this method to `OrderServiceClient.java`:

```java
public Long getOrderUserId(Long orderId) {
    String url = orderServiceUrl + "/api/orders/" + orderId;
    
    try {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Void> request = new HttpEntity<>(headers);
        
        ResponseEntity<JsonNode> response = restTemplate.exchange(
                url, HttpMethod.GET, request, JsonNode.class);
        
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new PaymentException("Failed to fetch order: " + orderId);
        }
        
        return response.getBody().get("userId").asLong();
    } catch (PaymentException e) {
        throw e;
    } catch (Exception e) {
        log.error("Error calling OrderService to get order {} userId: {}", orderId, e.getMessage());
        throw new PaymentException("Failed to communicate with OrderService: " + e.getMessage());
    }
}
```

This calls the existing OrderService `GET /api/orders/{id}` endpoint which returns OrderResponse with userId field.

- [ ] **Step 2: Add ownership verification to getPaymentByOrderId**

Modify the `getPaymentByOrderId` method from Task 2 to include ownership check:

```java
@Transactional(readOnly = true)
public PaymentResponse getPaymentByOrderId(Long orderId, Long requestingUserId) {
    Payment payment = paymentRepository.findByOrderId(orderId)
            .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));
    
    Long orderUserId = orderServiceClient.getOrderUserId(orderId);
    if (!orderUserId.equals(requestingUserId)) {
        throw new PaymentException("Access denied: you do not own this order");
    }
    
    return toResponse(payment);
}
```

- [ ] **Step 3: Update controller to pass userId from SecurityContext**

Update the controller method from Task 3:

```java
@GetMapping
@Operation(summary = "Get payment by orderId query param", description = "Get payment details by orderId query parameter")
public ResponseEntity<PaymentResponse> getPaymentByOrderId(@RequestParam Long orderId) {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    Long requestingUserId = principal instanceof Long ? (Long) principal : null;
    if (requestingUserId == null) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }
    return ResponseEntity.ok(paymentService.getPaymentByOrderId(orderId, requestingUserId));
}
```

Add the import at the top of PaymentController.java:
```java
import org.springframework.security.core.context.SecurityContextHolder;
```

This extracts the userId from the JWT token (set as the principal in JwtAuthenticationFilter) and passes it to the service for ownership verification.

---

### Task 5: Update frontend PaymentResponse type and add API function

**Files:**
- Modify: `frontend/src/services/paymentApi.ts`

- [ ] **Step 1: Add new fields to PaymentResponse interface**

Update the `PaymentResponse` interface to include SEPAY fields:

```typescript
export interface PaymentResponse {
  paymentId: number;
  orderId: number;
  checkoutOrderId: string;
  paymentCode: string;
  amount: number;
  method: PaymentMethod;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  qrUrl?: string;
  expiresAt: string;
  createdAt: string;
  sepayTransactionId?: number;
  sepayGateway?: string;
  paidAt?: string;
}
```

- [ ] **Step 2: Add getPaymentByOrderId API function**

Add this function at the end of `paymentApi.ts`:

```typescript
export const getPaymentByOrderId = (orderId: number) =>
  axiosInstance
    .get<PaymentResponse>("/api/payments", { params: { orderId } })
    .then((res) => res.data);
```

This calls `GET /api/payments?orderId={orderId}` which routes to the new controller method.

---

### Task 6: Add usePaymentByOrderId hook

**Files:**
- Modify: `frontend/src/hooks/usePayment.ts`

- [ ] **Step 1: Add the query key**

Add to `paymentKeys`:
```typescript
byOrder: (orderId: number) => [...paymentKeys.all, "byOrder", orderId] as const,
```

- [ ] **Step 2: Add the hook**

Add this hook at the end of `usePayment.ts`:

```typescript
export function usePaymentByOrderId(orderId: number | null, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.byOrder(orderId ?? 0),
    queryFn: () => getPaymentByOrderId(orderId!),
    enabled: enabled && orderId !== null,
  });
}
```

Add `getPaymentByOrderId` to the imports at the top:
```typescript
import {
  createPayment,
  getPaymentStatus,
  getPaymentById,
  cancelPayment,
  getPaymentByOrderId,
  type CreatePaymentPayload,
} from "@/src/services/paymentApi";
```

---

### Task 7: Update OrderDetail page to display payment details

**Files:**
- Modify: `frontend/src/pages/OrderDetail.tsx`

- [ ] **Step 1: Add imports**

Add these imports at the top:
```typescript
import { usePaymentByOrderId } from "@/src/hooks/usePayment";
import { CreditCard, Clock, Building2, Hash } from "lucide-react";
```

- [ ] **Step 2: Fetch payment details for QR orders**

Add this inside the component, after the `useUserOrderDetail` call:
```typescript
const { data: payment, isLoading: paymentLoading } = usePaymentByOrderId(
  order?.id ?? null,
  order?.paymentMethod === "QR" && order?.status !== "CANCELLED"
);
```

- [ ] **Step 3: Add payment details section**

Add this section after the order items table, before the closing `</div>` of the main container:

```tsx
{order.paymentMethod === "QR" && payment && payment.status === "PAID" && (
  <div className="mt-6 rounded-lg border p-5">
    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
      <CreditCard className="h-5 w-5" />
      Thông tin thanh toán
    </h2>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Mã thanh toán</p>
          <p className="font-mono text-sm font-semibold">
            {payment.paymentCode}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Cổng thanh toán</p>
          <p className="text-sm font-semibold">
            {payment.sepayGateway || "SePay"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Mã giao dịch</p>
          <p className="font-mono text-sm font-semibold">
            {payment.sepayTransactionId ?? "-"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Thời gian thanh toán</p>
          <p className="text-sm font-semibold">
            {payment.paidAt ? formatDateTime(payment.paidAt) : "-"}
          </p>
        </div>
      </div>
    </div>
  </div>
)}

{order.paymentMethod === "QR" && order.status === "PENDING_PAYMENT" && (
  <div className="mt-6 rounded-lg border p-5">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="h-5 w-5" />
      <p>Đang chờ thanh toán</p>
    </div>
  </div>
)}
```

This renders:
- Full payment details section when QR payment is PAID
- "Đang chờ thanh toán" message when order is still pending
- Nothing for CANCELLED orders or CASH payments

---

### Task 8: Test the implementation

**Files:**
- All modified files

- [ ] **Step 1: Build PaymentService**

Run: `cd PaymentService && ./mvnw clean compile`
Expected: BUILD SUCCESS

- [ ] **Step 2: Build frontend**

Run: `cd frontend && npm run build`
Expected: No TypeScript errors, build succeeds

- [ ] **Step 3: Run PaymentService tests**

Run: `cd PaymentService && ./mvnw test`
Expected: All tests pass

- [ ] **Step 4: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: No lint errors

---

### Task 9: Commit changes

- [ ] **Step 1: Commit all changes**

```bash
git add PaymentService/src/main/java/iuh/fit/PaymentService/repository/PaymentRepository.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/PaymentService.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/controller/PaymentController.java
git add PaymentService/src/main/java/iuh/fit/PaymentService/service/OrderServiceClient.java
git add frontend/src/services/paymentApi.ts
git add frontend/src/hooks/usePayment.ts
git add frontend/src/pages/OrderDetail.tsx
git commit -m "feat: display SEPAY payment details in OrderDetail for QR payments"
```

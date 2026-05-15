# Design: SEPAY Payment Details Display in Order

## Date
2026-05-14

## Context
PaymentService đã lưu đầy đủ thông tin SEPAY (`sepayTransactionId`, `sepayGateway`, `paymentCode`, `paidAt`) trong bảng `payments`. OrderService chỉ lưu `paymentMethod` và order status. Người dùng muốn xem lại thông tin payment chi tiết trên OrderDetail page.

## Decision
Giữ payment data trong PaymentService (single source of truth). Frontend gọi thêm Payment API khi render OrderDetail. Chỉ hiển thị payment details cho order có `paymentMethod = "QR"` và payment status = `PAID`. Order cancelled không hiển thị payment details.

## Architecture

### Data Flow
```
Frontend (OrderDetail)
  |
  |-- GET /api/orders/{id} → order info (userId, status, totalAmount, paymentMethod, ...)
  |
  |-- GET /api/payments?orderId={id} → payment details
  |     └── If paymentMethod != "QR" → skip call
  |     └── If payment.status != "PAID" → skip display
  |
  └── Render payment details section:
        - Payment Code: PAY-xxx
        - SEPAY Transaction ID: 123456
        - Gateway: SePay / Bank Name
        - Paid At: 2026-05-14 10:30:00
```

### PaymentService Changes

**New endpoint:** `GET /api/payments?orderId={orderId}`

- Query payment by `orderId`
- Return `PaymentResponse` với fields: `paymentCode`, `sepayTransactionId`, `sepayGateway`, `paidAt`, `status`
- If no payment found → return 404

### OrderService Changes

**No changes required.** OrderService giữ nguyên architecture.

### Frontend Changes

**OrderDetail page** (`frontend/src/pages/OrderDetail.tsx`):

1. Fetch payment details khi `order.paymentMethod === "QR"`
2. Conditional rendering:
   - Nếu `payment.status === "PAID"` → hiển thị payment details section
   - Nếu `payment.status !== "PAID"` hoặc order cancelled → không hiển thị
3. Payment details section format:
   ```
   ┌─────────────────────────────────┐
   │ Payment Details                 │
   ├─────────────────────────────────┤
   │ Payment Code:    PAY-abc123    │
   │ Transaction ID:  123456        │
   │ Gateway:         SePay         │
   │ Paid At:         14/05/2026    │
   └─────────────────────────────────┘
   ```

**paymentApi.ts** - Add new query:
```typescript
export const getPaymentByOrderId = async (orderId: number) => {
  const { data } = await api.get(`/payments`, { params: { orderId } });
  return data;
};
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Payment not found | Hide payment details section |
| Payment status = PENDING | Show "Đang chờ thanh toán" message |
| Payment status = CANCELLED | Hide payment details section |
| Payment status = EXPIRED | Hide payment details section |
| API call fails | Silently fail, hide section |
| paymentMethod = "CASH" | Không gọi Payment API |

## Security

- Payment details endpoint yêu cầu authentication (JWT)
- PaymentService sẽ extract userId từ JWT token và verify rằng payment thuộc về user đó
- Implementation: PaymentService gọi OrderService để lấy `userId` của order, so với JWT userId
- Không expose `sepayTransactionId` cho user khác

## Testing

- Unit test: PaymentService `getPaymentByOrderId` query
- Integration test: Frontend fetches payment details correctly
- E2E test: OrderDetail shows/hides payment details based on status

## Rollback

Nếu cần rollback:
- Xóa endpoint mới trong PaymentService
- Revert frontend changes trong OrderDetail
- Không có migration database nào cần rollback

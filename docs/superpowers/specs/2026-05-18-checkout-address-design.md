# Checkout Address — Design Spec

**Date:** 2026-05-18
**Feature:** Add shipping address to checkout and order
**Status:** Final

---

## Overview

Add `shippingStreet`, `shippingWard`, `shippingProvince` to orders. Show address on checkout page — inline edit if missing. Validate address required before order creation.

---

## Backend (OrderService)

### Modified Files

| File | Change |
|------|--------|
| `domain/entity/Order.java` | +3 fields: shippingStreet, shippingWard, shippingProvince (NOT NULL) |
| `domain/dto/CreateOrderFromCheckoutRequest.java` | +3 fields with @NotBlank |
| `domain/dto/OrderResponse.java` | +3 fields |

### Order Entity

```java
@Column(nullable = false)
private String shippingStreet;

@Column(nullable = false)
private String shippingWard;

@Column(nullable = false)
private String shippingProvince;
```

### CreateOrderFromCheckoutRequest

```java
@NotBlank(message = "Shipping street is required")
private String shippingStreet;

@NotBlank(message = "Shipping ward is required")
private String shippingWard;

@NotBlank(message = "Shipping province is required")
private String shippingProvince;
```

---

## Frontend

### Modified Files

| File | Change |
|------|--------|
| `services/orderApi.ts` | CreateOrderPayload + shippingStreet/Ward/Province |
| `pages/CheckoutPage.tsx` | Add address section: read-only or inline AddressForm |
| `hooks/useUserOrders.ts` | Pass address to createOrder |

### Checkout Flow

```
Page load → check user.address
  ├── has address → show read-only (street, ward, province) + "Sửa" button
  └── no address  → show AddressForm inline (must fill)

Click "Xác nhận thanh toán" →
  1. If address incomplete → block with error message
  2. If address not yet saved → PUT /api/users/me/address first
  3. Create order with shippingStreet, shippingWard, shippingProvince
  4. Continue to payment
```

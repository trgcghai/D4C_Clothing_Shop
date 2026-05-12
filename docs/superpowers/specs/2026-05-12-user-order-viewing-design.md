# User Order Viewing Feature — Design Spec

**Date:** 2026-05-12
**Status:** Draft — pending review

## Overview

Users currently cannot view orders they have placed. This feature adds:
1. A `/orders` page listing user's orders as cards, sorted latest-first, with infinite scroll ("Load more")
2. A `/orders/:orderId` detail page showing full order information
3. A popover on the UserButton in the navbar with a link to "Đơn hàng của tôi"
4. Navigation to `/orders` after successful checkout (already exists in CartPage.tsx:159)

## Architecture

### Route Structure
```
/orders          → MyOrders (order list, infinite scroll)
/orders/:orderId → OrderDetail (single order detail)
```

Both routes live under `AppLayout` (public/authenticated layout).

### File Changes

**New files:**
| File | Purpose |
|------|---------|
| `frontend/src/pages/MyOrders.tsx` | Order list page with card layout + "Load more" |
| `frontend/src/pages/OrderDetail.tsx` | Single order detail view |
| `frontend/src/hooks/useUserOrders.ts` | TanStack Query hooks for user orders |

**Modified files:**
| File | Change |
|------|--------|
| `frontend/src/services/orderApi.ts` | Add `getOrdersByUserPaginated({ page, size })` and `getUserOrderDetail(orderId)` |
| `frontend/src/App.tsx` | Add routes for `/orders` and `/orders/:orderId` |
| `frontend/src/components/UserButton.tsx` | Wrap avatar in Popover with navigation links |

## Component Design

### MyOrders Page (`/orders`)

**Layout:**
- Header: "Đơn hàng của tôi" + order count subtitle
- Card list — each card displays:
  - Order ID (`#123`), Checkout ID, creation date
  - Status badge (PENDING_PAYMENT → "Chờ thanh toán", PAID → "Đã thanh toán", CANCELLED → "Đã hủy")
  - Total amount (VND currency format)
  - Item count summary (e.g., "3 sản phẩm")
  - "Xem chi tiết" button → `navigate(/orders/${order.id})`

**Infinite scroll:**
- Uses `useInfiniteQuery` (TanStack Query)
- Page size: 10 orders per page
- "Load more" button at bottom (manual trigger, not auto-scroll)
- Shows spinner while fetching next page
- Shows "Không còn đơn hàng nào" when exhausted

**Empty state:**
- Empty component: "Chưa có đơn hàng nào" + "Tiếp tục mua sắm" button → `/products`

**Sorting:** Backend returns `createdAt DESC` (latest first).

### OrderDetail Page (`/orders/:orderId`)

**Layout:**
- Back button: "← Quay lại danh sách đơn hàng" → `/orders`
- Header: Order ID + status badge
- Summary grid (4 cards): Checkout ID, Total amount, Status, Created date/time
- Items table: Product name, Color, Size, Quantity, Unit Price, Line Total

**Not found state:**
- "Không tìm thấy đơn hàng" with back button

### UserButton Popover

**Behavior:**
- Avatar button becomes a Popover trigger (click opens popover)
- Popover content:
  - User info: avatar, full name, email
  - Links: "Hồ sơ" → `/profile`, "Đơn hàng của tôi" → `/orders`
- Clicking a link navigates and closes popover
- Visual appearance of the button in navbar remains unchanged

## API Design

### Backend Changes Required (ProductService — Node.js/Express)

1. **`GET /api/orders/user/me?page=0&size=10`**
   - Modify existing endpoint in ProductService to accept pagination params
   - Return paginated response matching `AdminOrderListResponse` shape:
     ```json
     {
       "content": [OrderResponse, ...],
       "page": 0,
       "size": 10,
       "totalElements": 42,
       "totalPages": 5,
       "first": true,
       "last": false
     }
     ```
   - Default sort: `createdAt DESC`

2. **`GET /api/orders/user/me/{orderId}`** (new endpoint in ProductService)
   - Returns single order detail scoped to authenticated user
   - Returns `OrderResponse` shape (same as existing `getOrderById`)
   - Returns 404 if order doesn't exist or doesn't belong to user

### Frontend API Layer (`orderApi.ts`)

```typescript
// New exports
export interface UserOrdersPaginatedResponse {
  content: OrderResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const getOrdersByUserPaginated = async (
  params: { page: number; size: number }
): Promise<UserOrdersPaginatedResponse> => {
  return axiosInstance.get("/api/orders/user/me", { params }).then((res) => res.data);
};

export const getUserOrderDetail = async (
  orderId: number
): Promise<OrderResponse> => {
  return axiosInstance.get(`/api/orders/user/me/${orderId}`).then((res) => res.data);
};
```

### Hooks (`useUserOrders.ts`)

```typescript
// useUserOrders — wraps useInfiniteQuery
// Returns: data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError

// useUserOrderDetail(orderId) — wraps useQuery
// Returns: data, isLoading, isError
```

## Error Handling

- 401 → redirect to `/signin` (handled by existing axios interceptor)
- 404 on detail → show "not found" state in OrderDetail page
- Network errors → toast notification via sonner
- Loading states → Skeleton components for cards and detail view

## Styling Conventions

- Follow existing patterns from `OrderManagement.tsx` for status badges, currency formatting, date formatting
- Use shadcn/ui components: `Card`, `Badge`, `Button`, `Skeleton`, `Empty`, `Popover`, `Avatar`
- Vietnamese labels consistent with existing UI
- Currency: `new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" })`
- Date: `new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" })`

## Data Flow Summary

```
User clicks checkout → CartPage creates order → navigate("/orders")
                                                   ↓
                                            MyOrders page
                                            (useInfiniteQuery)
                                                   ↓
                                    GET /api/orders/user/me?page=0&size=10
                                                   ↓
                                    Card list sorted by createdAt DESC
                                                   ↓
                                    User clicks "Xem chi tiết"
                                                   ↓
                                    navigate("/orders/:orderId")
                                                   ↓
                                    OrderDetail page
                                    (useQuery)
                                                   ↓
                                    GET /api/orders/user/me/{orderId}
```

## Success Criteria

1. Authenticated users can view their order history at `/orders`
2. Orders are sorted latest-first by default
3. Users can load more orders via "Load more" button
4. Users can view full order details at `/orders/:orderId`
5. UserButton opens a popover with a link to the orders page
6. After checkout, user is redirected to `/orders`
7. Users only see their own orders (backend enforces ownership)

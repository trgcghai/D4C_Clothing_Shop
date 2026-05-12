# User Order Viewing Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to view their placed orders via a card-list page with infinite scroll and a detail page, accessible from a UserButton popover and after checkout.

**Architecture:** New frontend pages and hooks that consume existing OrderService REST APIs. `GET /api/orders` (paginated, 1-based) for the list, `GET /api/orders/{id}` for detail. Uses TanStack Query's `useInfiniteQuery` for load-more pagination.

**Tech Stack:** React + TypeScript, TanStack Query, shadcn/ui, react-router-dom, Zustand (auth)

---

### Task 1: Add paginated API functions to orderApi.ts

**Files:**
- Modify: `frontend/src/services/orderApi.ts`

- [ ] **Step 1: Add new types and API functions**

Add the following to the end of `frontend/src/services/orderApi.ts`:

```typescript
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
  params: { page: number; size: number },
): Promise<UserOrdersPaginatedResponse> => {
  return axiosInstance.get("/api/orders", { params }).then((res) => res.data);
};

export const getUserOrderDetail = async (
  orderId: number,
): Promise<OrderResponse> => {
  return axiosInstance.get(`/api/orders/${orderId}`).then((res) => res.data);
};
```

Note: The backend already serves `GET /api/orders` as the authenticated user's paginated orders (OrderController.java:47-55) and `GET /api/orders/{id}` scoped to the user (OrderController.java:57-64). The existing `getOrdersByUser()` function (line 58-60) can remain for backward compatibility but is no longer used by the new feature.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/orderApi.ts
git commit -m "feat: add paginated order API functions for user orders"
```

---

### Task 2: Create useUserOrders hooks

**Files:**
- Create: `frontend/src/hooks/useUserOrders.ts`

- [ ] **Step 1: Write the hooks file**

Create `frontend/src/hooks/useUserOrders.ts` with the following content:

```typescript
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getOrdersByUserPaginated,
  getUserOrderDetail,
} from "@/src/services/orderApi";

const PAGE_SIZE = 10;

export const userOrderKeys = {
  all: ["user-orders"] as const,
  lists: () => [...userOrderKeys.all, "list"] as const,
  list: () => [...userOrderKeys.lists()] as const,
  detail: (id: number) => [...userOrderKeys.all, "detail", id] as const,
};

export function useUserOrders() {
  return useInfiniteQuery({
    queryKey: userOrderKeys.list(),
    queryFn: ({ pageParam }) =>
      getOrdersByUserPaginated({ page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.last) return undefined;
      return lastPage.page + 1;
    },
    staleTime: 20_000,
  });
}

export function useUserOrderDetail(orderId: number | null) {
  return useQuery({
    queryKey: userOrderKeys.detail(orderId ?? 0),
    queryFn: () => getUserOrderDetail(orderId as number),
    enabled: orderId !== null,
    staleTime: 20_000,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useUserOrders.ts
git commit -m "feat: add useUserOrders and useUserOrderDetail hooks"
```

---

### Task 3: Create MyOrders page

**Files:**
- Create: `frontend/src/pages/MyOrders.tsx`

- [ ] **Step 1: Write the MyOrders page**

Create `frontend/src/pages/MyOrders.tsx` with the following content:

```tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { useUserOrders } from "@/src/hooks/useUserOrders";
import type { OrderResponse } from "@/src/services/orderApi";
import { ClipboardList, Loader2, Package } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const getStatusBadgeVariant = (status: string) => {
  if (status === "PAID") return "default";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
};

const getStatusLabel = (status: string) => {
  if (status === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (status === "PAID") return "Đã thanh toán";
  if (status === "CANCELLED") return "Đã hủy";
  return status;
};

function OrderCard({ order }: { order: OrderResponse }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">#{order.id}</span>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Mã đơn: {order.checkoutOrderId}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(order.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {order.items.length} sản phẩm
            </p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(order.totalAmount)}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            Xem chi tiết
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MyOrders() {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserOrders();

  if (isLoading) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-lg text-muted-foreground">
            Không thể tải danh sách đơn hàng
          </p>
          <Button
            variant="link"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            Thử lại
          </Button>
        </div>
      </main>
    );
  }

  const orders = data?.pages.flatMap((page) => page.content) ?? [];
  const totalElements = data?.pages[0]?.totalElements ?? 0;

  if (orders.length === 0) {
    return (
      <main className="page-wrap px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <Empty>
            <EmptyMedia>
              <Package className="h-16 w-16 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>Chưa có đơn hàng nào</EmptyTitle>
            <EmptyDescription>
              Bạn chưa có đơn hàng nào. Hãy mua sắm ngay!
            </EmptyDescription>
            <EmptyContent>
              <Button asChild className="mt-4">
                <a href="/products">Tiếp tục mua sắm</a>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="size-6 text-primary" />
            Đơn hàng của tôi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalElements} đơn hàng
          </p>
        </div>

        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>

        {hasNextPage ? (
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải...
                </>
              ) : (
                "Xem thêm"
              )}
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Không còn đơn hàng nào
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/MyOrders.tsx
git commit -m "feat: add MyOrders page with card list and load-more"
```

---

### Task 4: Create OrderDetail page

**Files:**
- Create: `frontend/src/pages/OrderDetail.tsx`

- [ ] **Step 1: Write the OrderDetail page**

Create `frontend/src/pages/OrderDetail.tsx` with the following content:

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUserOrderDetail } from "@/src/hooks/useUserOrders";
import { ArrowLeft, Loader2 } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const getStatusBadgeVariant = (status: string) => {
  if (status === "PAID") return "default";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
};

const getStatusLabel = (status: string) => {
  if (status === "PENDING_PAYMENT") return "Chờ thanh toán";
  if (status === "PAID") return "Đã thanh toán";
  if (status === "CANCELLED") return "Đã hủy";
  return status;
};

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const id = orderId ? parseInt(orderId, 10) : null;
  const { data: order, isLoading, isError } = useUserOrderDetail(id);

  if (isLoading) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  if (isError || !order) {
    return (
      <main className="page-wrap px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <p className="text-lg text-muted-foreground">
            Không tìm thấy đơn hàng
          </p>
          <Button
            variant="link"
            onClick={() => navigate("/orders")}
            className="mt-2"
          >
            Quay lại danh sách
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/orders")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách đơn hàng
        </Button>

        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold">Đơn hàng #{order.id}</h1>
          <Badge variant={getStatusBadgeVariant(order.status)}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Mã đơn</p>
            <p className="font-semibold">{order.checkoutOrderId}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Tổng tiền</p>
            <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Trạng thái</p>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Ngày đặt</p>
            <p className="font-semibold">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Màu</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>Đơn giá</TableHead>
                <TableHead>Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.productName || item.snapshotProductName}
                  </TableCell>
                  <TableCell>{item.color || "-"}</TableCell>
                  <TableCell>{item.size || "-"}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell>{formatCurrency(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/OrderDetail.tsx
git commit -m "feat: add OrderDetail page with items table"
```

---

### Task 5: Add routes to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add imports and routes**

In `frontend/src/App.tsx`, add these imports after the existing page imports (around line 20):

```typescript
import MyOrders from "./pages/MyOrders";
import OrderDetail from "./pages/OrderDetail";
```

Add these two routes inside the `AppLayout` children array (after the `/profile` route, around line 32):

```typescript
{ path: "/orders", element: <MyOrders /> },
{ path: "/orders/:orderId", element: <OrderDetail /> },
```

The final routes section under `AppLayout` should look like:

```typescript
{
  element: <AppLayout />,
  children: [
    { path: "/", element: <Home /> },
    { path: "/products", element: <ProductsPage /> },
    { path: "/products/:productId", element: <ProductDetail /> },
    { path: "/cart", element: <CartPage /> },
    { path: "/profile", element: <Profile /> },
    { path: "/orders", element: <MyOrders /> },
    { path: "/orders/:orderId", element: <OrderDetail /> },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add /orders and /orders/:orderId routes"
```

---

### Task 6: Update UserButton with Popover

**Files:**
- Modify: `frontend/src/components/UserButton.tsx`

- [ ] **Step 1: Rewrite UserButton with Popover**

Replace the entire content of `frontend/src/components/UserButton.tsx` with:

```tsx
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/src/store";
import { ClipboardList, LogOut, User } from "lucide-react";

const UserButton = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/signin">Đăng nhập</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/signup">Đăng ký</Link>
        </Button>
      </div>
    );
  }

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user.username[0].toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" asChild className="gap-2 px-2">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={user.avatar} alt={user.fullName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline-block text-sm font-medium">
              {user.fullName || user.username}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex items-center gap-3 p-2">
          <Avatar size="sm">
            <AvatarImage src={user.avatar} alt={user.fullName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.fullName || user.username}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <div className="border-t" />
        <div className="flex flex-col gap-1 p-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="justify-start gap-2"
          >
            <Link to="/profile">
              <User className="h-4 w-4" />
              Hồ sơ
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="justify-start gap-2"
          >
            <Link to="/orders">
              <ClipboardList className="h-4 w-4" />
              Đơn hàng của tôi
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="justify-start gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserButton;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UserButton.tsx
git commit -m "feat: add popover to UserButton with profile, orders, logout links"
```

---

### Task 7: Verify and run lint

**Files:**
- No file changes

- [ ] **Step 1: Run lint in frontend**

```bash
cd frontend && npm run lint
```

Expected: No errors. Fix any lint issues if they appear.

- [ ] **Step 2: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server starts without compilation errors.

- [ ] **Step 3: Final commit (if lint fixes needed)**

```bash
git add -A
git commit -m "fix: address lint issues"
```

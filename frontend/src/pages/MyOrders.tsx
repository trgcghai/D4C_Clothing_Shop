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

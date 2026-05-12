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
import { ArrowLeft } from "lucide-react";

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

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
import { usePaymentByOrderId } from "@/src/hooks/usePayment";
import { ArrowLeft, SquareArrowOutUpRight, CreditCard, Clock, Building2, Hash } from "lucide-react";
import type { PaymentMethod } from "@/src/services/orderApi";

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

const getPaymentMethodLabel = (method: PaymentMethod) => {
  return method === "QR" ? "QR Code" : "Tiền mặt";
};

const getPaymentMethodBadgeVariant = (method: PaymentMethod) => {
  return method === "QR" ? "default" : "secondary";
};

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const id = orderId ? parseInt(orderId, 10) : null;
  const { data: order, isLoading, isError } = useUserOrderDetail(id);
  const { data: payment, isLoading: paymentLoading } = usePaymentByOrderId(
    order?.id ?? null,
    order?.paymentMethod === "QR" && order?.status !== "CANCELLED"
  );

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
      <div className="mx-auto">
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

        <div className="mb-6 grid gap-4 md:grid-cols-5">
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
            <p className="text-xs text-muted-foreground">Phương thức</p>
            <Badge variant={getPaymentMethodBadgeVariant(order.paymentMethod)}>
              {getPaymentMethodLabel(order.paymentMethod)}
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
                <TableHead>Số lượng</TableHead>
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
                  <TableCell>
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => navigate(`/products/${item.productId}`)}
                    >
                      <SquareArrowOutUpRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
      </div>
    </main>
  );
}

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ProductPagination from "@/src/components/CustomPagination";
import {
  useAdminOrderDetail,
  useAdminOrders,
  useOrderAudits,
  useUpdateAdminOrderStatus,
} from "@/src/hooks/useAdminOrders";
import type { AdminOrder, OrderStatus } from "@/src/services/orderAdminApi";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: Array<{ value: "ALL" | OrderStatus; label: string }> = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const STATUS_UPDATE_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "CANCELLED", label: "Đã hủy" },
];

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

const getStatusBadgeVariant = (status: OrderStatus) => {
  if (status === "PAID") return "default";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
};

const getStatusLabel = (status: OrderStatus) => {
  if (status === "PENDING_PAYMENT") return "Pending payment";
  if (status === "PAID") return "Paid";
  return "Cancelled";
};

const getAllowedNextStatuses = (current: OrderStatus): OrderStatus[] => {
  if (current === "PENDING_PAYMENT") return ["PAID", "CANCELLED"];
  if (current === "PAID") return ["CANCELLED"];
  return [];
};

export default function OrderManagement() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("PENDING_PAYMENT");
  const [statusNote, setStatusNote] = useState("");

  const filters = useMemo(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      page: page,
      size: PAGE_SIZE,
    }),
    [statusFilter, page],
  );

  const { data, isLoading } = useAdminOrders(filters);
  const { data: orderDetail, isLoading: isOrderDetailLoading } =
    useAdminOrderDetail(selectedOrderId);
  const { data: audits, isLoading: isAuditLoading } =
    useOrderAudits(selectedOrderId);
  const updateMutation = useUpdateAdminOrderStatus();

  const orders = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleOpenDetail = (order: AdminOrder) => {
    const allowed = getAllowedNextStatuses(order.status);
    setSelectedOrderId(order.id);
    setNewStatus(allowed[0] ?? order.status);
    setStatusNote("");
  };

  const handleUpdateStatus = () => {
    if (!selectedOrderId) return;
    updateMutation.mutate(
      {
        orderId: selectedOrderId,
        payload: { status: newStatus, note: statusNote.trim() || undefined },
      },
      {
        onSuccess: () => {
          toast.success("Order status updated");
        },
        onError: (error: unknown) => {
          const message =
            typeof error === "object" &&
            error !== null &&
            "error" in error &&
            typeof (error as { error?: string }).error === "string"
              ? (error as { error: string }).error
              : "Failed to update order status";
          toast.error(message);
        },
      },
    );
  };

  const currentStatus = orderDetail?.status;
  const allowedNextStatuses = currentStatus
    ? getAllowedNextStatuses(currentStatus)
    : [];
  const canUpdateStatus = allowedNextStatuses.length > 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ClipboardList className="size-6 text-primary" />
            Quản lý đơn hàng
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} đơn hàng</p>
        </div>
      </div>

      <div className="mb-6 flex max-w-xs items-center gap-2">
        <Label htmlFor="status-filter" className="whitespace-nowrap">
          Trạng thái
        </Label>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as "ALL" | OrderStatus);
            setPage(1);
          }}
        >
          <SelectTrigger id="status-filter">
            <SelectValue placeholder="Chọn trạng thái" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Checkout ID</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tổng tiền</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-25">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  Không tìm thấy đơn hàng nào
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>{order.checkoutOrderId}</TableCell>
                  <TableCell>{order.userId}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                  <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDetail(order)}
                    >
                      Chi tiết
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Dialog
        open={selectedOrderId !== null}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn hàng</DialogTitle>
            <DialogDescription>
              Xem chi tiết và cập nhật trạng thái đơn hàng
            </DialogDescription>
          </DialogHeader>

          {isOrderDetailLoading || !orderDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Order ID</p>
                  <p className="font-semibold">#{orderDetail.id}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">User ID</p>
                  <p className="font-semibold">{orderDetail.userId}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Current status
                  </p>
                  <Badge variant={getStatusBadgeVariant(orderDetail.status)}>
                    {getStatusLabel(orderDetail.status)}
                  </Badge>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Total amount</p>
                  <p className="font-semibold">
                    {formatCurrency(orderDetail.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderDetail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
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

              <div className="space-y-3 rounded-md border p-4">
                <h3 className="font-semibold">Update status</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-status">New status</Label>
                    <Select
                      value={newStatus}
                      onValueChange={(value) =>
                        setNewStatus(value as OrderStatus)
                      }
                      disabled={!canUpdateStatus}
                    >
                      <SelectTrigger id="new-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(canUpdateStatus
                          ? STATUS_UPDATE_OPTIONS.filter((status) =>
                              allowedNextStatuses.includes(status.value),
                            )
                          : STATUS_UPDATE_OPTIONS
                        ).map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!canUpdateStatus ? (
                      <p className="text-xs text-muted-foreground">
                        Cannot update status from{" "}
                        {currentStatus ? getStatusLabel(currentStatus) : "-"}.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-note">Note (optional)</Label>
                    <Input
                      id="status-note"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Reason for this update"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-4">
                <h3 className="font-semibold">Lịch sử cập nhật</h3>
                {isAuditLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : !audits || audits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có nhật ký kiểm toán nào.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {audits.map((audit) => (
                      <div
                        key={audit.id}
                        className="rounded-md border p-3 text-sm"
                      >
                        <p className="font-medium">
                          {getStatusLabel(audit.previousStatus)} to{" "}
                          {getStatusLabel(audit.newStatus)}
                        </p>
                        <p className="text-muted-foreground">
                          Admin #{audit.adminUserId} at{" "}
                          {formatDateTime(audit.createdAt)}
                        </p>
                        {audit.note ? (
                          <p className="mt-1">{audit.note}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrderId(null)}>
              Đóng
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={
                updateMutation.isPending ||
                !selectedOrderId ||
                !canUpdateStatus ||
                !allowedNextStatuses.includes(newStatus)
              }
            >
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

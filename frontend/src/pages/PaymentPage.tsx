import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentById, usePaymentStatus, useCancelPayment } from "@/src/hooks/usePayment";
import { useRemoveCartItemsBulk } from "@/src/hooks/useCart";
import { useUserOrderDetail } from "@/src/hooks/useUserOrders";
import { cancelOrder } from "@/src/services/orderApi";
import { ArrowLeft, Loader2, QrCode, XCircle, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

function useCountdown(expiresAt: string | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setRemaining(0);
        onExpire();
      } else {
        setRemaining(Math.max(0, left));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return remaining;
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function PaymentPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const removeItemIdsParam = searchParams.get("removeItemIds");
  const removeItemIds = removeItemIdsParam
    ? removeItemIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];

  const id = paymentId ? parseInt(paymentId, 10) : null;

  const { data: payment, isLoading: paymentLoading, isError: paymentError } = usePaymentById(id);
  const { data: paymentStatus } = usePaymentStatus(id, !!id);
  const cancelPaymentMutation = useCancelPayment();
  const removeItemsBulkMutation = useRemoveCartItemsBulk();
  const { data: order } = useUserOrderDetail(payment?.orderId ?? null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const paymentCompletedRef = useRef(false);

  const handleExpire = async () => {
    if (paymentCompletedRef.current || !paymentId || !order) return;
    try {
      await cancelPaymentMutation.mutateAsync(parseInt(paymentId, 10));
      await cancelOrder(order.id);
      toast.info("Hết thời gian thanh toán, đơn hàng đã bị hủy");
      navigate("/orders");
    } catch {
    }
  };

  const remaining = useCountdown(payment?.expiresAt ?? null, handleExpire);

  const isCompleted = paymentStatus?.status === "PAID" || paymentStatus?.status === "CANCELLED";

  useEffect(() => {
    if (isCompleted) {
      paymentCompletedRef.current = true;
    }
  }, [isCompleted]);

  useEffect(() => {
    if (paymentStatus?.status === "PAID") {
      const cleanupAndNavigate = async () => {
        if (removeItemIds.length > 0) {
          try {
            await removeItemsBulkMutation.mutateAsync({ itemIds: removeItemIds });
          } catch {
            toast.warning("Không thể xóa giỏ hàng, vui lòng thử lại");
          }
        }
        toast.success("Thanh toán thành công!");
        navigate(`/orders/${payment?.orderId}`);
      };
      cleanupAndNavigate();
    } else if (paymentStatus?.status === "CANCELLED") {
      toast.info("Thanh toán đã bị hủy");
      navigate("/orders");
    }
  }, [paymentStatus?.status]);

  useEffect(() => {
    return () => {
      if (!paymentCompletedRef.current && paymentId) {
        const pid = parseInt(paymentId, 10);
        fetch(`${import.meta.env.VITE_PAYMENT_SERVICE_URL}/api/payments/${pid}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!paymentCompletedRef.current && paymentId) {
        const pid = parseInt(paymentId, 10);
        navigator.sendBeacon(
          `${import.meta.env.VITE_PAYMENT_SERVICE_URL}/api/payments/${pid}/cancel`
        );
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (paymentLoading) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </main>
    );
  }

  if (paymentError || !payment) {
    return (
      <main className="page-wrap px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <p className="text-lg text-muted-foreground">
            Không tìm thấy thông tin thanh toán
          </p>
          <Button
            variant="link"
            onClick={() => navigate("/orders")}
            className="mt-2"
          >
            Quay lại danh sách đơn hàng
          </Button>
        </div>
      </main>
    );
  }

  if (payment.status === "PAID" || payment.status === "CANCELLED") {
    return null;
  }

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      await cancelPaymentMutation.mutateAsync(parseInt(paymentId!, 10));
      if (order) {
        await cancelOrder(order.id);
      }
      paymentCompletedRef.current = true;
      navigate("/orders");
    } catch {
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(payment.paymentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="page-wrap px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/orders")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại
        </Button>

        <h1 className="text-2xl font-bold mb-6">Thanh toán QR</h1>

        <div className="rounded-lg border p-6 space-y-6">
          {payment.qrUrl ? (
            <div className="text-center space-y-4">
              <img
                src={payment.qrUrl}
                alt="QR Code thanh toán"
                className="mx-auto w-64 h-64 rounded-lg border"
              />
              <p className="text-sm text-muted-foreground">
                Mở app ngân hàng → Quét QR → Xác nhận
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="mx-auto w-64 h-64 rounded-lg border-2 border-dashed flex flex-col items-center justify-center bg-muted/50">
                <QrCode className="h-16 w-16 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Không có mã QR</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Mã thanh toán:</span>
            <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
              {payment.paymentCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sao chép"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <Separator />

          {remaining > 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-semibold text-lg">
                {formatTime(remaining)}
              </span>
              <span className="text-sm">còn lại để thanh toán</span>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mã đơn hàng</span>
              <span className="font-semibold">#{payment.checkoutOrderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge variant="secondary">Đang thanh toán</Badge>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Số tiền</span>
              <span className="tabular-nums">
                {formatCurrency(payment.amount)}
              </span>
            </div>
          </div>

          <Separator />

          <Button
            variant="outline"
            className="w-full"
            onClick={handleCancel}
            disabled={isProcessing || cancelPaymentMutation.isPending}
          >
            {cancelPaymentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang hủy...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Hủy thanh toán
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

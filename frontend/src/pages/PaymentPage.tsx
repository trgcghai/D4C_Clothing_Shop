import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useCountdownTimer } from "use-countdown-timer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePaymentById,
  usePaymentStatus,
  useCancelPayment,
} from "@/src/hooks/usePayment";
import { useRemoveCartItemsBulk } from "@/src/hooks/useCart";
import { useUserOrderDetail, useCancelOrder } from "@/src/hooks/useUserOrders";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import { buildCancelPaymentUrl } from "@/src/services/paymentApi";
import {
  ArrowLeft,
  Loader2,
  QrCode,
  XCircle,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const removeItemIdsParam = searchParams.get("removeItemIds");
  const removeItemIds = useMemo(() => {
    if (!removeItemIdsParam) return [];
    return removeItemIdsParam
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
  }, [removeItemIdsParam]);

  const id = paymentId ? parseInt(paymentId, 10) : null;

  const {
    data: payment,
    isLoading: paymentLoading,
    isError: paymentError,
  } = usePaymentById(id);
  const { data: paymentStatus } = usePaymentStatus(id, !!id);
  const cancelPaymentMutation = useCancelPayment();
  const cancelOrderMutation = useCancelOrder();
  const removeItemsBulkMutation = useRemoveCartItemsBulk();
  const { data: order } = useUserOrderDetail(payment?.orderId ?? null);

  const [copied, setCopied] = useState(false);
  const paymentCompletedRef = useRef(false);

  const isProcessing =
    cancelPaymentMutation.isPending || removeItemsBulkMutation.isPending;

  const handleCancelPayment = useCallback(
    async (reason: "user" | "expired") => {
      if (paymentCompletedRef.current || !paymentId) return;
      paymentCompletedRef.current = true;

      try {
        await cancelPaymentMutation.mutateAsync(parseInt(paymentId, 10));
        if (order) {
          await cancelOrderMutation.mutateAsync(order.id);
        }
        if (reason === "expired") {
          toast.info("Hết thời gian thanh toán, đơn hàng đã bị hủy");
        }
        navigate("/orders");
      } catch (error) {
        paymentCompletedRef.current = false;
        console.error("Failed to cancel payment:", error);
      }
    },
    [paymentId, order, cancelPaymentMutation, cancelOrderMutation, navigate],
  );

  const timerMs = payment?.expiresAt
    ? Math.max(0, new Date(payment.expiresAt).getTime() - Date.now())
    : 0;
  const { countdown, start } = useCountdownTimer({
    timer: timerMs,
    autostart: false,
    onExpire: () => handleCancelPayment("expired"),
  });

  // Start countdown only after payment data is loaded
  useEffect(() => {
    if (payment && !paymentCompletedRef.current) {
      start();
    }
  }, [payment]);

  useEffect(() => {
    const status = paymentStatus?.status;
    if (!status || status === "PENDING" || status === "EXPIRED") return;

    paymentCompletedRef.current = true;

    if (status === "PAID") {
      if (removeItemIds.length > 0) {
        removeItemsBulkMutation.mutate({ itemIds: removeItemIds }, {
          onSettled: () => {
            toast.success("Thanh toán thành công!");
            navigate(`/orders/${payment?.orderId}`);
          },
        });
      } else {
        toast.success("Thanh toán thành công!");
        navigate(`/orders/${payment?.orderId}`);
      }
    } else if (status === "CANCELLED") {
      toast.info("Thanh toán đã bị hủy");
      navigate("/orders");
    }
  }, [paymentStatus?.status, removeItemIds, payment?.orderId, removeItemsBulkMutation, navigate]);

  // Only cancel on actual tab/window close — NOT on component unmount
  // The previous cleanup effect caused immediate cancellation on React StrictMode double-mount
  useEffect(() => {
    const handler = () => {
      if (!paymentCompletedRef.current && paymentId) {
        const url = buildCancelPaymentUrl(parseInt(paymentId, 10));
        navigator.sendBeacon(url);
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
            <span className="text-sm text-muted-foreground">
              Mã thanh toán:
            </span>
            <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
              {payment.paymentCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sao chép"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <Separator />

          {countdown > 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-semibold text-lg">
                {`${Math.floor(countdown / 60000).toString().padStart(2, "0")}:${Math.floor((countdown % 60000) / 1000).toString().padStart(2, "0")}`}
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
            onClick={() => handleCancelPayment("user")}
            disabled={isProcessing}
          >
            {isProcessing ? (
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useBlocker,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CountdownTimer from "@/src/components/CountdownTimer";
import {
  usePaymentById,
  usePaymentStatus,
  useCancelPayment,
} from "@/src/hooks/usePayment";
import { useRemoveCartItemsBulk } from "@/src/hooks/useCart";
import {
  useUserOrderDetail,
  useCancelOrder,
  userOrderKeys,
} from "@/src/hooks/useUserOrders";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import { buildCancelPaymentUrl } from "@/src/services/paymentApi";
import {
  ArrowLeft,
  Loader2,
  QrCode,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function PaymentPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const removeItemIdsParam = searchParams.get("removeItemIds");
  const removeItemIds = useMemo(() => {
    if (!removeItemIdsParam) return [];
    return removeItemIdsParam
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
  }, [removeItemIdsParam]);

  const id = paymentId ? Number.parseInt(paymentId, 10) : null;

  const {
    data: payment,
    isLoading: paymentLoading,
    isError: paymentError,
  } = usePaymentById(id);
  const { data: paymentStatus } = usePaymentStatus(id, !!id);
  const { mutateAsync: cancelPayment, isPending: isCancelingPayment } =
    useCancelPayment();
  const { mutateAsync: cancelOrder } = useCancelOrder();
  const { mutateAsync: removeItemsBulk, isPending: isRemovingItems } =
    useRemoveCartItemsBulk();
  const { data: order } = useUserOrderDetail(payment?.orderId ?? null);

  const [copied, setCopied] = useState(false);
  const paymentCompletedRef = useRef(false);

  const isProcessing = isCancelingPayment || isRemovingItems;

  const handleCancelPayment = useCallback(
    async (reason: "user" | "expired", skipNavigate = false) => {
      if (paymentCompletedRef.current || !paymentId) return;
      paymentCompletedRef.current = true;

      try {
        await cancelPayment(Number.parseInt(paymentId, 10));
      } catch (error) {
        // 409 = already expired/cancelled — treat as soft success
        console.error("Cancel payment error (may be already expired):", error);
      }

      try {
        if (order) {
          await cancelOrder(order.id);
        }
      } catch (error) {
        // 400 = already cancelled — treat as soft success
        console.error("Cancel order error (may be already cancelled):", error);
      }

      if (reason === "expired") {
        toast.info("Hết thời gian thanh toán, đơn hàng đã bị hủy");
      }
      if (!skipNavigate) {
        navigate("/orders");
      }
    },
    [paymentId, order, cancelPayment, cancelOrder, navigate],
  );

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !paymentCompletedRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const confirmed = window.confirm(
        "Bạn đang trong quá trình thanh toán. Nếu rời đi, đơn hàng sẽ bị hủy sau 5 phút. Tiếp tục?",
      );
      if (confirmed) {
        handleCancelPayment("user", true).then(() => blocker.proceed());
      } else {
        blocker.reset();
      }
    }
  }, [blocker.state, blocker.proceed, blocker.reset, handleCancelPayment]);

  const handleExpire = useCallback(() => {
    handleCancelPayment("expired");
  }, [handleCancelPayment]);

  useEffect(() => {
    if (paymentCompletedRef.current) return;

    const status = paymentStatus?.status;
    if (!status || status === "PENDING" || status === "EXPIRED") return;

    paymentCompletedRef.current = true;

    if (status === "PAID") {
      if (removeItemIds.length > 0) {
        removeItemsBulk({ itemIds: removeItemIds })
          .then(() => {
            if (payment?.orderId) {
              queryClient.invalidateQueries({
                queryKey: userOrderKeys.detail(payment.orderId),
              });
            }
            toast.success("Thanh toán thành công!");
            navigate(`/orders/${payment.orderId}`);
          })
          .catch(() => {
            if (payment?.orderId) {
              queryClient.invalidateQueries({
                queryKey: userOrderKeys.detail(payment.orderId),
              });
            }
            toast.success("Thanh toán thành công!");
            navigate(`/orders/${payment.orderId}`);
          });
      } else {
        if (payment?.orderId) {
          queryClient.invalidateQueries({
            queryKey: userOrderKeys.detail(payment.orderId),
          });
        }
        toast.success("Thanh toán thành công!");
        navigate(`/orders/${payment.orderId}`);
      }
    } else if (status === "CANCELLED") {
      toast.info("Thanh toán đã bị hủy");
      navigate("/orders");
    }
  }, [
    paymentStatus?.status,
    removeItemIds,
    payment?.orderId,
    navigate,
    removeItemsBulk,
    queryClient,
  ]);

  // Only cancel on actual tab/window close — NOT on component unmount
  // The previous cleanup effect caused immediate cancellation on React StrictMode double-mount
  useEffect(() => {
    const handler = () => {
      if (!paymentCompletedRef.current && paymentId) {
        const url = buildCancelPaymentUrl(Number.parseInt(paymentId, 10));
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

  if (payment.status === "PAID") {
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

          {payment.status === "EXPIRED" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Mã QR đã hết hạn. Vui lòng tạo đơn hàng mới.
              </AlertDescription>
            </Alert>
          )}

          {payment.status === "CANCELLED" && (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Thanh toán đã bị hủy.
              </AlertDescription>
            </Alert>
          )}

          {payment.status === "PENDING" && (
            <CountdownTimer
              key={payment.expiresAt}
              expiresAt={payment.expiresAt}
              onExpire={handleExpire}
            />
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

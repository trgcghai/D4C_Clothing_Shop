import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  useCart,
  usePartialCheckout,
  useRemoveCartItemsBulk,
} from "@/src/hooks/useCart";
import { useCreatePayment } from "@/src/hooks/usePayment";
import { deductStock, restoreStock } from "@/src/services/productApi";
import { formatCurrency } from "@/src/lib/currencyFormatter";
import { ArrowLeft, Loader2, QrCode, Banknote } from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import {
  useCancelOrder,
  useCreateOrderFromCheckout,
} from "@/src/hooks/useUserOrders";
import { useStore } from "@/src/store";
import type { PaymentMethod } from "@/src/services/paymentApi";
import AddressForm from "@/src/components/profile/AddressForm";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { data: cart, isLoading, isError } = useCart();
  const partialCheckoutMutation = usePartialCheckout();
  const removeItemsBulkMutation = useRemoveCartItemsBulk();
  const createOrderFromCheckoutMutation = useCreateOrderFromCheckout();
  const cancelOrderMutation = useCancelOrder();
  const createPaymentMutation = useCreatePayment();
  const [method, setMethod] = useState<PaymentMethod>("QR");

  const isProcessing =
    partialCheckoutMutation.isPending ||
    createOrderFromCheckoutMutation.isPending ||
    createPaymentMutation.isPending;

  const { user } = useStore((state) => state);

  const hasAddress = !!(user?.street && user?.ward && user?.province);

  const [searchParams] = useSearchParams();
  const buyNowItemId = searchParams.get("buyNowItemId");
  const buyNowQty = searchParams.get("buyNowQty");
  const selectedIdsParam = searchParams.get("selectedIds");

  const filteredItems = useMemo(() => {
    if (!cart) return [];

    if (buyNowItemId) {
      const id = Number(buyNowItemId);
      if (isNaN(id)) return [];
      const item = cart.items.find((i) => i.id === id);
      if (!item) return [];
      const qty = buyNowQty
        ? Math.min(Number(buyNowQty), item.quantity)
        : item.quantity;
      return [{ ...item, quantity: qty, subtotal: item.price * qty }];
    }

    if (selectedIdsParam?.trim()) {
      const ids = selectedIdsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
      if (ids.length === 0) return [];
      return cart.items.filter((item) => ids.includes(item.id));
    }

    return cart.items;
  }, [cart, buyNowItemId, buyNowQty, selectedIdsParam]);

  const filteredTotal = filteredItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const itemIdsForCheckout = filteredItems.map((item) => item.id);

  if (isLoading) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted" />
          ))}
        </div>
      </main>
    );
  }

  if (isError || !cart || cart.items.length === 0) {
    return (
      <main className="page-wrap px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <p className="text-lg text-muted-foreground">
            Giỏ hàng trống hoặc không thể tải
          </p>
          <Button
            variant="link"
            onClick={() => navigate("/cart")}
            className="mt-2"
          >
            Quay lại giỏ hàng
          </Button>
        </div>
      </main>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <main className="page-wrap px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <p className="text-lg text-muted-foreground">
            Không tìm thấy sản phẩm được chọn
          </p>
          <Button
            variant="link"
            onClick={() => navigate("/cart")}
            className="mt-2"
          >
            Quay lại giỏ hàng
          </Button>
        </div>
      </main>
    );
  }

  const handleConfirm = async () => {
    if (isProcessing) return;

    const deductedItems: { variantId: string; quantity: number }[] = [];
    let orderCreated = false;
    let createdOrderId: number | null = null;

    if (!user) return;
    if (itemIdsForCheckout.length === 0) return;

    if (!hasAddress) {
      toast.error("Vui lòng cập nhật địa chỉ nhận hàng trước khi thanh toán");
      return;
    }

    try {
      const checkoutData = await partialCheckoutMutation.mutateAsync({
        itemIds: itemIdsForCheckout,
      });

      for (const item of checkoutData.items) {
        try {
          await deductStock(item.variantId, item.quantity);
          deductedItems.push({
            variantId: item.variantId,
            quantity: item.quantity,
          });
        } catch (deductError) {
          if (isAxiosError(deductError)) {
            const msg =
              deductError.response?.data?.message || "Không đủ tồn kho";
            toast.error(msg);
          } else {
            toast.error("Không đủ tồn kho");
          }
          return;
        }
      }

      const order = await createOrderFromCheckoutMutation.mutateAsync({
        orderId: checkoutData.orderId,
        items: checkoutData.items,
        totalAmount: checkoutData.totalAmount,
        paymentMethod: method,
        shippingStreet: user.street || "",
        shippingWard: user.ward || "",
        shippingProvince: user.province || "",
      });
      orderCreated = true;
      createdOrderId = order.id;

      if (method === "QR") {
        try {
          const payment = await createPaymentMutation.mutateAsync({
            orderId: order.id,
            checkoutOrderId: order.checkoutOrderId,
            amount: checkoutData.totalAmount,
            method: "QR",
          });
          // Pass item IDs to PaymentPage so it can remove them on success
          const idsParam = itemIdsForCheckout.join(",");
          navigate(`/payment/${payment.paymentId}?removeItemIds=${idsParam}`);
        } catch (paymentError) {
          await Promise.allSettled(
            deductedItems.map((item) =>
              restoreStock(item.variantId, item.quantity),
            ),
          );
          await cancelOrderMutation.mutateAsync(order.id);
          toast.error(
            "Tạo thanh toán thất bại, đơn hàng đã được hủy và tồn kho đã hoàn",
          );
          return;
        }
      } else {
        await removeItemsBulkMutation.mutateAsync({
          itemIds: itemIdsForCheckout,
        });
        toast.success(`Đơn hàng ${order.checkoutOrderId} đã được tạo!`);
        navigate(`/orders/${order.id}`);
      }
    } catch (error) {
      if (orderCreated && createdOrderId) {
        await Promise.allSettled(
          deductedItems.map((item) =>
            restoreStock(item.variantId, item.quantity),
          ),
        );
        await cancelOrderMutation.mutateAsync(createdOrderId);
      }
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Thanh toán thất bại";
        toast.error(msg);
      } else {
        toast.error("Thanh toán thất bại, vui lòng thử lại");
      }
    }
  };

  return (
    <main className="page-wrap px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/cart")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại giỏ hàng
        </Button>

        <h1 className="text-2xl font-bold mb-6">Thanh toán</h1>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Phương thức thanh toán</h2>
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer has-data-[state=checked]:border-primary">
                <RadioGroupItem value="QR" id="qr" />
                <Label
                  htmlFor="qr"
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <QrCode className="h-5 w-5" />
                  <div>
                    <p className="font-medium">QR Code (SePay)</p>
                    <p className="text-sm text-muted-foreground">
                      Quét mã QR để thanh toán
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer has-data-[state=checked]:border-primary">
                <RadioGroupItem value="CASH" id="cash" />
                <Label
                  htmlFor="cash"
                  className="flex items-center gap-3 cursor-pointer flex-1"
                >
                  <Banknote className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Tiền mặt</p>
                    <p className="text-sm text-muted-foreground">
                      Thanh toán khi nhận hàng
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <h2 className="text-lg font-semibold mt-6">Địa chỉ nhận hàng</h2>
            {hasAddress ? (
              <div className="rounded-lg border p-4 text-sm space-y-1">
                <p>{user?.street}</p>
                <p>{user?.ward}, {user?.province}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive mb-3">
                  Vui lòng cập nhật địa chỉ nhận hàng
                </p>
                <AddressForm user={user!} />
              </div>
            )}
          </div>

          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Đơn hàng</h2>
            <Separator />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="truncate mr-2">
                    {item.productName} ({item.color}, {item.size}) x
                    {item.quantity}
                  </span>
                  <span className="tabular-nums whitespace-nowrap">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Tổng cộng</span>
              <span className="tabular-nums">
                {formatCurrency(filteredTotal)}
              </span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirm}
              disabled={isProcessing || filteredItems.length === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Xác nhận thanh toán"
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

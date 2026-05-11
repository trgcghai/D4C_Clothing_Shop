import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  useCheckout,
  useClearCartAfterCheckout,
} from "@/src/hooks/useCart";
import { deductStock } from "@/src/services/productApi";
import { createOrderFromCheckout } from "@/src/services/orderApi";
import { ShoppingCart, Trash2, Minus, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";

const CartPage = () => {
  const navigate = useNavigate();
  const { data: cart, isLoading, isError, refetch } = useCart();
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const clearMutation = useClearCart();
  const checkoutMutation = useCheckout();
  const clearAfterCheckoutMutation = useClearCartAfterCheckout();

  const [editingQty, setEditingQty] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  if (isLoading) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-lg border p-4 animate-pulse">
              <div className="h-24 w-24 rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-3 w-1/4 bg-muted rounded" />
                <div className="h-6 w-20 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (isError || !cart) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-lg text-muted-foreground">Không thể tải giỏ hàng</p>
          <Button variant="link" onClick={() => refetch()} className="mt-2">
            Thử lại
          </Button>
        </div>
      </main>
    );
  }

  if (cart.items.length === 0) {
    return (
      <main className="page-wrap px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <Empty>
            <EmptyMedia>
              <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>Giỏ hàng trống</EmptyTitle>
            <EmptyDescription>
              Hãy thêm sản phẩm yêu thích vào giỏ hàng của bạn.
            </EmptyDescription>
            <EmptyContent>
              <Button asChild className="mt-4">
                <Link to="/products">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Tiếp tục mua sắm
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </main>
    );
  }

  const handleQtyChange = (itemId: number, value: string) => {
    setEditingQty((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleQtySubmit = (itemId: number) => {
    const qty = parseInt(editingQty[itemId] || "0", 10);
    if (isNaN(qty) || qty < 0) return;
    updateMutation.mutate({ itemId, payload: { quantity: qty } });
    setEditingQty((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleIncrement = (item: (typeof cart.items)[0]) => {
    updateMutation.mutate({
      itemId: item.id,
      payload: { quantity: item.quantity + 1 },
    });
  };

  const handleDecrement = (item: (typeof cart.items)[0]) => {
    if (item.quantity <= 1) {
      removeMutation.mutate(item.id);
    } else {
      updateMutation.mutate({
        itemId: item.id,
        payload: { quantity: item.quantity - 1 },
      });
    }
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      // Step 1: Checkout từ CartService (validate stock)
      const checkoutData = await checkoutMutation.mutateAsync();

      // Step 2: Deduct stock cho từng item
      for (const item of checkoutData.items) {
        try {
          await deductStock(item.variantId, item.quantity);
        } catch (deductError) {
          if (isAxiosError(deductError)) {
            const msg = deductError.response?.data?.message || "Không đủ tồn kho";
            toast.error(msg);
          } else {
            toast.error("Không đủ tồn kho, vui lòng kiểm tra lại giỏ hàng");
          }
          setIsProcessing(false);
          return;
        }
      }

      // Step 3: Tạo order
      const order = await createOrderFromCheckout({
        orderId: checkoutData.orderId,
        items: checkoutData.items,
        totalAmount: checkoutData.totalAmount,
      });

      // Step 4: Clear cart
      await clearAfterCheckoutMutation.mutateAsync();

      // Step 5: Success
      toast.success(`Đơn hàng ${order.checkoutOrderId} đã được tạo thành công!`);
      navigate("/orders");
    } catch (error) {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Thanh toán thất bại";
        toast.error(msg);
      } else {
        toast.error("Thanh toán thất bại, vui lòng thử lại");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="page-wrap px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Giỏ hàng</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {cart.totalItems} sản phẩm
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/products">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tiếp tục mua sắm
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Xóa giỏ hàng
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30"
              >
                {/* Product Image Placeholder */}
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ShoppingCart className="h-8 w-8" />
                </div>

                {/* Item Details */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${item.variantId}`}
                        className="font-medium hover:text-primary transition-colors truncate block"
                      >
                        {item.productName}
                      </Link>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.color}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {item.size}
                        </Badge>
                        {item.sku && (
                          <Badge variant="outline" className="text-xs">
                            {item.sku}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>

                  {/* Price + Quantity */}
                  <div className="flex items-center justify-between mt-auto">
                    <p className="font-semibold tabular-nums">
                      {item.price.toLocaleString("vi-VN")}₫
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-md border overflow-hidden">
                        <button
                          onClick={() => handleDecrement(item)}
                          disabled={updateMutation.isPending}
                          className="flex h-8 w-8 items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input
                          type="number"
                          min={0}
                          value={editingQty[item.id] ?? item.quantity}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          onBlur={() => handleQtySubmit(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleQtySubmit(item.id);
                          }}
                          className="h-8 w-12 rounded-none border-x text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => handleIncrement(item)}
                          disabled={updateMutation.isPending}
                          className="flex h-8 w-8 items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="font-semibold tabular-nums min-w-[80px] text-right">
                      {item.subtotal.toLocaleString("vi-VN")}₫
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-lg border p-6 space-y-4">
              <h2 className="text-lg font-semibold">Tổng đơn hàng</h2>
              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tạm tính ({cart.totalItems} sản phẩm)</span>
                  <span>{cart.totalAmount.toLocaleString("vi-VN")}₫</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Phí vận chuyển</span>
                  <span className="text-green-600">Miễn phí</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Tổng cộng</span>
                <span className="tabular-nums">
                  {cart.totalAmount.toLocaleString("vi-VN")}₫
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={isProcessing || cart.items.length === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  "Thanh toán"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Giá đã bao gồm VAT (nếu có).
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CartPage;

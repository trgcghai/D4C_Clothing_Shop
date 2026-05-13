import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
} from "@/src/hooks/useCart";
import { useCartSelection } from "@/src/hooks/useCartSelection";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  Loader2,
} from "lucide-react";

const CartPage = () => {
  const navigate = useNavigate();
  const { data: cart, isLoading, isError, refetch } = useCart();
  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveCartItem();
  const clearMutation = useClearCart();

  const cartItemIds = useMemo(() => cart.items.map((item) => item.id), [cart.items]);
  const {
    selectedIds,
    toggleItem,
    selectAll,
    deselectAll,
    isAllSelected,
    isSomeSelected,
  } = useCartSelection(cartItemIds);

  const selectedItems = cart.items.filter((item) => selectedIds.includes(item.id));
  const selectedTotal = selectedItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );
  const selectedItemCount = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const [editingQty, setEditingQty] = useState<Record<number, string>>({});

  if (isLoading) {
    return (
      <main className="page-wrap px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-lg border p-4 animate-pulse"
            >
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
          <p className="text-lg text-muted-foreground">
            Không thể tải giỏ hàng
          </p>
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
    if (qty === 0) {
      removeMutation.mutate(itemId);
    } else {
      updateMutation.mutate({ itemId, payload: { quantity: qty } });
    }
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

  const handleCheckout = () => {
    if (selectedIds.length === 0) return;
    const idsParam = selectedIds.join(",");
    navigate(`/checkout?selectedIds=${idsParam}`);
  };

  return (
    <main className="page-wrap px-4 py-10">
      <div className="mx-auto">
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
              variant="outline"
              size="sm"
              onClick={isAllSelected ? deselectAll : selectAll}
            >
              {isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </Button>
            <Button
              variant="destructive"
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
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.id}
                className={`flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/30 ${
                  selectedIds.includes(item.id) ? "bg-muted/20" : ""
                }`}
              >
                <div className="flex items-center">
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                </div>
                <Link to={`/products/${item.productId}`} className="flex h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ShoppingCart className="h-8 w-8" />
                    </div>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${item.productId}`}
                        className="font-normal hover:text-primary transition-colors truncate block"
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
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <p className="text-sm text-muted-foreground flex items-center">
                      Đơn giá:
                      <span className="font-semibold tabular-nums text-base inline-block ml-1">
                        {item.price.toLocaleString("vi-VN")}₫
                      </span>
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground flex items-center">
                        Số lượng
                      </span>
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
                          min={1}
                          value={editingQty[item.id] ?? item.quantity}
                          onChange={(e) =>
                            handleQtyChange(item.id, e.target.value)
                          }
                          onBlur={() => handleQtySubmit(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleQtySubmit(item.id);
                          }}
                          className="h-8 w-12 rounded-none border-t-0 border-b-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

                    <p className="text-sm text-muted-foreground flex items-center min-w-20 text-right">
                      Tổng cộng:
                      <span className="font-semibold tabular-nums inline-block ml-1 text-base">
                        {item.subtotal.toLocaleString("vi-VN")}₫
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-lg border p-6 space-y-4">
              <h2 className="text-lg font-semibold">Tổng đơn hàng</h2>
              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tạm tính ({selectedItemCount} sản phẩm)</span>
                  <span>{selectedTotal.toLocaleString("vi-VN")}₫</span>
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
                  {selectedTotal.toLocaleString("vi-VN")}₫
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={selectedIds.length === 0}
              >
                Thanh toán
              </Button>

              {selectedIds.length === 0 && (
                <p className="text-xs text-destructive text-center">
                  Vui lòng chọn ít nhất một sản phẩm để thanh toán.
                </p>
              )}

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

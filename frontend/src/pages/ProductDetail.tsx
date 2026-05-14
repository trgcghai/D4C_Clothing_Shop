import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { useProductById, useRelatedProducts } from "../hooks/useProducts";
import { useAddToCart } from "../hooks/useCart";
import { useAuth } from "../store";
import { Shirt, Minus, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ProductDetail = () => {
  const { productId } = useParams<{ productId: string }>();

  if (!productId) {
    return (
      <div className="page-wrap px-4 py-20 text-center">Product not found</div>
    );
  }

  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link
          to="/products"
          className="hover:text-foreground transition-colors"
        >
          Sản phẩm
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Chi tiết</span>
      </nav>

      <ProductDetailContent productId={productId} />
      <Separator className="my-10" />
      <RelatedProducts productId={productId} />
    </main>
  );
};

function ProductDetailContent({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: product, isLoading, isError } = useProductById(productId);
  const addToCart = useAddToCart();

  const allColors = useMemo(
    () => Array.from(new Set(product?.variants?.map((v) => v.color) || [])),
    [product],
  );
  const allSizes = useMemo(
    () =>
      Array.from(new Set(product?.variants?.map((v) => v.size) || [])).sort(),
    [product],
  );

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [purchaseQty, setPurchaseQty] = useState(1);

  const getVariantQty = (c: string, s: string) =>
    product?.variants?.find((v) => v.color === c && v.size === s)?.quantity ||
    0;

  const selectedVariant = useMemo(() => {
    if (!product?.variants || !selectedColor || !selectedSize) return null;
    return (
      product.variants.find(
        (v) => v.color === selectedColor && v.size === selectedSize,
      ) ?? null
    );
  }, [product, selectedColor, selectedSize]);

  const totalStock = useMemo(
    () =>
      product?.variants?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0,
    [product],
  );

  const maxQty = selectedVariant
    ? Number(selectedVariant.quantity)
    : totalStock;
  const canBuy = !!selectedVariant && Number(selectedVariant.quantity) > 0;

  if (isLoading) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square rounded-xl bg-muted">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          Không tìm thấy sản phẩm
        </p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/products">Quay lại danh sách</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Shirt className="h-12 w-12" />
          </div>
        )}
        {product.isFeatured && (
          <Badge className="absolute top-3 left-3" variant="default">
            Featured
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <Badge variant="outline" className="mb-2">
            {product.category || "---"}
          </Badge>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-2xl font-semibold mt-2 tabular-nums">
            {product.price.toLocaleString("vi-VN")}₫
          </p>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-1 text-muted-foreground">
            Thương hiệu
          </h3>
          <p className="text-sm font-medium">{product.brand}</p>
        </div>

        {allColors.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">
              Màu sắc
              {selectedColor && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {selectedColor}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {allColors.map((color) => {
                const isSelected = selectedColor === color;
                const qty = selectedSize
                  ? getVariantQty(color, selectedSize)
                  : product.variants
                      ?.filter((v) => v.color === color)
                      .reduce((s, v) => s + Number(v.quantity), 0) || 0;
                const outOfStock = qty === 0;
                return (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(isSelected ? null : color);
                      setPurchaseQty(1);
                    }}
                    disabled={outOfStock}
                    className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : outOfStock
                          ? "cursor-not-allowed border-muted bg-muted/50 text-muted-foreground line-through"
                          : "hover:border-primary/50"
                    }`}
                  >
                    {color}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {allSizes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">
              Kích thước
              {selectedSize && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {selectedSize}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {allSizes.map((size) => {
                const isSelected = selectedSize === size;
                const qty = selectedColor
                  ? getVariantQty(selectedColor, size)
                  : product.variants
                      ?.filter((v) => v.size === size)
                      .reduce((s, v) => s + Number(v.quantity), 0) || 0;
                const outOfStock = qty === 0;
                return (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(isSelected ? null : size);
                      setPurchaseQty(1);
                    }}
                    disabled={outOfStock}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : outOfStock
                          ? "cursor-not-allowed border-muted bg-muted/50 text-muted-foreground line-through"
                          : "hover:border-primary/50"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedVariant ? (
          <p className="text-sm font-medium text-green-600">
            Còn lại {selectedVariant.quantity} sản phẩm
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tổng tồn kho: <span className="font-medium">{totalStock}</span> sản
            phẩm
          </p>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Số lượng</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                onClick={() => setPurchaseQty(Math.max(1, purchaseQty - 1))}
                disabled={purchaseQty <= 1}
                className="flex h-10 w-10 items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
                aria-label="Giảm số lượng"
              >
                <Minus className="size-3.5" />
              </button>
              <div className="flex h-10 w-12 items-center justify-center border-x text-sm font-medium tabular-nums">
                {purchaseQty}
              </div>
              <button
                onClick={() =>
                  setPurchaseQty(Math.min(maxQty, purchaseQty + 1))
                }
                disabled={purchaseQty >= maxQty}
                className="flex h-10 w-10 items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
                aria-label="Tăng số lượng"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">
              {maxQty > 0 ? `Tối đa ${maxQty}` : "Hết hàng"}
            </span>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="lg"
              disabled={!canBuy || addToCart.isPending}
              onClick={() => {
                if (!selectedVariant) return;
                if (!isAuthenticated) {
                  toast.info("Vui lòng đăng nhập để thêm vào giỏ hàng");
                  navigate("/signin");
                  return;
                }
                addToCart.mutate(
                  {
                    productId,
                    variantId: selectedVariant.id!,
                    quantity: purchaseQty,
                  },
                  {
                    onSuccess: () => setPurchaseQty(1),
                  },
                );
              }}
            >
              {addToCart.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang thêm...
                </>
              ) : !selectedColor || !selectedSize ? (
                "Chọn màu & size"
              ) : !canBuy ? (
                "Hết hàng"
              ) : (
                "Thêm vào giỏ hàng"
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={!canBuy || addToCart.isPending}
              onClick={() => {
                if (!selectedVariant) return;
                if (!isAuthenticated) {
                  toast.info("Vui lòng đăng nhập để mua hàng");
                  navigate("/signin");
                  return;
                }
                addToCart.mutate(
                  {
                    productId,
                    variantId: selectedVariant.id!,
                    quantity: purchaseQty,
                  },
                  {
                    onSuccess: (cart) => {
                      setPurchaseQty(1);
                      const addedItem = cart.items.find(
                        (item) => item.variantId === selectedVariant.id,
                      );
                      if (addedItem) {
                        navigate(`/checkout?buyNowItemId=${addedItem.id}&buyNowQty=${purchaseQty}`);
                      } else {
                        navigate("/checkout");
                      }
                    },
                  },
                );
              }}
            >
              Mua ngay
            </Button>
          </div>

          {(!selectedColor || !selectedSize) && (
            <p className="text-xs text-destructive">
              Vui lòng chọn Màu sắc và Kích thước để tiến hành mua hàng.
            </p>
          )}
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-2">Mô tả</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description || "Chưa có mô tả."}
          </p>
        </div>

        {product.tags && product.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedProducts({ productId }: { productId: string }) {
  const { data: related, isLoading } = useRelatedProducts(productId);

  if (!related || related.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">Sản phẩm liên quan</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))
          : related.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
      </div>
    </section>
  );
}

export default ProductDetail;

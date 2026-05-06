import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { useProductById, useRelatedProducts } from "../hooks/useProducts";
import { Shirt } from "lucide-react";

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
  const { data: product, isLoading, isError } = useProductById(productId);

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

      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="mb-2">
            {product.category}
          </Badge>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-2xl font-semibold mt-2 tabular-nums">
            {product.price.toLocaleString("vi-VN")}₫
          </p>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-2">Mô tả</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description || "Chưa có mô tả."}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Thương hiệu</h3>
          <p className="text-sm">{product.brand}</p>
        </div>

        {product.colors && product.colors.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Màu sắc</h3>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <Badge key={color} variant="secondary">
                  {color}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {product.stock && product.stock.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Kích thước</h3>
            <div className="flex flex-wrap gap-2">
              {product.stock
                .filter((s) => s.quantity > 0)
                .map((s) => (
                  <Badge key={s.size} variant="outline">
                    {s.size}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button size="lg" className="flex-1">
            Thêm vào giỏ hàng
          </Button>
          <Button variant="outline" size="lg">
            Mua ngay
          </Button>
        </div>
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

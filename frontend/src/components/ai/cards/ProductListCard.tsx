import React from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  brand?: string;
}

interface ProductListCardProps {
  products: Product[];
}

const ProductListCard: React.FC<ProductListCardProps> = ({ products }) => {
  const navigate = useNavigate();

  if (!products || products.length === 0) return null;

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {products.map((product) => (
        <div
          key={product.id}
          className="group relative min-w-[160px] max-w-[160px] cursor-pointer overflow-hidden rounded-xl border bg-card p-2 shadow-sm transition-all hover:shadow-md"
          onClick={() => navigate(`/products/${product.id}`)}
        >
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>
          <div className="mt-2">
            <h4 className="line-clamp-1 text-xs font-medium">{product.name}</h4>
            <p className="mt-1 text-sm font-bold text-primary">
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(product.price)}
            </p>
          </div>
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex size-7 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm">
              <ExternalLink className="size-3.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductListCard;

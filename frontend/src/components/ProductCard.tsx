import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "../services/productApi";
import { Shirt } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      <Card className="overflow-hidden transition-shadow hover:shadow-md py-0">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Shirt className="h-12 w-12" />
            </div>
          )}
          {product.isFeatured && (
            <Badge className="absolute top-2 left-2" variant="default">
              Featured
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground truncate">
            {product.category}
          </p>
          <h3 className="text-sm font-medium mt-1 truncate group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="text-base font-semibold mt-1 tabular-nums">
            {product.price.toLocaleString("vi-VN")}₫
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-muted">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-5 w-20" />
      </CardContent>
    </Card>
  );
}

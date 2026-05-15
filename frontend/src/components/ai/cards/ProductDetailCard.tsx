import React from "react";
import { Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  variants?: any[];
}

interface ProductDetailCardProps {
  product: Product;
}

const ProductDetailCard: React.FC<ProductDetailCardProps> = ({ product }) => {
  const navigate = useNavigate();
  if (!product) return null;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="text-base font-bold text-foreground line-clamp-2">{product.name}</h4>
          <p className="mt-1 text-lg font-black text-primary">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
          <Info className="size-6" />
        </div>
      </div>
      
      {product.description && (
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {product.description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 rounded-lg text-xs"
          onClick={() => navigate(`/products/${product.id}`)}
        >
          Xem chi tiết
        </Button>
        <Button 
          size="sm" 
          className="h-9 gap-1.5 rounded-lg text-xs"
          onClick={() => navigate(`/products/${product.id}`)} // navigate to detail page to select variant
        >
          <Plus className="size-3.5" />
          Mua ngay
        </Button>
      </div>
    </div>
  );
};

export default ProductDetailCard;

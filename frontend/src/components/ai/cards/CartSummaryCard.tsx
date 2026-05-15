import React from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CartSummaryCardProps {
  total: number;
  count: number;
}

const CartSummaryCard: React.FC<CartSummaryCardProps> = ({ total, count }) => {
  const navigate = useNavigate();

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Giỏ hàng của bạn</h4>
            <p className="text-xs text-muted-foreground">{count} sản phẩm</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total)}
          </p>
        </div>
      </div>
      
      <Button 
        size="sm" 
        className="w-full gap-2 rounded-lg"
        onClick={() => navigate("/cart")}
      >
        Xem giỏ hàng
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
};

export default CartSummaryCard;

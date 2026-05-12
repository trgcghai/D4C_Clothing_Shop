import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/src/hooks/useCart";
import { cn } from "@/src/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CartIcon = () => {
  const { data: cart, isLoading } = useCart();
  const totalItems = cart?.totalItems ?? 0;

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link to="/cart" aria-label="Giỏ hàng">
        <ShoppingCart className="h-5 w-5" />
        {totalItems > 0 && !isLoading && (
          <Badge
            variant="destructive"
            className={cn(
              "absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] font-bold rounded-full",
              totalItems > 99 && "text-[8px]"
            )}
          >
            {totalItems > 99 ? "99+" : totalItems}
          </Badge>
        )}
      </Link>
    </Button>
  );
};

export default CartIcon;

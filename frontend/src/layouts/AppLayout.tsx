import { Outlet, Link } from "react-router-dom";
import { getCurrentYear } from "@/src/lib/dateTimeFormatter";
import Header from "@/src/components/Header";
import AIChatBubble from "@/src/components/ai/AIChatBubble";

const AppLayout = () => {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <div className="mx-auto w-full max-w-7xl flex-1">
        <Outlet />
      </div>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-sm font-semibold">D4C Clothing Shop</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Khám phá phong cách của bạn.
              </p>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <Link to="/products" className="hover:text-foreground">
                Sản phẩm
              </Link>
              <Link to="/signin" className="hover:text-foreground">
                Đăng nhập
              </Link>
              <Link to="/signup" className="hover:text-foreground">
                Đăng ký
              </Link>
            </div>
          </div>
          <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
            © {getCurrentYear()} D4C. All rights reserved.
          </div>
        </div>
      </footer>
      <AIChatBubble />
    </div>
  );
};

export default AppLayout;

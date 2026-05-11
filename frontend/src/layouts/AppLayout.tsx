import { Outlet, Link, useLocation } from "react-router-dom";
import { cn } from "@/src/lib/utils";
import UserButton from "@/src/components/UserButton";
import CartIcon from "@/src/components/CartIcon";
import { useAuth } from "@/src/store";

const navLinks = [
  { to: "/", label: "Trang chủ" },
  { to: "/products", label: "Sản phẩm" },
];

const AppLayout = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-bold tracking-tight">
            D4C
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === to
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && <CartIcon />}
            <UserButton />
          </div>
        </div>
      </header>

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
            © {new Date().getFullYear()} D4C. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;

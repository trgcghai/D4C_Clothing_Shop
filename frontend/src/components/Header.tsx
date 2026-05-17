import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Home, ShoppingBag } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/store";
import UserButton from "@/src/components/UserButton";
import CartIcon from "@/src/components/CartIcon";
import SearchBar from "@/src/components/SearchBar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const navLinks = [
  { to: "/", label: "Trang chủ", icon: Home },
  { to: "/products", label: "Sản phẩm", icon: ShoppingBag },
];

const Header = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span>D4C</span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Điều hướng chính"
        >
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                location.pathname === to
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden flex-1 items-center justify-end gap-2 md:flex">
          <SearchBar />
          {isAuthenticated && <CartIcon />}
          <UserButton />
        </div>

        <div className="flex items-center gap-1 md:hidden ml-auto">
          {isAuthenticated && <CartIcon />}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mở menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 sm:w-80">
              <SheetHeader className="px-1">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-1">
                <SearchBar />

                <nav
                  className="flex flex-col gap-1"
                  aria-label="Điều hướng di động"
                >
                  {navLinks.map(({ to, label, icon: Icon }) => (
                    <SheetClose asChild key={to}>
                      <Link
                        to={to}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted",
                          location.pathname === to
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                        {label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>

                <div className="border-t pt-4">
                  <UserButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;

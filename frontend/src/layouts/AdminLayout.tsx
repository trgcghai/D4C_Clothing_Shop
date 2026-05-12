import {
  Navigate,
  Outlet,
  useLocation,
  Link,
  useNavigate,
} from "react-router-dom";
import { useStore } from "../store";
import { cn } from "../lib/utils";
import { Package, LayoutGrid, Users, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/src/hooks/useAuth";

const navItems = [
  { to: "/admin/products", label: "Quản lý sản phẩm", icon: Package },
  { to: "/admin/categories", label: "Quản lý danh mục", icon: LayoutGrid },
  { to: "/admin/users", label: "Quản lý người dùng", icon: Users },
  { to: "/admin/orders", label: "Quản lý đơn hàng", icon: ClipboardList },
];

const AdminLayout = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const role = useStore((state) => state.role);
  const location = useLocation();
  const { mutate: signOut } = useSignOut();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut(undefined, {
      onSuccess: () => {
        navigate("/", { replace: true });
      },
    });
  };

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-muted/30">
        <div className="flex h-14 items-center border-b px-6">
          <Link to="/admin" className="text-lg font-bold">
            D4C Admin
          </Link>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                location.pathname.startsWith(to)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 w-full px-4">
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="w-full"
          >
            Dang xuat
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;

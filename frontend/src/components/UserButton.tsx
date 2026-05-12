import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/src/store";
import { ClipboardList, LogOut, User } from "lucide-react";

const UserButton = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/signin">Đăng nhập</Link>
        </Button>
        <Button size="sm" asChild>
          <Link to="/signup">Đăng ký</Link>
        </Button>
      </div>
    );
  }

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user.username[0].toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" asChild className="gap-2 px-2">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <AvatarImage src={user.avatar} alt={user.fullName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline-block text-sm font-medium">
              {user.fullName || user.username}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex items-center gap-3 p-2">
          <Avatar size="sm">
            <AvatarImage src={user.avatar} alt={user.fullName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.fullName || user.username}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <div className="border-t" />
        <div className="flex flex-col gap-1 p-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="justify-start gap-2"
          >
            <Link to="/profile">
              <User className="h-4 w-4" />
              Hồ sơ
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="justify-start gap-2"
          >
            <Link to="/orders">
              <ClipboardList className="h-4 w-4" />
              Đơn hàng của tôi
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="justify-start gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserButton;

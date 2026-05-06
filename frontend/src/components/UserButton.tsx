import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/src/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const UserButton = () => {
  const { isAuthenticated, user } = useAuth();

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

  return (
    <Button variant="ghost" size="sm" asChild className="gap-2 px-2">
      <Link to="/profile">
        <Avatar size="sm">
          <AvatarImage src={user.avatar} alt={user.fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden sm:inline-block text-sm font-medium">
          {user.fullName || user.username}
        </span>
      </Link>
    </Button>
  );
};

export default UserButton;

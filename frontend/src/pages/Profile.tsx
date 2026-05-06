import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/src/store";
import { useNavigate } from "react-router-dom";
import { useSignOut } from "@/src/hooks/useAuth";

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { mutate: signOut } = useSignOut();

  if (!isAuthenticated || !user) {
    return (
      <main className="page-wrap px-4 pb-10 pt-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Vui lòng đăng nhập để xem thông tin tài khoản
          </p>
          <Button variant="default" className="mt-4" asChild>
            <a href="/signin">Đăng nhập</a>
          </Button>
        </div>
      </main>
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

  const handleSignOut = () => {
    signOut(undefined, {
      onSuccess: () => {
        navigate("/", { replace: true });
      },
    });
  };

  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Thông tin tài khoản</h1>

        <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
          <Avatar className="size-20!">
            <AvatarImage src={user.avatar} alt={user.fullName} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{user.fullName}</h2>
            <p className="text-muted-foreground">@{user.username}</p>
          </div>
        </div>

        <Separator className="mb-8" />

        <div className="space-y-6">
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Họ tên" value={user.fullName} />
          <InfoRow label="Tên đăng nhập" value={user.username} />
          <InfoRow
            label="Số điện thoại"
            value={user.phoneNumber || "Chưa cập nhật"}
          />
        </div>

        <Separator className="my-8" />

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <a href="/">Quay lại trang chủ</a>
          </Button>
          <Button variant="destructive" onClick={handleSignOut}>
            Đăng xuất
          </Button>
        </div>
      </div>
    </main>
  );
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground min-w-35">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default Profile;

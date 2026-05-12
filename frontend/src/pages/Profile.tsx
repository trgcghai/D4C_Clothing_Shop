import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/src/store";
import ProfileInfoForm from "@/src/components/profile/ProfileInfoForm";
import ChangePasswordForm from "@/src/components/profile/ChangePasswordForm";

const Profile = () => {
  const { user, isAuthenticated } = useAuth();

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
  return (
    <main className="page-wrap px-4 pb-10 pt-8">
      <div className="mx-auto max-w-4xl">
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

        <Separator className="mb-6" />

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList>
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="password">Đổi mật khẩu</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <ProfileInfoForm user={user} />
          </TabsContent>

          <TabsContent value="password">
            <ChangePasswordForm />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default Profile;

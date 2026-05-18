import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/src/store";
import { useUploadAvatar } from "@/src/hooks/useAuth";
import { useRef } from "react";
import { AlertCircle, Camera, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ProfileInfoForm from "@/src/components/profile/ProfileInfoForm";
import ChangePasswordForm from "@/src/components/profile/ChangePasswordForm";

const Profile = () => {
  const { user, isAuthenticated } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    mutate: uploadAvatar,
    isPending: isUploading,
    error: uploadError,
  } = useUploadAvatar();

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    uploadAvatar(file);
    e.target.value = "";
  };

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

        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Chọn ảnh đại diện"
          />
          <div
            onClick={handleAvatarClick}
            className="relative cursor-pointer group"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleAvatarClick()}
            title="Nhấn để đổi ảnh đại diện"
          >
            {!isUploading && (
              <Avatar className="size-20! group-hover:opacity-70 transition-opacity">
                <AvatarImage src={user.avatar} alt={user.fullName} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            )}
            <Camera className="absolute bottom-0 right-0 size-5 bg-primary text-white rounded-full p-1 opacity-100 transition-opacity" />
          </div>
          {uploadError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {uploadError instanceof Error
                  ? uploadError.message
                  : "Không thể tải ảnh lên. Thử lại sau."}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-0.5">
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

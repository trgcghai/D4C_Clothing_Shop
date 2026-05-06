import { useState } from "react";
import { useChangePassword } from "@/src/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";

const ChangePasswordForm = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { mutate, isPending, error } = useChangePassword();
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setFieldErrors({});

    if (newPassword.length < 6) {
      setFieldErrors((prev) => ({
        ...prev,
        newPassword: "Mật khẩu mới phải có ít nhất 6 ký tự",
      }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: "Mật khẩu xác nhận không khớp",
      }));
      return;
    }

    mutate(
      { oldPassword, newPassword },
      {
        onSuccess: () => {
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="default" className="border-emerald-300 bg-emerald-50" role="status" aria-live="polite">
          <Check className="size-4 text-emerald-700" />
          <AlertDescription className="text-sm text-emerald-700">
            Đổi mật khẩu thành công
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cp-oldPassword">
          Mật khẩu hiện tại <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="cp-oldPassword"
            type={showOld ? "text" : "password"}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
            name="current-password"
            autoComplete="current-password"
            aria-required="true"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowOld(!showOld)}
            aria-label={showOld ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showOld ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-newPassword">
          Mật khẩu mới <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="cp-newPassword"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
            }}
            required
            minLength={6}
            name="new-password"
            autoComplete="new-password"
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.newPassword)}
            aria-describedby={
              fieldErrors.newPassword ? "cp-newPassword-error" : "cp-newPassword-hint"
            }
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowNew(!showNew)}
            aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {fieldErrors.newPassword ? (
          <p id="cp-newPassword-error" className="text-xs text-red-600" role="alert">
            {fieldErrors.newPassword}
          </p>
        ) : (
          <p id="cp-newPassword-hint" className="text-xs text-muted-foreground">
            Ít nhất 6 ký tự.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cp-confirmPassword">
          Xác nhận mật khẩu mới <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="cp-confirmPassword"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldErrors((prev) => ({
                ...prev,
                confirmPassword: undefined,
              }));
            }}
            required
            minLength={6}
            name="confirm-password"
            autoComplete="new-password"
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword
                ? "cp-confirmPassword-error"
                : "cp-confirmPassword-hint"
            }
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {fieldErrors.confirmPassword ? (
          <p id="cp-confirmPassword-error" className="text-xs text-red-600" role="alert">
            {fieldErrors.confirmPassword}
          </p>
        ) : (
          <p id="cp-confirmPassword-hint" className="text-xs text-muted-foreground">
            Phải khớp với mật khẩu mới.
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Đang cập nhật..." : "Đổi mật khẩu"}
      </Button>
    </form>
  );
};

export default ChangePasswordForm;

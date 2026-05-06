"use client";

import { useState } from "react";
import type { UserResponse } from "@/src/services/authApi";
import { useUpdateProfile } from "@/src/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Pencil, X } from "lucide-react";

interface ProfileInfoFormProps {
  user: UserResponse;
}

const ProfileInfoForm = ({ user }: ProfileInfoFormProps) => {
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || "");

  const { mutate, isPending, error } = useUpdateProfile();
  const [success, setSuccess] = useState(false);

  const handleCancel = () => {
    setEditMode(false);
    setFullName(user.fullName);
    setPhoneNumber(user.phoneNumber || "");
    setSuccess(false);
  };

  const handleSave = () => {
    setSuccess(false);
    mutate(
      { fullName, phoneNumber: phoneNumber || undefined },
      {
        onSuccess: () => {
          setEditMode(false);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        },
      },
    );
  };

  if (!editMode) {
    return (
      <div className="space-y-4">
        {success && (
          <Alert variant="default" className="border-emerald-300 bg-emerald-50">
            <Check className="size-4 text-emerald-700" />
            <AlertDescription className="text-sm text-emerald-700">
              Cập nhật thông tin thành công
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="text-sm font-medium text-muted-foreground min-w-35">
              Họ tên
            </span>
            <span className="text-sm">{user.fullName}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="text-sm font-medium text-muted-foreground min-w-35">
              Số điện thoại
            </span>
            <span className="text-sm">{user.phoneNumber || "Chưa cập nhật"}</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditMode(true)}
          className="mt-2"
        >
          <Pencil className="mr-1.5 size-3.5" />
          Chỉnh sửa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="profile-fullName">
            Họ tên <span className="text-destructive">*</span>
          </Label>
          <Input
            id="profile-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            aria-required="true"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-phoneNumber">Số điện thoại</Label>
          <Input
            id="profile-phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            aria-describedby="profile-phone-hint"
          />
          <p id="profile-phone-hint" className="text-xs text-muted-foreground">
            Tùy chọn. Từ 9-15 chữ số.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || !fullName.trim()}
        >
          {isPending ? "Đang lưu..." : "Lưu"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <X className="mr-1.5 size-3.5" />
          Hủy
        </Button>
      </div>
    </div>
  );
};

export default ProfileInfoForm;

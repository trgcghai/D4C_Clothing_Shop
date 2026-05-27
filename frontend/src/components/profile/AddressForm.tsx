import { useEffect, useState } from "react";
import type { UserResponse } from "@/src/services/authApi";
import { useUpdateAddress } from "@/src/hooks/useAuth";
import { useProvinces, useWards } from "@/src/hooks/useAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

interface AddressFormProps {
  user: UserResponse;
}

const AddressForm = ({ user }: AddressFormProps) => {
  const [editMode, setEditMode] = useState(false);
  const [street, setStreet] = useState(user.street || "");
  const [province, setProvince] = useState(user.province || "");
  const [ward, setWard] = useState(user.ward || "");

  const {
    data: provinces = [],
    isLoading: provincesLoading,
    error: provincesError,
  } = useProvinces();

  const selectedProvinceCode = provinces.find((p) => p.name === province)?.code;

  const { data: wards = [], isLoading: wardsLoading } =
    useWards(selectedProvinceCode);

  const { mutate, isPending, error } = useUpdateAddress();
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!editMode) {
      setStreet(user.street || "");
      setProvince(user.province || "");
      setWard(user.ward || "");
    }
  }, [user, editMode]);

  const handleCancel = () => {
    setEditMode(false);
    setStreet(user.street || "");
    setProvince(user.province || "");
    setWard(user.ward || "");
    setSuccess(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);

    if (!province) {
      toast.error("Vui lòng chọn tỉnh/thành phố");
      return;
    }

    if (!ward) {
      toast.error("Vui lòng chọn phường/xã");
      return;
    }

    if (!street.trim()) {
      toast.error("Vui lòng nhập số nhà, tên đường");
      return;
    }

    mutate(
      {
        street,
        ward,
        province,
      },
      {
        onSuccess: () => {
          setEditMode(false);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        },
      },
    );
  };

  if (provincesError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>Không tải được danh sách tỉnh/thành</AlertDescription>
      </Alert>
    );
  }

  if (!editMode) {
    const hasAddress = user.street || user.ward || user.province;
    return (
      <div className="space-y-4">
        {success && (
          <Alert
            variant="default"
            className="border-emerald-300 bg-emerald-50"
            role="status"
          >
            <Check className="size-4 text-emerald-700" />
            <AlertDescription className="text-sm text-emerald-700">
              Cập nhật địa chỉ thành công
            </AlertDescription>
          </Alert>
        )}

        {hasAddress ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-35">
                Tỉnh/TP
              </span>
              <span className="text-sm">{user.province}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-35">
                Phường/Xã
              </span>
              <span className="text-sm">{user.ward}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-35">
                Số nhà, đường
              </span>
              <span className="text-sm">{user.street}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa cập nhật địa chỉ</p>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditMode(true)}
          className="mt-2"
        >
          <Pencil className="mr-1.5 size-3.5" />
          {hasAddress ? "Chỉnh sửa" : "Thêm địa chỉ"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground">
            Tỉnh/Thành phố <span className="text-destructive">*</span>
          </Label>
          <Combobox
            value={province}
            onValueChange={(value) => {
              setProvince(value ?? "");
              setWard("");
            }}
          >
            <ComboboxInput
              placeholder={
                provincesLoading ? "Đang tải..." : "Tìm tỉnh/thành phố..."
              }
              disabled={provincesLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
            <ComboboxContent>
              <ComboboxList>
                {provinces.map((p) => (
                  <ComboboxItem
                    key={p.code}
                    value={p.name}
                    className="cursor-pointer"
                  >
                    <span>{p.name}</span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground">
            Phường/Xã <span className="text-destructive">*</span>
          </Label>
          <Combobox
            value={ward}
            onValueChange={(value) => setWard(value ?? "")}
            disabled={!province || wardsLoading}
          >
            <ComboboxInput
              placeholder={
                !province
                  ? "Chọn tỉnh/TP trước"
                  : wardsLoading
                    ? "Đang tải..."
                    : "Tìm phường/xã..."
              }
              disabled={!province || wardsLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
            <ComboboxContent>
              <ComboboxList>
                {wards.map((w) => (
                  <ComboboxItem
                    key={w.code}
                    value={w.name}
                    className="cursor-pointer"
                  >
                    <span>{w.name}</span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground" htmlFor="address-street">
            Số nhà, tên đường <span className="text-destructive">*</span>
          </Label>
          <Input
            id="address-street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="VD: 123 Nguyễn Huệ"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Check className="mr-1.5 size-3.5" />
              Lưu
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleCancel}
        >
          <X className="mr-1.5 size-3.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
};

export default AddressForm;

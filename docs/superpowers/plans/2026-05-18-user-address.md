# User Address — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add street/ward/province fields to user profile with cascading selects from Vietnam Provinces Open API v2.

**Architecture:** Add 3 String fields to User entity + 3 DTOs → update constructor calls in Controllers/Services → create AddressForm with province/ward selects + street input on Profile page.

**Tech Stack:** Spring Boot 3.3.1, Java 21, React 19, TypeScript, TanStack Query, Axios, Vietnam Provinces Open API v2.

---

## Backend (UserService)

### Task 1: Add fields to User entity

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java`

- [ ] **Step 1: Add street, ward, province fields**

Add after `phoneNumber` field (after line 29):

```java
    private String street;

    private String ward;

    private String province;
```

- [ ] **Step 2: Verify compile**

```powershell
cmd /c "cd UserService && mvnw compile"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```powershell
git add UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java
git commit -m "feat: add street, ward, province fields to User entity"
```

---

### Task 2: Add fields to DTOs

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/dto/UserResponse.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/dto/UpdateProfileRequest.java`
- Modify: `UserService/src/main/java/iuh/fit/UserService/domain/dto/JwtResponse.java`

- [ ] **Step 1: UserResponse.java — add 3 fields after avatar**

After `private String avatar;` (line 15):

```java
    private String street;
    private String ward;
    private String province;
```

- [ ] **Step 2: UpdateProfileRequest.java — add 3 fields after avatar**

After `private String avatar;` (line 22):

```java
    @Size(max = 255, message = "Street must be at most 255 characters")
    private String street;

    @Size(max = 255, message = "Ward must be at most 255 characters")
    private String ward;

    @Size(max = 255, message = "Province must be at most 255 characters")
    private String province;
```

- [ ] **Step 3: JwtResponse.java — add 3 fields after avatar**

After `private String avatar;` (line 16):

```java
    private String street;
    private String ward;
    private String province;
```

- [ ] **Step 4: Verify compile**

```powershell
cmd /c "cd UserService && mvnw compile"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 5: Commit**

```powershell
git add UserService/src/main/java/iuh/fit/UserService/domain/dto/UserResponse.java UserService/src/main/java/iuh/fit/UserService/domain/dto/UpdateProfileRequest.java UserService/src/main/java/iuh/fit/UserService/domain/dto/JwtResponse.java
git commit -m "feat: add street, ward, province to UserResponse, UpdateProfileRequest, JwtResponse"
```

---

### Task 3: Update constructor calls

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/UserController.java` — `toUserResponse()`
- Modify: `UserService/src/main/java/iuh/fit/UserService/Service/impl/AuthServiceImpl.java` — JwtResponse constructor
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java` — JwtResponse constructor

- [ ] **Step 1: UserController.toUserResponse() — add 3 params**

Replace lines 155-163:

```java
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getPhoneNumber(),
                user.getAvatar(),
                user.getStreet(),
                user.getWard(),
                user.getProvince(),
                user.getRole()
        );
```

- [ ] **Step 2: AuthServiceImpl — add 3 params to JwtResponse**

Replace lines 89-91:

```java
        JwtResponse jwtResponse = new JwtResponse(jwt, "Bearer", user.getId(), userDetails.getUsername(),
                user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(),
                user.getStreet(), user.getWard(), user.getProvince(),
                role, user.getEmailVerification());
```

- [ ] **Step 3: AuthController — add 3 params to JwtResponse**

Replace lines 109-111:

```java
                .body(new JwtResponse(newAccessToken, "Bearer", user.getId(), userDetails.getUsername(),
                        user.getEmail(), user.getFullName(), user.getPhoneNumber(), user.getAvatar(),
                        user.getStreet(), user.getWard(), user.getProvince(),
                        user.getRole().name(), user.getEmailVerification()));
```

- [ ] **Step 4: Verify compile + run backend tests**

```powershell
cmd /c "cd UserService && mvnw test -Dtest=UserControllerValidationTest,S3ServiceTest"
```

Expected: `BUILD SUCCESS`, all 14 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add UserService/src/main/java/iuh/fit/UserService/Controller/UserController.java UserService/src/main/java/iuh/fit/UserService/Service/impl/AuthServiceImpl.java UserService/src/main/java/iuh/fit/UserService/Controller/AuthController.java
git commit -m "feat: pass street/ward/province through UserResponse and JwtResponse constructors"
```

---

## Frontend

### Task 4: Create provinceApi.ts and useAddress.ts

**Files:**
- Create: `frontend/src/services/provinceApi.ts`
- Create: `frontend/src/hooks/useAddress.ts`

- [ ] **Step 1: Create provinceApi.ts**

```typescript
import axios from "axios";

export interface Province {
  name: string;
  code: number;
}

export interface Ward {
  name: string;
  code: number;
}

const BASE = "https://provinces.open-api.vn/api/v2";

export const getProvinces = async (): Promise<Province[]> =>
  axios.get(`${BASE}/`).then((res) => res.data);

export const getWards = async (provinceCode: number): Promise<Ward[]> =>
  axios
    .get(`${BASE}/p/${provinceCode}?depth=2`)
    .then((res) => res.data.wards);
```

- [ ] **Step 2: Create useAddress.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getProvinces, getWards } from "../services/provinceApi";

export function useProvinces() {
  return useQuery({
    queryKey: ["provinces"],
    queryFn: getProvinces,
    staleTime: Infinity,
  });
}

export function useWards(provinceCode: number | undefined) {
  return useQuery({
    queryKey: ["wards", provinceCode],
    queryFn: () => getWards(provinceCode!),
    enabled: !!provinceCode,
  });
}
```

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/services/provinceApi.ts frontend/src/hooks/useAddress.ts
git commit -m "feat: add provinceApi and useAddress hooks for Vietnam Provinces v2"
```

---

### Task 5: Create AddressForm component

**Files:**
- Create: `frontend/src/components/profile/AddressForm.tsx`

- [ ] **Step 1: Write AddressForm**

```typescript
import { useEffect, useState } from "react";
import type { UserResponse } from "@/src/services/authApi";
import { useUpdateProfile } from "@/src/hooks/useAuth";
import { useProvinces, useWards } from "@/src/hooks/useAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Pencil, X } from "lucide-react";

interface AddressFormProps {
  user: UserResponse;
}

const AddressForm = ({ user }: AddressFormProps) => {
  const [editMode, setEditMode] = useState(false);
  const [street, setStreet] = useState(user.street || "");
  const [province, setProvince] = useState(user.province || "");
  const [ward, setWard] = useState(user.ward || "");

  const { data: provinces = [], isLoading: provincesLoading, error: provincesError } = useProvinces();
  const selectedProvinceCode = provinces.find((p) => p.name === province)?.code;
  const { data: wards = [], isLoading: wardsLoading } = useWards(selectedProvinceCode);

  const { mutate, isPending, error } = useUpdateProfile();
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

    mutate(
      { street: street || undefined, ward: ward || undefined, province: province || undefined },
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
          <Alert variant="default" className="border-emerald-300 bg-emerald-50" role="status">
            <Check className="size-4 text-emerald-700" />
            <AlertDescription className="text-sm text-emerald-700">
              Cập nhật địa chỉ thành công
            </AlertDescription>
          </Alert>
        )}

        {hasAddress ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-35">Tỉnh/TP</span>
              <span className="text-sm">{user.province}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-35">Phường/Xã</span>
              <span className="text-sm">{user.ward}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground min-w-35">Số nhà, đường</span>
              <span className="text-sm">{user.street}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa cập nhật địa chỉ</p>
        )}

        <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="mt-2">
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
          <Label>Tỉnh/Thành phố</Label>
          <Select
            value={province}
            onValueChange={(value) => {
              setProvince(value);
              setWard("");
            }}
            disabled={provincesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={provincesLoading ? "Đang tải..." : "Chọn tỉnh/thành phố"} />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p.code} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Phường/Xã</Label>
          <Select
            value={ward}
            onValueChange={setWard}
            disabled={!province || wardsLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !province ? "Chọn tỉnh/TP trước" : wardsLoading ? "Đang tải..." : "Chọn phường/xã"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.code} value={w.name}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address-street">Số nhà, tên đường</Label>
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
          {isPending ? "Đang lưu..." : "Lưu"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
          <X className="mr-1.5 size-3.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
};

export default AddressForm;
```

- [ ] **Step 2: Commit**

```powershell
git add frontend/src/components/profile/AddressForm.tsx
git commit -m "feat: add AddressForm component with province/ward selects"
```

---

### Task 6: Add "Địa chỉ" tab to Profile page

**Files:**
- Modify: `frontend/src/pages/Profile.tsx`

- [ ] **Step 1: Import AddressForm**

Add after `ChangePasswordForm` import (line 11):

```typescript
import AddressForm from "@/src/components/profile/AddressForm";
```

- [ ] **Step 2: Add tab trigger and content**

Add after the password TabsTrigger (after line 109):

```tsx
            <TabsTrigger value="address">Địa chỉ</TabsTrigger>
```

Add after the password TabsContent (after line 118):

```tsx
          <TabsContent value="address">
            <AddressForm user={user} />
          </TabsContent>
```

- [ ] **Step 3: Verify build**

```powershell
cmd /c "cd frontend && npm run build"
```

Wait, actually just verify TypeScript:

```powershell
cmd /c "cd frontend && npx tsc --noEmit"
```

Expected: no new errors (pre-existing AI module errors may remain).

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/pages/Profile.tsx
git commit -m "feat: add Địa chỉ tab to Profile page"
```

# Profile Update & Change Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tabbed Profile page with editable profile info (fullName, phoneNumber) and password change form, wired to existing auth hooks.

**Architecture:** Profile.tsx becomes a tab shell using shadcn Tabs. Two extracted components (ProfileInfoForm, ChangePasswordForm) handle form logic independently, each wired to existing useUpdateProfile and useChangePassword hooks.

**Tech Stack:** React 19, TypeScript, shadcn/ui (Base UI primitives), TanStack Query, Zustand, Tailwind CSS 4, lucide-react icons

---

### Prerequisite: Install shadcn Tabs Component

**Files:**
- Create: `frontend/components/ui/tabs.tsx`

- [ ] **Step 1: Install Tabs component via shadcn CLI**

Run from `frontend/` directory:
```bash
npx shadcn@latest add tabs
```

This will create `components/ui/tabs.tsx` with Tab, Tabs, TabList, TabTrigger, TabPanel components using Base UI primitives (matching project's radix-ui/base-ui setup).

If CLI fails, create the file manually with this content:

```tsx
import * as React from "react";
import * as TabsPrimitive from "radix-ui";

import { cn } from "@/src/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tabs.Root>) {
  return (
    <TabsPrimitive.Tabs.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tabs.List>) {
  return (
    <TabsPrimitive.Tabs.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tabs.Trigger>) {
  return (
    <TabsPrimitive.Tabs.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tabs.Content>) {
  return (
    <TabsPrimitive.Tabs.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 2: Verify Tabs compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors related to tabs.tsx

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/tabs.tsx
git commit -m "chore: add shadcn tabs component"
```

---

### Task 1: ProfileInfoForm Component

**Files:**
- Create: `frontend/src/components/profile/ProfileInfoForm.tsx`

This component shows profile info in view mode with a "Chỉnh sửa" button, and switches to edit mode with form inputs for fullName and phoneNumber.

- [ ] **Step 1: Create ProfileInfoForm component**

Create `frontend/src/components/profile/ProfileInfoForm.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/profile/ProfileInfoForm.tsx
git commit -m "feat: add ProfileInfoForm component with view/edit modes"
```

---

### Task 2: ChangePasswordForm Component

**Files:**
- Create: `frontend/src/components/profile/ChangePasswordForm.tsx`

This component provides a 3-field password change form with client-side validation.

- [ ] **Step 1: Create ChangePasswordForm component**

Create `frontend/src/components/profile/ChangePasswordForm.tsx`:

```tsx
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
        <Alert variant="default" className="border-emerald-300 bg-emerald-50">
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
            minLength={6}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/profile/ChangePasswordForm.tsx
git commit -m "feat: add ChangePasswordForm component with validation"
```

---

### Task 3: Refactor Profile.tsx to Use Tabs

**Files:**
- Modify: `frontend/src/pages/Profile.tsx`

Replace the current flat layout with a tabbed interface. Keep the unauthenticated state and sign-out logic. Replace the info display section with Tabs containing ProfileInfoForm and ChangePasswordForm.

- [ ] **Step 1: Rewrite Profile.tsx with tabs**

Replace the entire content of `frontend/src/pages/Profile.tsx` with:

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/src/store";
import { useNavigate } from "react-router-dom";
import { useSignOut } from "@/src/hooks/useAuth";
import ProfileInfoForm from "@/src/components/profile/ProfileInfoForm";
import ChangePasswordForm from "@/src/components/profile/ChangePasswordForm";

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

export default Profile;
```

Note: The `InfoRow` component is removed since ProfileInfoForm handles its own display in view mode.

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Run lint**

Run from `frontend/`:
```bash
npm run lint
```
Expected: No lint errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Profile.tsx
git commit -m "feat: refactor Profile page to use tabs with ProfileInfoForm and ChangePasswordForm"
```

---

### Task 4: Verify & Test

- [ ] **Step 1: Run full build check**

Run from `frontend/`:
```bash
npm run build
```
Expected: Build succeeds with no errors

- [ ] **Step 2: Run lint check**

Run from `frontend/`:
```bash
npm run lint
```
Expected: No lint errors

- [ ] **Step 3: Manual testing checklist**

Start dev server:
```bash
npm run dev
```

Test the following flows:
1. Navigate to /profile while authenticated
2. Verify "Thông tin" tab shows by default with fullName and phoneNumber
3. Click "Chỉnh sửa" → inputs appear with current values
4. Edit fullName, click "Lưu" → success message appears, view mode shows updated name
5. Click "Chỉnh sửa" → edit → click "Hủy" → reverts to original values
6. Switch to "Đổi mật khẩu" tab
7. Fill wrong old password → submit → error shown
8. Fill valid old password, new password < 6 chars → submit → inline validation error
9. Fill valid old password, new password, mismatched confirm → submit → inline validation error
10. Fill all correctly → submit → success message, fields cleared
11. Verify sign-out still works
12. Verify unauthenticated redirect still works

- [ ] **Step 4: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```

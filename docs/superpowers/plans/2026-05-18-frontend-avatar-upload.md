# Frontend Avatar Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make avatar on Profile page clickable — selects image file, uploads to `POST /api/users/me/avatar`, updates avatar everywhere via Zustand + React Query sync.

**Architecture:** Add `uploadAvatar` API function → add `useUploadAvatar` mutation hook → wire into Profile page with hidden file input and loading/error states.

**Tech Stack:** React 19, TypeScript, TanStack Query, Zustand, Axios (FormData + multipart)

---

### Task 1: Add uploadAvatar to authApi.ts

**Files:**
- Modify: `frontend/src/services/authApi.ts`

- [ ] **Step 1: Add uploadAvatar function**

Add after `changePassword` function (after line 158):

```typescript
/**
 * POST /api/users/me/avatar
 * Upload avatar image via multipart form data.
 */
export const uploadAvatar = async (file: File): Promise<UserResponse> => {
  const formData = new FormData();
  formData.append("avatar", file);
  return axiosInstance
    .post("/api/users/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
cd frontend; npx tsc --noEmit 2>&1 | Select-String "error"
```

Expected: no errors

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/services/authApi.ts
git commit -m "feat: add uploadAvatar API function"
```

---

### Task 2: Add useUploadAvatar hook to useAuth.ts

**Files:**
- Modify: `frontend/src/hooks/useAuth.ts`

- [ ] **Step 1: Import uploadAvatar**

Add `uploadAvatar` to the import from `../services/authApi` (line 8):

Change line 8 from:
```typescript
  updateProfile,
```
to:
```typescript
  updateProfile,
  uploadAvatar,
```

- [ ] **Step 2: Add useUploadAvatar hook**

Add after `useUpdateProfile` (after line 116):

```typescript
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const setUser = useStore((state) => state.setUser);

  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.me(), data);
      setUser(data);
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
cd frontend; npx tsc --noEmit 2>&1 | Select-String "error"
```

Expected: no errors

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/hooks/useAuth.ts
git commit -m "feat: add useUploadAvatar mutation hook"
```

---

### Task 3: Wire clickable avatar into Profile.tsx

**Files:**
- Modify: `frontend/src/pages/Profile.tsx`

- [ ] **Step 1: Add imports**

Add after existing imports (after line 7):

```typescript
import { useUploadAvatar } from "@/src/hooks/useAuth";
import { useRef } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
```

- [ ] **Step 2: Add hook and ref inside component**

Add after `const { user, isAuthenticated } = useAuth();` (line 10):

```typescript
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadAvatar, isPending: isUploading, error: uploadError } = useUploadAvatar();

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
```

- [ ] **Step 3: Replace avatar markup**

Replace lines 41-44 (the `<Avatar>` block):

```tsx
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
            <Avatar className="size-20! group-hover:opacity-70 transition-opacity">
              <AvatarImage src={user.avatar} alt={user.fullName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            )}
          </div>
```

- [ ] **Step 4: Add error alert**

Add after the avatar `<div>` (after the closing `</div>` from step 3):

```tsx
          {uploadError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {uploadError instanceof Error ? uploadError.message : "Không thể tải ảnh lên. Thử lại sau."}
              </AlertDescription>
            </Alert>
          )}
```

- [ ] **Step 5: Verify TypeScript compiles and lint passes**

```powershell
cd frontend; npx tsc --noEmit 2>&1 | Select-String "error"
cd frontend; npm run lint 2>&1 | Select-String "error|warning"
```

Expected: no errors

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/pages/Profile.tsx
git commit -m "feat: add clickable avatar upload on Profile page"
```

---

### Task 4: Verify build

- [ ] **Step 1: Run full build**

```powershell
cd frontend; npm run build 2>&1 | Select-String "error|BUILD"
```

Expected: no errors

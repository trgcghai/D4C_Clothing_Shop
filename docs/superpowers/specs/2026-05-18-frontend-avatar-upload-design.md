# Frontend Avatar Upload — Design Spec

**Date:** 2026-05-18
**Feature:** Click-to-upload avatar on Profile page
**Status:** Draft

---

## Overview

Make the avatar on Profile page clickable. On click, open a file picker. On file selection, upload via `POST /api/users/me/avatar` (multipart). Update all avatar displays across the app via Zustand + React Query sync.

Backend endpoint already exists: `POST /api/users/me/avatar` — multipart, field `"avatar"`, `image/*` only, max 5MB, returns `UserResponse`.

---

## Changes

| File | Action | Purpose |
|------|--------|---------|
| `services/authApi.ts` | Modify | Add `uploadAvatar(file: File)` function |
| `hooks/useAuth.ts` | Modify | Add `useUploadAvatar()` mutation hook |
| `pages/Profile.tsx` | Modify | Clickable avatar + file input + loading/error states |

---

## API Function

Add to `authApi.ts`:

```ts
export const uploadAvatar = async (file: File): Promise<UserResponse> => {
  const formData = new FormData();
  formData.append("avatar", file);
  return axiosInstance.post("/api/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((res) => res.data);
};
```

## Mutation Hook

Add to `useAuth.ts`:

```ts
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

## Profile Page

- Avatar `<div>` wraps `<Avatar>`: `cursor-pointer`, `relative`, hover ring via `ring-2 ring-offset-2 ring-primary/50 opacity-0 hover:opacity-100 transition`
- Hidden `<input type="file" accept="image/*" />` triggered by clicking avatar wrapper
- `useUploadAvatar().mutate(file)` on file selection
- Loading: `avatar-overlay` with spinner when `isPending`
- Error: `<Alert variant="destructive">` with `error.message` below avatar
- Client-side MIME check: reject non-image before calling mutate (avoid wasted network call)

---

## Error Handling

| Scenario | UI |
|----------|-----|
| Non-image selected | Alert: "Chỉ chấp nhận file ảnh" |
| File > 5MB | Handled by server (400), shown in error alert |
| Network / S3 failure | Error alert with server message |
| Success | Avatar updates immediately, no toast needed |

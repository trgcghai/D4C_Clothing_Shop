# Profile Page: Update Profile & Change Password Design

**Date:** 2026-05-06
**Status:** Approved

## Overview

Add tabbed interface to Profile page with two tabs: "Thông tin" (profile info with edit capability) and "Đổi mật khẩu" (password change form). Uses existing `useUpdateProfile` and `useChangePassword` hooks from `useAuth.ts`.

## Architecture

### File Structure

```
frontend/src/
├── pages/
│   └── Profile.tsx              # Tab shell only
├── components/
│   └── profile/
│       ├── ProfileInfoForm.tsx   # View + edit fullName/phone
│       └── ChangePasswordForm.tsx # 3-field password change form
└── hooks/
    └── useAuth.ts                # Existing hooks — no changes needed
```

### Component Responsibilities

**Profile.tsx** — Tab container only
- Reads `user` from `useAuth()`
- Renders shadcn `Tabs` with two tab contents
- Passes `user` as props to child components
- No form logic

**ProfileInfoForm.tsx** — Profile info with view/edit modes
- View mode (default): Shows fullName and phoneNumber as read-only with "Chỉnh sửa" button
- Edit mode: Shows editable inputs with "Lưu" and "Hủy" buttons
- Calls `useUpdateProfile` on save
- On success: reverts to view mode, global store updates via hook's `onSuccess`
- On error: shows inline error alert

**ChangePasswordForm.tsx** — Password change form
- 3 fields: oldPassword, newPassword, confirmPassword
- Client-side validation: newPassword >= 6 chars, confirmPassword must match
- Calls `useChangePassword` on submit
- On success: clears form, shows success message ("Đổi mật khẩu thành công")
- On error: shows inline error alert

## Data Flow

### ProfileInfoForm
1. User clicks "Chỉnh sửa" → `editMode = true`, inputs pre-filled
2. User edits fields, clicks "Lưu" → `updateProfile.mutate({ fullName, phoneNumber })`
3. Hook `onSuccess` → `setUser(data)` updates Zustand store
4. Profile header auto-updates via `useAuth()` reactivity
5. Form switches to view mode

### ChangePasswordForm
1. User fills 3 password fields
2. On submit → local validation → `changePassword.mutate({ oldPassword, newPassword })`
3. On success → clear fields, show success toast
4. On error → display error message below form

## Error Handling

- Both forms use `isPending` to disable submit buttons and show loading text
- API errors display as inline alerts (matching Signin.tsx pattern: red border, red bg, `role="alert"`)
- Password mismatch caught before API call
- Focus management: on validation error, first invalid field receives focus

## Success Feedback

- ProfileInfoForm: reverts to view mode (user sees updated data immediately)
- ChangePasswordForm: green confirmation text auto-clears after 3 seconds

## UI/UX Details

### Tab Navigation
- shadcn `Tabs` component
- Two tabs: "Thông tin" (default), "Đổi mật khẩu"
- Active tab with underline indicator
- Vietnamese labels throughout

### ProfileInfoForm
- View mode: Label + read-only value pairs (existing InfoRow pattern)
- Edit mode: Input fields with visible Label elements, proper htmlFor/id pairing
- Button variants: "Chỉnh sửa" = outline, "Lưu" = default, "Hủy" = ghost
- Required fields marked with asterisk

### ChangePasswordForm
- All 3 fields: type="password" with show/hide toggle
- Error messages below each field on validation failure
- Submit button: disabled while isPending, shows "Đang cập nhật..."
- Success state: green confirmation text

### Accessibility
- All inputs have visible labels (not placeholder-only)
- aria-describedby for helper text and error messages
- role="alert" on error messages
- Keyboard navigation: Tab order matches visual order
- Focus management on error

### Responsive
- Mobile-first: forms stack vertically, full-width inputs
- Desktop: max-w-2xl centered container (consistent with existing pattern)

## Hooks Used

- `useUpdateProfile()` — already defined in useAuth.ts, handles mutation + store update
- `useChangePassword()` — already defined in useAuth.ts, handles mutation only

No changes needed to useAuth.ts or authApi.ts.

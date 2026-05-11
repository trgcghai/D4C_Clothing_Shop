# Admin User Management — Design Spec

**Date:** 2026-05-11
**Status:** Approved (all 3 sections)

## Overview

Admin can view, search, and disable/enable users. No delete functionality. Pagination handled server-side.

---

## 1. Backend (UserService — Spring Boot)

### 1.1 User Entity Changes

File: `UserService/src/main/java/iuh/fit/UserService/domain/entity/User.java`

- Add `enabled` — `Boolean`, `@Column(nullable = false)`, default `true`
- Add `createdAt` — `Instant`, `@CreationTimestamp`
- Add `updatedAt` — `Instant`, `@UpdateTimestamp`

### 1.2 New DTO

File: `UserService/src/main/java/iuh/fit/UserService/domain/dto/UserSummaryResponse.java`

Fields:
- `Long id`
- `String username`
- `String email`
- `String fullName`
- `Role role`
- `Boolean enabled`
- `Instant createdAt`

### 1.3 New Paginated Response Wrapper

File: `UserService/src/main/java/iuh/fit/UserService/domain/dto/PaginatedUserResponse.java`

Fields:
- `List<UserSummaryResponse> data`
- `long total`
- `int page`
- `int size`
- `int totalPages`

### 1.4 New Repository Query

File: `UserService/src/main/java/iuh/fit/UserService/Repository/UserRepository.java`

Add method:
```java
Page<User> findByFullNameContainingIgnoreCaseOrUsernameContainingIgnoreCaseOrEmailContainingIgnoreCase(
    String fullName, String username, String email, Pageable pageable
);
```

Also add: `Page<User> findAll(Pageable pageable)` (inherited but explicitly used).

### 1.5 New Controller

File: `UserService/src/main/java/iuh/fit/UserService/Controller/AdminUserController.java`

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | Paginated user list with optional search query `q` |
| `PATCH` | `/api/admin/users/{id}/toggle-status` | Toggle enabled/disabled |

Query params for GET:
- `q` (optional) — search term, matched against fullName, username, email
- `page` (default 0)
- `size` (default 10)
- `sort_by` (default `createdAt`)
- `sort_order` (default `desc`)

### 1.6 New Service

Files:
- `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserService.java` (interface)
- `UserService/src/main/java/iuh/fit/UserService/Service/AdminUserServiceImpl.java`

Logic:
- `getUsers(String q, Pageable)` — if `q` is blank, call `findAll(Pageable)`. If `q` present, call the OR search method.
- `toggleUserStatus(Long userId)` — find user, flip `enabled`, save, return new state. Throw if user not found.

### 1.7 Security Config Changes

File: `UserService/src/main/java/iuh/fit/UserService/Config/SecurityConfig.java`

Add rule before `anyRequest().authenticated()`:
```java
.requestMatchers("/api/admin/**").hasRole("ADMIN")
```

### 1.8 Login Flow Changes

File: `UserService/src/main/java/iuh/fit/UserService/Service/AuthServiceImpl.java`

In `login()` method, after checking `emailVerification`, add:
```java
if (!user.getEnabled()) {
    throw new AccountDisabledException("Tài khoản đã bị vô hiệu hóa");
}
```

New exception:
File: `UserService/src/main/java/iuh/fit/UserService/Exception/AccountDisabledException.java`

### 1.9 Global Exception Handler

File: `UserService/src/main/java/iuh/fit/UserService/Exception/GlobalExceptionHandler.java`

Add handler for `AccountDisabledException` → return 403 with message.

---

## 2. Frontend (React + Vite)

### 2.1 New Files

| File | Purpose |
|------|---------|
| `frontend/src/services/userAdminApi.ts` | API functions + TypeScript types |
| `frontend/src/hooks/useUsers.ts` | TanStack Query hooks (query key factory, useUsers, useToggleUserStatus) |
| `frontend/src/pages/admin/UserManagement.tsx` | Admin page component |

### 2.2 Route & Navigation

- `App.tsx`: Add `{ path: "/admin/users", element: <UserManagement /> }` under AdminLayout
- `AdminLayout.tsx`: Add nav item `{ to: "/admin/users", label: "Quản lý người dùng", icon: Users }`

### 2.3 API Layer (`userAdminApi.ts`)

Types:
```ts
interface UserSummary {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
}

interface PaginatedUsersResponse {
  data: UserSummary[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

interface UserFilters {
  q?: string;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}
```

Functions:
- `getUsers(filters: UserFilters) → PaginatedUsersResponse`
- `toggleUserStatus(userId: number) → { success: boolean; enabled: boolean }`

### 2.4 Hooks (`useUsers.ts`)

Query key factory:
```ts
export const userKeys = {
  all: ["admin-users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
};
```

Hooks:
- `useUsers(filters: UserFilters)` — `useQuery` with `staleTime: 30_000`
- `useToggleUserStatus()` — `useMutation`, invalidates `userKeys.lists()` on success

### 2.5 UI (`UserManagement.tsx`)

Structure:
- Header: "Quản lý người dùng" + total count badge
- Search bar: debounced (300ms) using `useEffect` + `setTimeout`, feeds into `q` filter
- Table: Avatar, Full Name, Username, Email, Role, Status, Actions
- Pagination: reuse `CustomPagination` component
- Loading state: skeleton rows (5 rows, matching ProductManagement pattern)
- Empty state: centered message with icon

Status badges:
- Enabled → `<Badge variant="default">Hoạt động</Badge>` (green)
- Disabled → `<Badge variant="destructive">Bị khóa</Badge>` (red)

Actions:
- If user is enabled → show "Khóa" button → opens `AlertDialog` confirmation → on confirm, call `toggleUserStatus`
- If user is disabled → show "Mở khóa" button → single click, no confirmation → call `toggleUserStatus`

Page size: 10

### 2.6 TanStack Query Best Practices

- Query keys are structured with filters as part of the key
- Mutations invalidate only the relevant list queries (`userKeys.lists()`)
- Search debouncing prevents excessive API calls
- `staleTime: 30_000` balances freshness with performance

---

## 3. Security & Login Flow

### 3.1 SecurityConfig

- `/api/auth/**` → `permitAll()`
- `/api/admin/**` → `hasRole("ADMIN")`
- `/v3/api-docs/**`, `/swagger-ui/**` → `permitAll()`
- `anyRequest()` → `authenticated()`

### 3.2 Login Check Order

1. Authenticate credentials (username + password)
2. Check `emailVerification == true` → throw `EmailNotVerifiedException` if false
3. Check `enabled == true` → throw `AccountDisabledException` if false
4. Generate JWT + refresh token

### 3.3 Edge Cases

- User disabled while logged in: next API call returns 401/403, interceptor redirects to `/signin`, login blocked
- Admin cannot disable themselves (optional safeguard — not implemented in v1, can be added later)

---

## 4. Out of Scope

- Delete user functionality
- Edit user details (change email, password, role)
- Bulk actions (bulk disable/enable)
- Audit log of who disabled whom
- Admin self-disable prevention

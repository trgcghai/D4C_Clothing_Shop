# Frontend Authentication Design

## Problem Statement
Frontend currently has no real authentication integration. Admin login is hardcoded in client state, routes are not protected by backend auth, and there are no user auth pages. We need end-to-end frontend auth using existing UserService APIs, with role-based redirect and admin access control.

## Scope
Implement frontend auth surfaces and flow:
- Sign in page
- Sign up page
- User profile page (view + edit info + change password)
- Role-based post-login redirect (admin -> `/admin`, non-admin -> `/`)
- Route guards for unauthenticated and unauthorized admin access
- API integration pattern aligned with existing product API client style
- UI built with shadcn UI patterns and accessible interaction defaults

Out of scope:
- Backend API contract changes
- Social login / OAuth
- MFA
- Password reset via email

## Existing Context
- Frontend uses React + React Router + Axios + React Query.
- Shared HTTP client exists in `frontend/src/lib/http.js`.
- Product API modules live under `frontend/src/api/*`.
- Current admin login is local-only and not secure (`adminLogin.jsx`, `admin.jsx` localStorage flag logic).
- UserService exposes:
  - `POST /api/auth/signin`
  - `POST /api/auth/signup`
  - `POST /api/auth/refresh-token` (refresh token in cookie)
  - `POST /api/auth/signout`
  - `GET /api/users/me`
  - `PUT /api/users/me`
  - `PUT /api/users/me/password`

## Chosen Approach
Use Redux-based auth store + route guards + Axios interceptors.

Why:
- Centralized auth state for route guards and navbar updates.
- Predictable global flow for token refresh and logout.
- Scales better than per-page checks as frontend grows.

Trade-off:
- Slightly more setup than Context-only approach.

## Architecture
### 1. Auth State
Create Redux auth slice with:
- `accessToken: string | null`
- `user: { username, email, role, ... } | null`
- `isAuthenticated: boolean`
- `status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated'`

Persist `accessToken` in localStorage (per approved decision) and hydrate on app boot.

### 2. HTTP Layer
Extend existing `src/lib/http.js`:
- Request interceptor: attach `Authorization: Bearer <accessToken>` when available.
- Response interceptor:
  - On first `401`, call `POST /api/auth/refresh-token` (cookie-based refresh).
  - If refresh succeeds, update token in Redux + localStorage, retry original request once.
  - If refresh fails, clear auth state and redirect to `/signin`.

Guard against infinite retry loops with `_retry` flag on request config.

### 3. Route Protection
Create guard components:
- `RequireAuth`: if unauthenticated, redirect to `/signin`.
- `RequireRole('ROLE_ADMIN')`: if authenticated but not admin, redirect to `/`.

Apply guards:
- `/profile` -> `RequireAuth`
- `/admin` -> `RequireAuth` + `RequireRole('ROLE_ADMIN')`

Redirect behavior (approved):
- Unauthenticated admin access -> `/signin`
- Unauthorized non-admin access -> `/`

### 4. Auth APIs
Add `src/api/auth.js` and `src/api/users.js` using same style as `src/api/products.js`:
- `signIn(payload)` -> `/api/auth/signin`
- `signUp(payload)` -> `/api/auth/signup`
- `signOut()` -> `/api/auth/signout`
- `refreshToken()` -> `/api/auth/refresh-token`
- `getMe()` -> `/api/users/me`
- `updateMe(payload)` -> `/api/users/me`
- `changePassword(payload)` -> `/api/users/me/password`

## UX and UI (shadcn + accessibility)
Use shadcn-style component patterns:
- `Card`, `Input`, `Label`, `Button`, `Alert`, `Form`, `Separator`, `Avatar`, `DropdownMenu`, `Skeleton`

### Sign In
- Fields: username/email (based on backend contract), password
- Clear labels, inline validation, keyboard submit
- Password visibility toggle
- Loading and disabled submit state
- Error/success feedback (toast + inline alert)

### Sign Up
- Fields aligned to signup API contract
- Validation before submit (required, format, password confirm)
- Friendly error mapping for duplicate username/email

### Profile
- View profile summary
- Edit profile form (`PUT /api/users/me`)
- Change password form (`PUT /api/users/me/password`)
- Separate sections/cards for account info vs password

### Usability and Accessibility
- Every input has visible `<Label>`
- Error/help text linked with `aria-describedby`
- Focus styles visible for keyboard users
- Buttons have disabled/loading semantics
- Sufficient color contrast for status messages

## Data Flow
1. App boot:
   - Read token from localStorage
   - If token exists, call `getMe()`
   - Success -> set authenticated user
   - Failure -> clear token and state
2. Sign in:
   - Submit credentials
   - Save returned access token
   - Call `getMe()`
   - Redirect by role:
     - admin -> `/admin`
     - non-admin -> `/`
3. Authenticated API call:
   - Access token in Authorization header
   - If expired -> interceptor refresh path
4. Sign out:
   - Call signout endpoint
   - Clear local state/token
   - Navigate to `/signin`

## Error Handling
- 400/422: show form-level and field-level validation messages.
- 401: trigger refresh logic; if still unauthorized, logout and redirect `/signin`.
- 403: show unauthorized feedback and redirect `/`.
- 5xx/network: show generic retry-friendly message.
- No silent auth failures; always surface outcome.

## Testing and Verification Plan
### Static checks
- `npm run lint`
- `npm run build`

### Manual flows
1. Sign up success/failure (duplicate values)
2. Sign in success and role-based redirect
3. Non-admin access `/admin` blocked to `/`
4. Unauthenticated access `/admin` blocked to `/signin`
5. Profile view/edit success and validation failure
6. Change password success and incorrect current password handling
7. Expired token refresh path and forced logout on refresh failure
8. Navbar state transitions (guest <-> authenticated)

## Rollout Notes
- Remove old hardcoded admin login behavior.
- Keep route paths stable where possible (`/admin` retained).
- If backend role values differ from `ROLE_ADMIN`, map in one helper to avoid scattered string checks.


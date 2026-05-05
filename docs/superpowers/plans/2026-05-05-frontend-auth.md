# Frontend Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production auth UX + API integration on frontend with sign in, sign up, profile management, and strict admin route protection.

**Architecture:** Use Redux Toolkit for global auth state, persist access token in localStorage, and wire axios interceptors in shared `http` client for Authorization header + refresh-token retry flow. Use route guards (`RequireAuth`, `RequireRole`) to enforce auth/role checks. Build pages with shadcn-style UI primitives and accessible form/error states.

**Tech Stack:** React 19, React Router, Redux Toolkit, Axios, React Query, Tailwind CSS, react-toastify, shadcn/ui component patterns

---

## File Structure (planned changes)

### Create
- `frontend/src/store/index.js` — Redux store root
- `frontend/src/store/authSlice.js` — auth state + reducers/thunks helpers
- `frontend/src/lib/auth-storage.js` — token persistence helpers
- `frontend/src/lib/auth-events.js` — safe logout redirect helper (used by interceptors + UI)
- `frontend/src/api/auth.js` — auth endpoints
- `frontend/src/api/users.js` — profile endpoints
- `frontend/src/components/auth/RequireAuth.jsx` — unauthenticated guard
- `frontend/src/components/auth/RequireRole.jsx` — role guard
- `frontend/src/components/ui/Button.jsx`
- `frontend/src/components/ui/Input.jsx`
- `frontend/src/components/ui/Label.jsx`
- `frontend/src/components/ui/Card.jsx`
- `frontend/src/components/ui/Alert.jsx`
- `frontend/src/pages/signin.jsx`
- `frontend/src/pages/signup.jsx`
- `frontend/src/pages/profile.jsx`

### Modify
- `frontend/package.json` — add Redux dependencies
- `frontend/src/main.jsx` — wrap app with Redux provider
- `frontend/src/lib/http.js` — attach token + refresh retry interceptor
- `frontend/src/App.jsx` — add routes + wrap protected routes
- `frontend/src/components/navbar.jsx` — auth-aware nav actions
- `frontend/src/pages/adminLogin.jsx` — replace/redirect legacy local login page behavior
- `frontend/src/pages/admin.jsx` — remove localStorage fake login logic

---

### Task 1: Install state management dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add Redux Toolkit + React Redux dependencies**

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.2.7",
    "react-redux": "^9.1.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`  
Expected: install completes, lockfile updated

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "frontend: add redux auth dependencies"
```

---

### Task 2: Build auth store + token persistence

**Files:**
- Create: `frontend/src/lib/auth-storage.js`
- Create: `frontend/src/store/authSlice.js`
- Create: `frontend/src/store/index.js`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Create token helpers**

```js
// frontend/src/lib/auth-storage.js
const ACCESS_TOKEN_KEY = "accessToken";

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
```

- [ ] **Step 2: Write auth slice**

```js
// frontend/src/store/authSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { getStoredAccessToken, setStoredAccessToken, clearStoredAccessToken } from "../lib/auth-storage";

const initialToken = getStoredAccessToken();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: initialToken,
    user: null,
    isAuthenticated: Boolean(initialToken),
    status: initialToken ? "loading" : "unauthenticated",
  },
  reducers: {
    setToken(state, action) {
      state.accessToken = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      if (action.payload) setStoredAccessToken(action.payload);
      else clearStoredAccessToken();
    },
    setUser(state, action) {
      state.user = action.payload;
      state.status = action.payload ? "authenticated" : "unauthenticated";
      state.isAuthenticated = Boolean(action.payload);
    },
    startAuthLoading(state) {
      state.status = "loading";
    },
    logout(state) {
      state.accessToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.status = "unauthenticated";
      clearStoredAccessToken();
    },
  },
});

export const { setToken, setUser, startAuthLoading, logout } = authSlice.actions;
export default authSlice.reducer;
```

- [ ] **Step 3: Create Redux store and wire provider**

```js
// frontend/src/store/index.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
```

```jsx
// frontend/src/main.jsx
import { Provider } from "react-redux";
import { store } from "./store";

<Provider store={store}>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</Provider>;
```

- [ ] **Step 4: Run lint for new files**

Run: `cd frontend && npm run lint`  
Expected: no new lint errors from store files

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/auth-storage.js frontend/src/store/authSlice.js frontend/src/store/index.js frontend/src/main.jsx
git commit -m "frontend: create auth redux store and token persistence"
```

---

### Task 3: Add auth/profile API modules aligned with product API style

**Files:**
- Create: `frontend/src/api/auth.js`
- Create: `frontend/src/api/users.js`

- [ ] **Step 1: Add auth API module**

```js
// frontend/src/api/auth.js
import http from "../lib/http";

export async function signIn(payload) {
  const { data } = await http.post("/api/auth/signin", payload);
  return data;
}

export async function signUp(payload) {
  const { data } = await http.post("/api/auth/signup", payload);
  return data;
}

export async function signOut() {
  const { data } = await http.post("/api/auth/signout");
  return data;
}

export async function refreshToken() {
  const { data } = await http.post("/api/auth/refresh-token");
  return data;
}
```

- [ ] **Step 2: Add users API module**

```js
// frontend/src/api/users.js
import http from "../lib/http";

export async function getMe() {
  const { data } = await http.get("/api/users/me");
  return data;
}

export async function updateMe(payload) {
  const { data } = await http.put("/api/users/me", payload);
  return data;
}

export async function changePassword(payload) {
  const { data } = await http.put("/api/users/me/password", payload);
  return data;
}
```

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`  
Expected: modules pass lint

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/auth.js frontend/src/api/users.js
git commit -m "frontend: add auth and user api clients"
```

---

### Task 4: Wire axios interceptors for auth header + refresh retry

**Files:**
- Create: `frontend/src/lib/auth-events.js`
- Modify: `frontend/src/lib/http.js`
- Modify: `frontend/src/store/authSlice.js` (if helper reducer needed)

- [ ] **Step 1: Add auth event helper**

```js
// frontend/src/lib/auth-events.js
let logoutHandler = null;

export function registerLogoutHandler(handler) {
  logoutHandler = handler;
}

export function emitLogout(reason = "session_expired") {
  if (logoutHandler) logoutHandler(reason);
}
```

- [ ] **Step 2: Implement request/response interceptors**

```js
// frontend/src/lib/http.js (core additions)
import axios from "axios";
import { store } from "../store";
import { setToken, logout } from "../store/authSlice";
import { getStoredAccessToken } from "./auth-storage";
import { emitLogout } from "./auth-events";

http.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken || getStoredAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    if (status === 401 && !originalRequest?._retry && !originalRequest?.url?.includes("/api/auth/refresh-token")) {
      originalRequest._retry = true;
      try {
        const refreshRes = await http.post("/api/auth/refresh-token");
        const nextToken = refreshRes?.data?.token || refreshRes?.data?.accessToken;
        if (!nextToken) throw new Error("No access token returned after refresh");
        store.dispatch(setToken(nextToken));
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return http(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        emitLogout("refresh_failed");
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);
```

- [ ] **Step 3: Manual failure-first check**

Run app with stale token in localStorage, open protected page  
Expected before interceptor fix: repeated 401 and no recovery  
Expected after interceptor fix: one refresh attempt, then recover or logout redirect

- [ ] **Step 4: Run lint + build**

Run: `cd frontend && npm run lint && npm run build`  
Expected: both commands succeed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/http.js frontend/src/lib/auth-events.js frontend/src/store/authSlice.js
git commit -m "frontend: add auth axios interceptors with refresh retry"
```

---

### Task 5: Build route guards and route map updates

**Files:**
- Create: `frontend/src/components/auth/RequireAuth.jsx`
- Create: `frontend/src/components/auth/RequireRole.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create RequireAuth**

```jsx
// frontend/src/components/auth/RequireAuth.jsx
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const { isAuthenticated, status } = useSelector((state) => state.auth);
  const location = useLocation();
  if (status === "loading") return <div className="p-6 text-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/signin" replace state={{ from: location }} />;
  return children;
}
```

- [ ] **Step 2: Create RequireRole**

```jsx
// frontend/src/components/auth/RequireRole.jsx
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

export default function RequireRole({ role, children }) {
  const userRole = useSelector((state) => state.auth.user?.role);
  if (userRole !== role) return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 3: Update routes**

```jsx
// frontend/src/App.jsx (route excerpts)
<Route path="/signin" element={<SignIn />} />
<Route path="/signup" element={<SignUp />} />
<Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
<Route
  path="/admin"
  element={
    <RequireAuth>
      <RequireRole role="ROLE_ADMIN">
        <Admin />
      </RequireRole>
    </RequireAuth>
  }
/>
```

- [ ] **Step 4: Manual failure-first check**

1. Open `/admin` while logged out -> should redirect `/signin`  
2. Login non-admin then open `/admin` -> should redirect `/`

- [ ] **Step 5: Run lint**

Run: `cd frontend && npm run lint`  
Expected: route/guard files pass lint

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/auth/RequireAuth.jsx frontend/src/components/auth/RequireRole.jsx frontend/src/App.jsx
git commit -m "frontend: protect routes with auth and role guards"
```

---

### Task 6: Build shadcn-style Sign In + Sign Up pages with role redirect

**Files:**
- Create: `frontend/src/components/ui/Button.jsx`
- Create: `frontend/src/components/ui/Input.jsx`
- Create: `frontend/src/components/ui/Label.jsx`
- Create: `frontend/src/components/ui/Card.jsx`
- Create: `frontend/src/components/ui/Alert.jsx`
- Create: `frontend/src/pages/signin.jsx`
- Create: `frontend/src/pages/signup.jsx`

- [ ] **Step 1: Add minimal reusable UI primitives**

```jsx
// frontend/src/components/ui/Button.jsx
export default function Button({ className = "", ...props }) {
  return <button className={`h-10 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 ${className}`} {...props} />;
}
```

```jsx
// frontend/src/components/ui/Input.jsx
export default function Input(props) {
  return <input className="h-10 w-full rounded-md border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500" {...props} />;
}
```

- [ ] **Step 2: Implement Sign In page**

```jsx
// frontend/src/pages/signin.jsx (core flow)
const response = await signIn({ username, password });
dispatch(setToken(response.token || response.accessToken));
const me = await getMe();
dispatch(setUser(me));
navigate(me.role === "ROLE_ADMIN" ? "/admin" : "/");
```

- [ ] **Step 3: Implement Sign Up page**

```jsx
// frontend/src/pages/signup.jsx (submit flow)
await signUp(formValues);
navigate("/signin", { replace: true, state: { signedUp: true } });
```

- [ ] **Step 4: Manual failure-first check**

1. Invalid signin credentials -> inline alert + no redirect  
2. Admin signin -> `/admin`  
3. Non-admin signin -> `/`

- [ ] **Step 5: Run lint + build**

Run: `cd frontend && npm run lint && npm run build`  
Expected: pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/Button.jsx frontend/src/components/ui/Input.jsx frontend/src/components/ui/Label.jsx frontend/src/components/ui/Card.jsx frontend/src/components/ui/Alert.jsx frontend/src/pages/signin.jsx frontend/src/pages/signup.jsx
git commit -m "frontend: add accessible signin and signup pages"
```

---

### Task 7: Build profile page (view, edit, change password) + auth-aware navbar

**Files:**
- Create: `frontend/src/pages/profile.jsx`
- Modify: `frontend/src/components/navbar.jsx`
- Modify: `frontend/src/pages/adminLogin.jsx`
- Modify: `frontend/src/pages/admin.jsx`

- [ ] **Step 1: Implement profile page data load**

```jsx
// frontend/src/pages/profile.jsx (load/me)
useEffect(() => {
  (async () => {
    const me = await getMe();
    dispatch(setUser(me));
    setForm({ username: me.username, email: me.email, fullName: me.fullName || "" });
  })();
}, [dispatch]);
```

- [ ] **Step 2: Implement edit profile + change password forms**

```jsx
// profile save
await updateMe({ username: form.username, email: form.email, fullName: form.fullName });
toast.success("Profile updated");

// password change
await changePassword({ currentPassword, newPassword, confirmPassword });
toast.success("Password changed");
```

- [ ] **Step 3: Update navbar auth actions**

```jsx
// navbar behavior excerpt
{isAuthenticated ? (
  <>
    <Link to="/profile">Profile</Link>
    <button onClick={handleSignOut}>Sign out</button>
  </>
) : (
  <>
    <Link to="/signin">Sign in</Link>
    <Link to="/signup">Sign up</Link>
  </>
)}
```

- [ ] **Step 4: Remove legacy fake admin login logic**

```jsx
// adminLogin.jsx
import { Navigate } from "react-router-dom";
export default function AdminLogin() {
  return <Navigate to="/signin" replace />;
}
```

```jsx
// admin.jsx
// delete localStorage auto-login side effect block
```

- [ ] **Step 5: Manual failure-first check**

1. Guest sees Sign in/Sign up in navbar  
2. Auth user sees Profile/Sign out  
3. Profile edit validation + save works  
4. Change password wrong current password shows API error

- [ ] **Step 6: Run lint + build**

Run: `cd frontend && npm run lint && npm run build`  
Expected: pass

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/profile.jsx frontend/src/components/navbar.jsx frontend/src/pages/adminLogin.jsx frontend/src/pages/admin.jsx
git commit -m "frontend: add profile management and auth navbar actions"
```

---

### Task 8: End-to-end auth regression pass

**Files:**
- Modify: none expected (fix only if regression found)

- [ ] **Step 1: Run full static checks**

Run: `cd frontend && npm run lint && npm run build`  
Expected: pass

- [ ] **Step 2: Run manual scenario matrix**

1. Signup success + duplicate failure  
2. Signin redirect by role  
3. `/admin` unauth -> `/signin`  
4. `/admin` non-admin -> `/`  
5. Profile view/edit/change password  
6. Signout clears state + redirect  
7. Expired token -> refresh success OR logout fallback

Expected: all scenarios match design spec

- [ ] **Step 3: Commit final fixes (if any)**

```bash
git add .
git commit -m "frontend: finalize auth flow and guard behavior"
```

---

## Spec Coverage Check (self-review)

- Sign in page: covered in Task 6
- Sign up page: covered in Task 6
- Profile view/edit/password: covered in Task 7
- Role-based redirect admin/home: covered in Task 6 + Task 5
- Block unauth + unauthorized admin access: covered in Task 5
- Product API style for auth API: covered in Task 3
- shadcn-style usable and accessible UI: covered in Task 6 + Task 7
- Interceptor refresh handling and logout fallback: covered in Task 4

No uncovered spec requirements found.

## Placeholder / ambiguity scan (self-review)

- No `TODO`/`TBD` placeholders
- Role string fixed as `ROLE_ADMIN` (single explicit behavior)
- Refresh token flow explicit (one retry, then logout)
- Legacy admin fake login removal explicitly included


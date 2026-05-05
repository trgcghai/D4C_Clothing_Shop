import { createSlice } from "@reduxjs/toolkit";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "../lib/auth-storage";

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
      state.accessToken = action.payload || null;
      state.isAuthenticated = Boolean(action.payload);
      if (action.payload) {
        setStoredAccessToken(action.payload);
      } else {
        clearStoredAccessToken();
      }
    },
    setUser(state, action) {
      state.user = action.payload || null;
      state.isAuthenticated = Boolean(action.payload && state.accessToken);
      state.status = action.payload ? "authenticated" : "unauthenticated";
    },
    setAuthStatus(state, action) {
      state.status = action.payload;
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

export const { setToken, setUser, setAuthStatus, logout } = authSlice.actions;
export default authSlice.reducer;


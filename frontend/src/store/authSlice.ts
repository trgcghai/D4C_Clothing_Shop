import { type StateCreator } from "zustand";
import type { Role, UserResponse } from "../services/authApi";

export interface AuthState {
  user: UserResponse | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
}

export interface AuthActions {
  setAuth: (user: UserResponse, token: string) => void;
  setUser: (user: UserResponse) => void;
  logout: () => void;
}

export type AuthSlice = AuthState & AuthActions;

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (
  set,
) => ({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,

  setAuth: (user, token) =>
    set({
      user,
      token,
      role: user.role,
      isAuthenticated: true,
    }),

  setUser: (user) =>
    set({
      user,
      role: user.role,
    }),

  logout: () =>
    set({
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
    }),
});

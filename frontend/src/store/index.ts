import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createAuthSlice, type AuthSlice } from "./authSlice";

export type RootStore = AuthSlice;

export const useStore = create<RootStore>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
    }),
    {
      name: "d4c-auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export const useAuth = () =>
  useStore(
    useShallow((state) => ({
      user: state.user,
      token: state.token,
      role: state.role,
      isAuthenticated: state.isAuthenticated,
      setAuth: state.setAuth,
      setUser: state.setUser,
      logout: state.logout,
    })),
  );

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createAuthSlice, type AuthSlice } from "./authSlice";
import { createAiSlice, type AiSlice } from "./aiSlice";

export type RootStore = AuthSlice & AiSlice;

export const useStore = create<RootStore>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createAiSlice(...a),
    }),
    {
      name: "d4c-auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
        messages: state.messages,
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

export const useAi = () =>
  useStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      messages: state.messages,
      isLoading: state.isLoading,
      toggleChat: state.toggleChat,
      openChat: state.openChat,
      closeChat: state.closeChat,
      addMessage: state.addMessage,
      setMessages: state.setMessages,
      setLoading: state.setLoading,
      clearChat: state.clearChat,
    })),
  );

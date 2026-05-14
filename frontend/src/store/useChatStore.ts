import { create } from "zustand";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
}

interface ChatStore {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  messages: [
    {
      id: "welcome-msg",
      role: "model",
      content: "Xin chào! Mình là trợ lý AI của D4C. Bạn cần hỗ trợ gì hôm nay?",
      timestamp: Date.now(),
    },
  ],
  isLoading: false,
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: Date.now().toString(), timestamp: Date.now() },
      ],
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  clearChat: () =>
    set({
      messages: [
        {
          id: "welcome-msg",
          role: "model",
          content: "Đã xóa lịch sử trò chuyện. Mình có thể giúp gì tiếp cho bạn?",
          timestamp: Date.now(),
        },
      ],
    }),
}));

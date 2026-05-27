import { type StateCreator } from "zustand";

export interface AiMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
}

export interface AiState {
  isOpen: boolean;
  messages: AiMessage[];
  isLoading: boolean;
}

export interface AiActions {
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (message: Omit<AiMessage, "id" | "timestamp">) => void;
  setMessages: (messages: AiMessage[]) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
}

export type AiSlice = AiState & AiActions;

const defaultWelcomeMessage: AiMessage = {
  id: "welcome-msg",
  role: "model",
  content: "Xin chào! Mình là trợ lý AI của D4C. Bạn cần hỗ trợ gì hôm nay?",
  timestamp: Date.now(),
};

const clearedMessage: AiMessage = {
  id: "welcome-msg",
  role: "model",
  content: "Đã xóa lịch sử trò chuyện. Mình có thể giúp gì tiếp cho bạn?",
  timestamp: Date.now(),
};

export const createAiSlice: StateCreator<AiSlice, [], [], AiSlice> = (set) => ({
  isOpen: false,
  messages: [defaultWelcomeMessage],
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
  setMessages: (messages) => set({ messages }),
  setLoading: (loading) => set({ isLoading: loading }),
  clearChat: () => set({ messages: [clearedMessage] }),
});

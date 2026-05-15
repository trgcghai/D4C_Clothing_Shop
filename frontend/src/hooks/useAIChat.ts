import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/src/store";
import { useChatStore } from "@/src/store/useChatStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const AI_API_URL = `${BASE_URL}/api/v1/ai/chat`;

export const useAIChat = () => {
  const { user, role } = useAuth();
  const { addMessage, setLoading } = useChatStore();
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    setError(null);
    setLoading(true);

    // Optimistically add user message
    addMessage({ role: "user", content: message });

    try {
      const response = await axios.post(AI_API_URL, {
        userId: user?.id || "anonymous",
        role: role || "USER",
        message: message,
      }, { timeout: 120000 }); // 120s timeout to match gateway

      if (response.data && response.data.success) {
        addMessage({ role: "model", content: response.data.data.reply });
      } else {
        throw new Error("Invalid response from AI Service");
      }
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      setError(err.message || "Failed to communicate with AI.");
      addMessage({ 
        role: "model", 
        content: "Xin lỗi, hệ thống AI đang gặp sự cố. Bạn vui lòng thử lại sau nhé." 
      });
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, error };
};

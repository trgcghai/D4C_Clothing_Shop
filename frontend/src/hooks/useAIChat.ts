import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/src/store/useChatStore";
import { sendChatMessage, getConversation, clearConversation } from "@/src/services/aiApi";

export const aiKeys = {
  all: ["ai-conversation"] as const,
  detail: () => [...aiKeys.all, "detail"] as const,
};

export function useAIChat(isOpen: boolean) {
  const queryClient = useQueryClient();
  const { addMessage, setMessages, clearChat: storeClearChat } = useChatStore();

  // Sync conversation from backend when chat opens
  useQuery({
    queryKey: aiKeys.detail(),
    queryFn: getConversation,
    enabled: isOpen,
    staleTime: Infinity,
    retry: false,
    onSuccess: (data) => {
      if (data.data.messages.length > 0) {
        const synced = data.data.messages.map((msg) => ({
          id: `${msg.timestamp}-${msg.role}`,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));
        setMessages(synced);
      }
    },
  });

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: sendChatMessage,
    onMutate: ({ message }) => {
      addMessage({ role: "user", content: message });
    },
    onSuccess: (data) => {
      addMessage({ role: "model", content: data.data.reply });
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
    onError: () => {
      addMessage({
        role: "model",
        content:
          "Xin lỗi, hệ thống AI đang gặp sự cố. Bạn vui lòng thử lại sau nhé.",
      });
    },
  });

  const handleSend = (message: string) => {
    if (!message.trim()) return;
    sendMessage({ message });
  };

  const { mutate: clearChat } = useMutation({
    mutationFn: clearConversation,
    onSuccess: () => {
      storeClearChat();
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
    onError: () => {
      storeClearChat();
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
  });

  return {
    sendMessage: handleSend,
    isLoading: isPending,
    clearChat,
  };
}

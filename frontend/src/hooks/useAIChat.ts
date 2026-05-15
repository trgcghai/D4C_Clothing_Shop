import { useMutation } from "@tanstack/react-query";
import { useChatStore } from "@/src/store/useChatStore";
import { sendChatMessage, getConversation, clearConversation } from "@/src/services/aiApi";

export function useAIChat() {
  const { addMessage, setMessages, clearChat: storeClearChat } = useChatStore();

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: sendChatMessage,
    onMutate: ({ message }) => {
      addMessage({ role: "user", content: message });
    },
    onSuccess: (data) => {
      addMessage({ role: "model", content: data.data.reply });
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

  const { mutate: syncConversation } = useMutation({
    mutationFn: getConversation,
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

  const { mutate: clearChat } = useMutation({
    mutationFn: clearConversation,
    onSuccess: () => {
      storeClearChat();
    },
    onError: () => {
      storeClearChat();
    },
  });

  return {
    sendMessage: handleSend,
    isLoading: isPending,
    syncConversation,
    clearChat,
  };
}

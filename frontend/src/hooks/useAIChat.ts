import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/src/store";
import { useChatStore } from "@/src/store/useChatStore";
import { sendChatMessage } from "@/src/services/aiApi";

export function useAIChat() {
  const { user, role } = useAuth();
  const { addMessage } = useChatStore();

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

    sendMessage({
      message,
      userId: user?.id?.toString() || "anonymous",
      role: role || "USER",
    });
  };

  return { sendMessage: handleSend, isLoading: isPending };
}

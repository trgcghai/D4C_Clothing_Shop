import { Bot, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/src/store/useChatStore";
import AIChatWindow from "./AIChatWindow";

const AIChatBubble = () => {
  const { isOpen, toggleChat } = useChatStore();

  return (
    <>
      {isOpen && <AIChatWindow />}
      
      <Button
        onClick={toggleChat}
        size="icon"
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-2xl hover:scale-105 transition-transform duration-200 sm:bottom-8 sm:right-8 group"
      >
        {isOpen ? (
          <MessageCircle className="size-6 group-hover:scale-110 transition-transform" />
        ) : (
          <Bot className="size-6 group-hover:scale-110 transition-transform" />
        )}
      </Button>
    </>
  );
};

export default AIChatBubble;

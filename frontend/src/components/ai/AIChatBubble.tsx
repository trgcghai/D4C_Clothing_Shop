import { Bot, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAi } from "@/src/store";
import AIChatWindow from "./AIChatWindow";

const AIChatBubble = () => {
  const { isOpen, toggleChat } = useAi();

  return (
    <>
      {isOpen && <AIChatWindow />}

      <Button
        onClick={toggleChat}
        size="icon"
        className="fixed bottom-6 right-6 z-50 size-12 rounded-full shadow-2xl hover:scale-105 transition-transform duration-200 sm:bottom-8 sm:right-8 group"
      >
        {isOpen ? (
          <MessageCircle className="size-5 group-hover:scale-105 transition-transform" />
        ) : (
          <Bot className="size-5 group-hover:scale-105 transition-transform" />
        )}
      </Button>
    </>
  );
};

export default AIChatBubble;

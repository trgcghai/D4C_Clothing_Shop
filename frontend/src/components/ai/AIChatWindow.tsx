import { useState, useRef, useEffect } from "react";
import { X, Send, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/src/store/useChatStore";
import { useAIChat } from "@/src/hooks/useAIChat";
import AIMessage from "./AIMessage";
import { useAuth } from "@/src/store";

const AIChatWindow = () => {
  const { messages, isLoading, closeChat, clearChat } = useChatStore();
  const { sendMessage } = useAIChat();
  const { role } = useAuth();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const title = role === "ADMIN" ? "Admin Copilot" : "D4C AI Stylist";

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex h-137.5 w-95 flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl transition-all duration-300 ease-out sm:right-8 sm:w-100">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">Sẵn sàng hỗ trợ</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={clearChat}
            title="Xóa trò chuyện"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={closeChat}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 [scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.28)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/35">
        {messages.map((msg) => (
          <AIMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isLoading && (
          <div className="flex w-full justify-start py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="ml-3 flex items-center space-x-1.5 rounded-2xl bg-muted/50 px-4 py-3 border">
              <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
              <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce delay-150" />
              <div className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce delay-300" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-background p-3">
        <div className="flex items-center gap-2 rounded-full border bg-muted/20 px-2 py-1 focus-within:ring-1 focus-within:ring-primary">
          <input
            type="text"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={
              role === "ADMIN"
                ? "Hỏi về doanh thu, đơn hàng..."
                : "Hỏi về sản phẩm, size..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="size-9 shrink-0 rounded-full"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="size-4 mr-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatWindow;

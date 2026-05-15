import { Bot, User } from "lucide-react";
import { cn } from "@/src/lib/utils";
import AICardRenderer from "./AICardRenderer";

interface AIMessageProps {
  role: "user" | "model";
  content: string;
}

const AIMessage = ({ role, content }: AIMessageProps) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3 py-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-primary border">
          <Bot className="size-5" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl p-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-foreground border",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap wrap-break-word">{content}</p>
        ) : (
          <AICardRenderer content={content} />
        )}
      </div>

      {isUser && (
        <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-muted text-muted-foreground border">
          <User className="size-5" />
        </div>
      )}
    </div>
  );
};

export default AIMessage;

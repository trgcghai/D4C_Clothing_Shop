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
    <div className={cn("flex w-full gap-3 py-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-5" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted/50 text-foreground rounded-bl-none border"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <AICardRenderer content={content} />
        )}
      </div>

      {isUser && (
        <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="size-5" />
        </div>
      )}
    </div>
  );
};

export default AIMessage;

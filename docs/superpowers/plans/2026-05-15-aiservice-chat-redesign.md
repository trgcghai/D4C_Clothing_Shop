# AIService Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove DynamoDB storage, enforce identity via Gateway headers, add sync-on-open and server-side clear for AI chat.

**Architecture:** REST API changes to AIService (GET/POST/DELETE on `/api/v1/ai/chat`), Redis-only persistence, frontend sync via Zustand store + TanStack Query.

**Tech Stack:** Node.js/Express, ioredis, React 19, TypeScript, Zustand, TanStack Query, Axios.

---

### Task 1: Remove DynamoDB from AIService — delete model and config

**Files:**
- Delete: `AIService/src/models/chat.model.js`
- Delete: `AIService/src/config/aws.config.js`
- Modify: `AIService/package.json`

- [ ] **Step 1: Delete `chat.model.js`**

Run:
```bash
rm "F:\Cntt\KienTruc\D4C_ClothingShop\AIService\src\models\chat.model.js"
```

- [ ] **Step 2: Delete `aws.config.js`**

Run:
```bash
rm "F:\Cntt\KienTruc\D4C_ClothingShop\AIService\src\config\aws.config.js"
```

- [ ] **Step 3: Remove AWS SDK dependencies from `package.json`**

Read the current `package.json`, then remove these two dependencies:
```json
"@aws-sdk/client-dynamodb": "^3.1046.0",
"@aws-sdk/lib-dynamodb": "^3.1046.0",
```

The resulting `dependencies` section should be:
```json
"dependencies": {
  "@google/generative-ai": "^0.24.1",
  "axios": "^1.16.1",
  "cors": "^2.8.6",
  "dotenv": "^16.4.7",
  "eureka-js-client": "^4.5.0",
  "express": "^5.2.1",
  "ioredis": "^5.10.1",
  "morgan": "^1.10.1"
}
```

- [ ] **Step 4: Remove DynamoDB env vars from `.env.example`**

Read `AIService/.env.example`, remove these lines:
```
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
DYNAMODB_TABLE_CHATS=
```

- [ ] **Step 5: Delete the models directory if empty**

Run:
```bash
rmdir "F:\Cntt\KienTruc\D4C_ClothingShop\AIService\src\models" 2>nul || true
```

- [ ] **Step 6: Commit**

```bash
git add -A AIService/
git commit -m "refactor: remove DynamoDB from AIService"
```

---

### Task 2: Rewrite `gemini.service.js` — Redis-only flow

**Files:**
- Modify: `AIService/src/services/gemini.service.js`

- [ ] **Step 1: Rewrite the entire file**

Replace the full contents of `AIService/src/services/gemini.service.js` with:

```js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import redisClient from "../config/redis.config.js";
import { productToolDeclarations, productToolHandlers } from "../tools/productTools.js";
import { cartOrderToolDeclarations, cartOrderToolHandlers } from "../tools/cartOrderTools.js";
import { socialToolDeclarations, socialToolHandlers } from "../tools/socialTools.js";
import { adminStatsToolDeclarations, adminStatsToolHandlers } from "../tools/adminStatsTools.js";

dotenv.config();

const PROXY_API_KEY = process.env.PROXY_API_KEY;
const PROXY_BASE_URL = "https://gcli.ggchan.dev";

const genAI = new GoogleGenerativeAI(PROXY_API_KEY);

const USER_INSTRUCTION = `
Bạn là Trợ lý Mua sắm và Stylist AI thông minh của D4C Clothing Shop.

QUY TẮC BẮT BUỘC - KHÔNG ĐƯỢC VI PHẠM:
1. HÀNH ĐỘNG NGAY, KHÔNG HỎI LẠI:
   - Khi người dùng nói "tìm áo thun" → gọi search_products với keyword="áo thun" NGAY LẬP TỨC.
   - Khi search_products trả về kết quả (dù không hoàn toàn khớp) → HIỂN THỊ NGAY bằng [UI:PRODUCT_LIST:...] rồi DỪNG. TUYỆT ĐỐI KHÔNG hỏi "Bạn có muốn tìm lại không?" hay bất kỳ câu hỏi follow-up nào.
   - Chỉ hỏi lại khi: (a) search trả về 0 sản phẩm, HOẶC (b) yêu cầu quá mơ hồ không thể gọi tool.
2. LUÔN dùng search_products để tìm, KHÔNG BAO GIỜ trả lời "Tôi không biết sản phẩm nào".
3. SAU KHI hiển thị kết quả → chỉ thêm 1 câu gợi ý ngắn (tối đa 10 từ) nếu cần, rồi kết thúc.
4. NGÔN NGỮ: Tiếng Việt, ngắn gọn.

ĐỊNH DẠNG UI (bắt buộc dùng khi có dữ liệu):
- Danh sách sản phẩm: [UI:PRODUCT_LIST:{"products":[...]}]
- Chi tiết 1 sản phẩm: [UI:PRODUCT_DETAIL:{"product":{...}}]
- Giỏ hàng: [UI:CART_SUMMARY:{"total":..., "count":...}]
- Gợi ý: [UI:RECOMMENDATIONS:{"items":[...]}]
- Thông báo: [UI:NOTIFICATIONS:{"list":[...]}]
`;

const ADMIN_INSTRUCTION = `
Bạn là Trợ lý Vận hành (Admin Copilot) của D4C Clothing Shop.

QUY TẮC PHẢN HỒI (BẮT BUỘC):
1. HÀNH ĐỘNG NGAY: Truy xuất số liệu hoặc thực hiện quản lý ngay khi có yêu cầu.
2. TRỰC QUAN: Sử dụng định dạng UI: [UI:TYPE:JSON_DATA] để hiển thị dashboard/bảng biểu.
3. CHÍNH XÁC: Luôn dựa vào dữ liệu từ Tool. KHÔNG hỏi lại sau khi đã có dữ liệu.

ĐỊNH DẠNG UI:
- Thống kê doanh thu: [UI:ADMIN_STATS:{"revenue":..., "orders":..., "period":...}]
- Báo cáo kho: [UI:INVENTORY_REPORT:{"items":..., "threshold":...}]
- Kết quả hành động (Tạo/Xóa): [UI:ACTION_RESULT:{"success":true, "message":"..."}]
`;

class GeminiService {
  async processChat(userId, role, incomingMessage) {
    try {
      const chatId = `${role.toLowerCase()}:${userId}`;
      const redisKey = `ai_session:${chatId}`;

      // 1. Fetch context from Redis
      let contextStr = await redisClient.get(redisKey);
      let history = contextStr ? JSON.parse(contextStr) : [];

      // Cap in-memory history to last 5 for Gemini context
      if (history.length > 5) history = history.slice(-5);

      // Format history for Gemini API — must start with 'user' and alternate roles
      let formattedHistory = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || '' }]
      }));

      // Strip leading 'model' messages — Gemini requires first entry is 'user'
      while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') {
        formattedHistory.shift();
      }

      // Ensure alternating roles: remove consecutive same-role entries (keep last)
      const geminiHistory = formattedHistory.reduce((acc, cur) => {
        if (acc.length > 0 && acc[acc.length - 1].role === cur.role) {
          acc[acc.length - 1] = cur;
        } else {
          acc.push(cur);
        }
        return acc;
      }, []);

      // 2. Initialize Model with Role-Specific System Instruction
      const systemInstruction = role === 'ADMIN' ? ADMIN_INSTRUCTION : USER_INSTRUCTION;
      console.log(`Processing chat for role: ${role} with userId: ${userId}`);

      let tools = [];
      let handlers = {};

      if (role === 'USER') {
        tools = [{ functionDeclarations: [...productToolDeclarations, ...cartOrderToolDeclarations, ...socialToolDeclarations] }];
        handlers = { ...productToolHandlers, ...cartOrderToolHandlers, ...socialToolHandlers };
      } else if (role === 'ADMIN') {
        tools = [{ functionDeclarations: [...adminStatsToolDeclarations, ...productToolDeclarations] }];
        handlers = { ...adminStatsToolHandlers, ...productToolHandlers };
      }

      const roleModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 2048,
          temperature: 0.7,
        }
      }, { baseUrl: PROXY_BASE_URL });

      const chatSession = roleModel.startChat({
        history: geminiHistory,
      });

      let result = await chatSession.sendMessage(incomingMessage);

      let functionCalls = typeof result.response.functionCalls === 'function'
        ? result.response.functionCalls()
        : result.response.functionCalls;

      // Handle Function Calling Loop
      while (functionCalls && functionCalls.length > 0) {
        const functionResponses = [];

        for (const call of functionCalls) {
          console.log(`Executing tool: ${call.name}`);
          let apiResponse;
          if (handlers[call.name]) {
            apiResponse = await handlers[call.name](call.args, userId);
          } else {
            apiResponse = { error: `Tool ${call.name} not implemented.` };
          }

          let safeResponse;
          if (Array.isArray(apiResponse)) {
            safeResponse = { result: apiResponse.slice(0, 5) };
          } else if (apiResponse === null || typeof apiResponse !== 'object') {
            safeResponse = { result: apiResponse };
          } else {
            safeResponse = apiResponse;
          }

          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: safeResponse
            }
          });
        }

        result = await chatSession.sendMessage(functionResponses);

        functionCalls = typeof result.response.functionCalls === 'function'
          ? result.response.functionCalls()
          : result.response.functionCalls;
      }

      const responseText = result.response.text();
      console.log(`AI Response for ${userId}: ${responseText}`);

      // 3. Update History
      const userMsg = { role: 'user', content: incomingMessage, timestamp: Date.now() };
      const modelMsg = { role: 'model', content: responseText, timestamp: Date.now() };

      history.push(userMsg, modelMsg);

      // Keep only last 15 messages in cache
      if (history.length > 15) {
        history = history.slice(-15);
      }

      // 4. Save to Redis only (7 days TTL)
      await redisClient.set(redisKey, JSON.stringify(history), "EX", 604800);

      return responseText;
    } catch (error) {
      console.error("Gemini Service Error:", error);
      throw new Error("Failed to process chat message");
    }
  }
}

export const geminiService = new GeminiService();
```

- [ ] **Step 2: Commit**

```bash
git add AIService/src/services/gemini.service.js
git commit -m "refactor: remove DynamoDB from gemini.service, Redis-only flow"
```

---

### Task 3: Rewrite `chat.controller.js` — identity from headers, add GET/DELETE endpoints

**Files:**
- Modify: `AIService/src/controllers/chat.controller.js`

- [ ] **Step 1: Rewrite the entire file**

Replace the full contents of `AIService/src/controllers/chat.controller.js` with:

```js
import { geminiService } from "../services/gemini.service.js";
import redisClient from "../config/redis.config.js";

class ChatController {
  _extractIdentity(req) {
    const userId = req.headers["x-user-id"];
    const rolesHeader = req.headers["x-user-roles"] || "";
    const roles = rolesHeader.split(",").map(r => r.trim()).filter(Boolean);
    const role = roles.length > 0 ? roles[0].toUpperCase() : "USER";

    if (!userId) {
      return null;
    }

    return { userId, role };
  }

  async getConversation(req, res) {
    try {
      const identity = this._extractIdentity(req);
      if (!identity) {
        return res.status(401).json({ error: "Unauthorized: missing user identity" });
      }

      const { userId, role } = identity;
      const redisKey = `ai_session:${role.toLowerCase()}:${userId}`;

      const contextStr = await redisClient.get(redisKey);
      const messages = contextStr ? JSON.parse(contextStr) : [];

      return res.status(200).json({
        success: true,
        data: { messages }
      });
    } catch (error) {
      console.error("Get Conversation Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async processMessage(req, res) {
    try {
      const identity = this._extractIdentity(req);
      if (!identity) {
        return res.status(401).json({ error: "Unauthorized: missing user identity" });
      }

      const { message } = req.body;
      const { userId, role } = identity;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const responseText = await geminiService.processChat(userId, role, message);

      return res.status(200).json({
        success: true,
        data: {
          reply: responseText,
          role: role
        }
      });
    } catch (error) {
      console.error("Chat Controller Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async clearConversation(req, res) {
    try {
      const identity = this._extractIdentity(req);
      if (!identity) {
        return res.status(401).json({ error: "Unauthorized: missing user identity" });
      }

      const { userId, role } = identity;
      const redisKey = `ai_session:${role.toLowerCase()}:${userId}`;

      await redisClient.del(redisKey);

      return res.status(200).json({
        success: true
      });
    } catch (error) {
      console.error("Clear Conversation Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const chatController = new ChatController();
```

- [ ] **Step 2: Commit**

```bash
git add AIService/src/controllers/chat.controller.js
git commit -m "feat: add identity-from-headers, GET/DELETE chat endpoints"
```

---

### Task 4: Update `chat.routes.js` — register GET and DELETE routes

**Files:**
- Modify: `AIService/src/routes/chat.routes.js`

- [ ] **Step 1: Rewrite the routes file**

Replace the full contents of `AIService/src/routes/chat.routes.js` with:

```js
import express from "express";
import { chatController } from "../controllers/chat.controller.js";

const router = express.Router();

// GET /api/v1/ai/chat — fetch conversation
router.get("/chat", chatController.getConversation);

// POST /api/v1/ai/chat — send message
router.post("/chat", chatController.processMessage);

// DELETE /api/v1/ai/chat — clear conversation
router.delete("/chat", chatController.clearConversation);

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add AIService/src/routes/chat.routes.js
git commit -m "feat: add GET and DELETE routes for chat"
```

---

### Task 5: Update frontend `aiApi.ts` — add GET/DELETE, remove userId/role from payload

**Files:**
- Modify: `frontend/src/services/aiApi.ts`

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `frontend/src/services/aiApi.ts` with:

```ts
import axiosInstance from "./_axios";

export interface AIChatPayload {
  message: string;
}

export interface AIChatResponse {
  success: boolean;
  data: {
    reply: string;
    role: string;
  };
}

export interface AIConversationResponse {
  success: boolean;
  data: {
    messages: {
      role: "user" | "model";
      content: string;
      timestamp: number;
    }[];
  };
}

export interface AIClearResponse {
  success: boolean;
}

export const sendChatMessage = (payload: AIChatPayload) =>
  axiosInstance
    .post<AIChatResponse>("/api/v1/ai/chat", payload)
    .then((res) => res.data);

export const getConversation = () =>
  axiosInstance
    .get<AIConversationResponse>("/api/v1/ai/chat")
    .then((res) => res.data);

export const clearConversation = () =>
  axiosInstance
    .delete<AIClearResponse>("/api/v1/ai/chat")
    .then((res) => res.data);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/aiApi.ts
git commit -m "feat: add getConversation and clearConversation API functions"
```

---

### Task 6: Update frontend `useChatStore.ts` — add `setMessages` action

**Files:**
- Modify: `frontend/src/store/useChatStore.ts`

- [ ] **Step 1: Add `setMessages` to the interface and implementation**

Replace the full contents of `frontend/src/store/useChatStore.ts` with:

```ts
import { create } from "zustand";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
}

interface ChatStore {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  messages: [
    {
      id: "welcome-msg",
      role: "model",
      content: "Xin chào! Mình là trợ lý AI của D4C. Bạn cần hỗ trợ gì hôm nay?",
      timestamp: Date.now(),
    },
  ],
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
  clearChat: () =>
    set({
      messages: [
        {
          id: "welcome-msg",
          role: "model",
          content: "Đã xóa lịch sử trò chuyện. Mình có thể giúp gì tiếp cho bạn?",
          timestamp: Date.now(),
        },
      ],
    }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/useChatStore.ts
git commit -m "feat: add setMessages action to chat store"
```

---

### Task 7: Rewrite `useAIChat.ts` — remove userId/role, add sync and clear

**Files:**
- Modify: `frontend/src/hooks/useAIChat.ts`

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `frontend/src/hooks/useAIChat.ts` with:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useAIChat.ts
git commit -m "feat: add syncConversation and clearChat with backend sync"
```

---

### Task 8: Update `AIChatWindow.tsx` — sync on open, use new clearChat

**Files:**
- Modify: `frontend/src/components/ai/AIChatWindow.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `frontend/src/components/ai/AIChatWindow.tsx` with:

```tsx
import { useState, useRef, useEffect } from "react";
import { X, Send, RotateCcw, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/src/store/useChatStore";
import { useAIChat } from "@/src/hooks/useAIChat";
import AIMessage from "./AIMessage";

const AIChatWindow = () => {
  const { messages, closeChat, isOpen } = useChatStore();
  const { sendMessage, isLoading, syncConversation, clearChat } = useAIChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const title = "D4C AI Stylist";

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync messages from backend when chat opens
  useEffect(() => {
    if (isOpen) {
      syncConversation();
    }
  }, [isOpen, syncConversation]);

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
            onClick={() => clearChat()}
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
            <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-primary border">
              <Bot className="size-5" />
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
            placeholder="Hỏi về sản phẩm, size..."
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ai/AIChatWindow.tsx
git commit -m "feat: sync on open, use backend-aware clearChat"
```

---

### Task 9: Update `AppLayout.tsx` and `AdminLayout.tsx` — remove role-based title prop

**Files:**
- Modify: `frontend/src/layouts/AppLayout.tsx`
- Modify: `frontend/src/layouts/AdminLayout.tsx`

- [ ] **Step 1: Check current AIChatBubble usage in both layouts**

Read both files to find how `AIChatBubble` is imported and used.

- [ ] **Step 2: Remove any role/title prop passed to AIChatBubble**

The `AIChatWindow` now has a hardcoded title `"D4C AI Stylist"`. If either layout passes a `title` prop to `AIChatBubble` or `AIChatWindow`, remove it.

For `AppLayout.tsx`, the usage should be simply:
```tsx
<AIChatBubble />
```

For `AdminLayout.tsx`, the usage should be simply:
```tsx
<AIChatBubble />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/layouts/
git commit -m "refactor: remove role-based title from AIChatBubble usage"
```

---

### Task 10: Verify and test

**Files:** No file changes.

- [ ] **Step 1: Verify AIService starts without errors**

```bash
cd AIService && npm install && npm run dev
```

Expected: `AIService running on port 8088`, `Registered with Eureka`, `Connected to Redis`. No import errors for `aws.config` or `chat.model`.

- [ ] **Step 2: Verify frontend builds**

```bash
cd frontend && npm run build
```

Expected: No TypeScript errors, no unused import warnings.

- [ ] **Step 3: Manual test flow**

1. Start the full stack: `docker compose up --build -d`
2. Open frontend, login as a user
3. Open chat bubble → should show welcome message
4. Send a message → should get AI response
5. Refresh page → open chat bubble → should see previous messages synced
6. Click clear button → chat resets, Redis key deleted
7. Refresh page → open chat bubble → should show only welcome message (no old messages)
8. Login as admin → open chat → should have separate conversation (different Redis key)

- [ ] **Step 4: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```

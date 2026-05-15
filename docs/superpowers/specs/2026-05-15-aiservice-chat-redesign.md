# AIService & Frontend Chat Redesign

**Date:** 2026-05-15
**Status:** Draft — awaiting user review

## 1. Goals

1. Remove DynamoDB storage — Redis only for conversation persistence.
2. Clear chat removes server-side Redis data (not just client state).
3. Forward identity via `X-User-*` headers from Gateway — remove `userId`/`role` from request body.
4. Sync messages from backend to frontend when user opens chat bubble (after page reload).
5. Keep single conversation thread per user+role, hardcoded proxy URL, and no streaming.

## 2. Architecture

### 2.1 API Gateway

No changes needed. `JwtValidationFilter` already forwards:
- `X-User-Id`
- `X-User-Username`
- `X-User-Email`
- `X-User-Roles`

Route `/api/v1/ai/**` → `lb://AISERVICE` is already configured.

### 2.2 AIService (Node.js/Express)

#### Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/api/v1/ai/chat` | `getConversation` | Fetch messages from Redis |
| POST | `/api/v1/ai/chat` | `processMessage` | Send message, get AI reply |
| DELETE | `/api/v1/ai/chat` | `clearConversation` | Delete Redis session |

#### Identity Extraction

All three endpoints extract identity from headers:
- `userId` = `X-User-Id` header (required)
- `role` = first value from `X-User-Roles` header, uppercased (required, default `"USER"` if empty)
- Missing `X-User-Id` → 401 Unauthorized

#### Redis Key Format

```
ai_session:${role}:${userId}
```

Example: `ai_session:USER:123`, `ai_session:ADMIN:456`

#### Data Format

**Redis value:** JSON array of message objects:
```json
[
  { "role": "user", "content": "Tìm áo thun", "timestamp": 1715700000000 },
  { "role": "model", "content": "Đây là danh sách...", "timestamp": 1715700001000 }
]
```

**TTL:** 7 days (604800 seconds)
**Max size:** 15 messages (sliding window)
**Gemini context:** last 5 messages from Redis

### 2.3 Files Changed — Backend

| File | Action |
|------|--------|
| `AIService/src/controllers/chat.controller.js` | Rewrite: add `getConversation`, `clearConversation`, update `processMessage` to use headers |
| `AIService/src/services/gemini.service.js` | Remove DynamoDB code, keep Redis-only flow |
| `AIService/src/routes/chat.routes.js` | Add GET and DELETE routes |
| `AIService/src/models/chat.model.js` | Delete (no longer needed) |
| `AIService/src/config/aws.config.js` | Delete if no other service imports it |

### 2.4 Files Changed — Frontend

| File | Action |
|------|--------|
| `frontend/src/services/aiApi.ts` | Add `getConversation`, `clearConversation`; remove `userId`/`role` from `AIChatPayload` |
| `frontend/src/store/useChatStore.ts` | Add `setMessages` action |
| `frontend/src/hooks/useAIChat.ts` | Remove `userId`/`role` from payload; add `syncConversation` and `clearChat` (backend-aware) |
| `frontend/src/components/ai/AIChatWindow.tsx` | Sync on open; use new `clearChat` from hook |

## 3. Data Flow

### 3.1 Send Message

```
Frontend: useAIChat.sendMessage(message)
  → POST /api/v1/ai/chat (JWT bearer, no userId/role in body)
  → Gateway: validates JWT, injects X-User-* headers
  → AIService: extract userId/role from headers
  → Redis: GET ai_session:${role}:${userId}
  → Gemini: process with last 5 messages context + tools
  → Redis: SET ai_session:${role}:${userId} (15 msgs, 7d TTL)
  → Response: { success: true, data: { reply, role } }
  → Frontend: add AI reply to Zustand store
```

### 3.2 Sync on Open

```
User clicks chat bubble → isOpen = true
  → AIChatWindow useEffect triggers
  → useAIChat.syncConversation()
    → GET /api/v1/ai/chat (JWT bearer)
    → Gateway: validates JWT, injects X-User-* headers
    → AIService: extract identity, GET Redis key
    → If key exists: return { success: true, data: { messages } }
    → If key missing: return { success: true, data: { messages: [] } }
    → Frontend: convert messages → setMessages()
    → If empty: reset to welcome message
```

### 3.3 Clear Chat

```
User clicks clear button
  → useAIChat.clearChat()
    → DELETE /api/v1/ai/chat (JWT bearer)
    → Gateway: validates JWT, injects X-User-* headers
    → AIService: extract identity, DEL Redis key
    → Response: { success: true }
    → Frontend: Zustand.clearChat() (reset to welcome message)
```

## 4. Error Handling

| Scenario | Response |
|----------|----------|
| Missing `X-User-Id` header | 401 `{ error: "Unauthorized" }` |
| Redis connection error | 500 `{ error: "Internal server error" }` |
| Gemini API error | 500 `{ error: "Internal server error" }` |
| Empty message body (POST) | 400 `{ error: "Message is required" }` |
| Frontend GET/DELETE fails | Error message in chat UI |

## 5. Security

- Identity is **only** trusted from Gateway-injected headers (`X-User-Id`, `X-User-Roles`).
- Request body `userId` and `role` fields are **ignored** and removed from the API contract.
- Gateway JWT validation is the sole authentication gate.
- No CORS changes needed (handled by Gateway).

## 6. Out of Scope

- Multi-thread conversations
- Streaming responses
- Configurable proxy URL
- Message pagination
- Admin impersonation

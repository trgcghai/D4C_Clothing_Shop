# Frontend Query Retry — Design

**Date:** 2026-05-27
**Status:** Draft
**Author:** AI Assistant

## Summary

Add automatic retry for all frontend GET queries using TanStack Query's built-in retry mechanism. Configure globally via `QueryClient` defaults: 2 retries with exponential backoff (1s → 2s). Remove `retry: false` from query hooks where retry is appropriate. No new dependencies needed.

## Architecture

### QueryClient Configuration

Modify `frontend/src/App.tsx` line 70:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 2000),
    },
  },
});
```

### Parameters

| Parameter | Value | Description |
|---|---|---|
| retry | 2 | Maximum retry attempts (3 total: 1 original + 2 retries) |
| retryDelay | 1s → 2s | Exponential backoff, capped at 2s |
| retryCondition | default | Retries on 5xx and network errors, not on 4xx |

### How It Works

```
Frontend → Gateway (503)
         ↓ wait 1s
         → Gateway (503)
         ↓ wait 2s
         → Gateway (200 OK) ✅
         ↓ render UI
```

If all 3 attempts fail → error state, user sees error toast.

### Hooks to Update

Remove `retry: false` from these `useQuery` calls:

| File | Hook | Query | Reason |
|---|---|---|---|
| `useAuth.ts` | `useMe()` | GET `/api/users/me` | Should retry if gateway briefly down |
| `useAIChat.ts` | `useChatHistory()` | GET `/api/ai/chat` | Should retry for better UX |
| `useCart.ts` | `useCart()` | GET `/api/cart/:userId` | Should retry — cart is critical path |

Keep `retry: false` on all `useMutation` calls (login, logout, checkout, etc.) — mutations should NOT auto-retry.

## Error Handling

### Retried Conditions

- HTTP 502 (Bad Gateway)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)
- Network errors (connection refused, timeout, DNS failure)

### NOT Retried

- HTTP 4xx errors (400, 401, 403, 404)
- Mutations (POST/PUT/DELETE/PATCH)
- Successful responses (2xx)

### Edge Cases

| Scenario | Behavior |
|---|---|
| Gateway down | Frontend retries 2x → gateway retry also fires → high success rate |
| Service down | Frontend retry → gateway retry → service retry (Resilience4j) — different layers, no conflict |
| Auth failure (401) | Not retried — existing 401 interceptor handles token refresh |
| User offline | Retries fail after ~3s → user sees network error |
| Slow service | Retries add ~3s to 120s timeout — well within budget |

## Monitoring

- TanStack Query DevTools (browser extension) shows retry attempts
- Network tab in browser dev tools shows repeated requests
- No server-side monitoring needed — gateway logs already track incoming requests

## Testing

### Manual Testing

1. Start full stack: `docker compose up --build -d`
2. Open browser dev tools → Network tab
3. Stop gateway: `docker compose stop api-gateway`
4. Navigate to product list page
5. Observe: 3 request attempts with ~1s and ~2s delays
6. After retries fail → error toast appears
7. Restart gateway: `docker compose start api-gateway`
8. Refresh page → should succeed

### Alternative Test

Use browser dev tools Network throttling → set to "Offline" → load page → observe retries → switch to "Online" during retry chain → request should succeed.

## Dependencies

No new dependencies. TanStack Query (`@tanstack/react-query`) is already installed.

## Rollback

Revert `QueryClient` config to `new QueryClient()` and restore `retry: false` in updated hooks.

import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/errors'

const DEFAULT_STALE_TIME = 30_000
const DEFAULT_GC_TIME = 300_000
const MAX_RETRIES = 1

function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount > MAX_RETRIES) {
    return false
  }

  if (!isApiError(error)) {
    return true
  }

  if (error.status === 429) {
    return true
  }

  return error.status >= 500 || error.status === 0
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: DEFAULT_STALE_TIME,
      gcTime: DEFAULT_GC_TIME,
      refetchOnWindowFocus: false,
    },
  },
})

import { http, setAccessToken as setHttpAccessToken, setRefreshTokenHandler } from '@/lib/api/http'
import { isApiError } from '@/lib/api/errors'

const ACCESS_TOKEN_STORAGE_KEY = 'd4c.auth.accessToken'

export type MaybeRole = string | null | undefined

function readStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    return token && token.length > 0 ? token : null
  } catch {
    return null
  }
}

let accessTokenCache: string | null = readStoredAccessToken()
setHttpAccessToken(accessTokenCache)

function extractAccessToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const token = Reflect.get(payload, 'token')
  return typeof token === 'string' && token.length > 0 ? token : null
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await http<unknown>('/api/auth/refresh-token', {
      method: 'POST',
    })
    const token = extractAccessToken(response)

    if (!token) {
      return null
    }

    setAccessToken(token)
    return token
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return null
    }

    throw error
  }
}

setRefreshTokenHandler(refreshAccessToken)

export function normalizeRole(role: MaybeRole): string | null {
  if (typeof role !== 'string' || role.length === 0) {
    return null
  }

  return role.startsWith('ROLE_') ? role : `ROLE_${role}`
}

export function isAdminRole(role: MaybeRole): boolean {
  return normalizeRole(role) === 'ROLE_ADMIN'
}

export function getSignInRedirectByRole(role: MaybeRole): '/' | '/admin' {
  return isAdminRole(role) ? '/admin' : '/'
}

export function getAuthGuardRedirect(token: string | null): '/signin' | null {
  return token ? null : '/signin'
}

export function getAdminGuardRedirect(role: MaybeRole): '/' | null {
  return isAdminRole(role) ? null : '/'
}

export function getAccessToken(): string | null {
  return accessTokenCache
}

export function setAccessToken(token: string | null) {
  accessTokenCache = token
  setHttpAccessToken(token)

  if (typeof window === 'undefined') {
    return
  }

  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
      return
    }

    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}

export function clearAccessToken() {
  setAccessToken(null)
}

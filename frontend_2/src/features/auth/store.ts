import { setAccessToken as setHttpAccessToken } from '@/lib/api/http'

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

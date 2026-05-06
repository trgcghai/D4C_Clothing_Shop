import { ApiError, toApiError } from './errors'
import type { ApiErrorDetails } from './errors'

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

type RefreshTokenHandler = () => Promise<string | null>

const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL || ''
const REFRESH_TOKEN_PATH = '/api/auth/refresh-token'
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const

let accessToken: string | null = null
let refreshTokenHandler: RefreshTokenHandler | null = null
let refreshTokenPromise: Promise<string | null> | null = null

function buildUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  if (!API_BASE_URL) return path
  const base = API_BASE_URL.replace(/\/+$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

function isRefreshTokenRequest(path: string) {
  return path === REFRESH_TOKEN_PATH
}

function isBodyInit(body: unknown): body is BodyInit {
  if (typeof body === 'string' || body instanceof Blob || body instanceof FormData) {
    return true
  }
  if (body instanceof URLSearchParams || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return true
  }
  return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
}

function toBody(body: unknown): BodyInit | undefined {
  if (body == null) return undefined
  if (isBodyInit(body)) return body
  return JSON.stringify(body)
}

function shouldSetJsonContentType(body: unknown): boolean {
  return body == null || typeof body === 'string' || (!isBodyInit(body) && !(body instanceof URLSearchParams))
}

async function parseErrorDetails(response: Response): Promise<ApiErrorDetails | undefined> {
  const contentType = response.headers.get('content-type')
  if (!contentType) return undefined
  try {
    if (contentType.includes('application/json')) {
      return (await response.json()) as ApiErrorDetails
    }
    const text = await response.text()
    if (!text) return undefined
    return { message: text }
  } catch {
    return undefined
  }
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) return undefined as T
  const payload = await response.text()
  if (!payload) return undefined as T
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) return JSON.parse(payload) as T
  return payload as T
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshTokenHandler) return null
  if (!refreshTokenPromise) {
    refreshTokenPromise = refreshTokenHandler().finally(() => {
      refreshTokenPromise = null
    })
  }
  return refreshTokenPromise
}

async function requestInternal<T>(path: string, options: RequestOptions = {}, allowRefresh = true): Promise<T> {
  const headers: Record<string, string> = { ...DEFAULT_HEADERS, ...options.headers }
  const rawBody = options.body
  const body = toBody(rawBody)

  if (!shouldSetJsonContentType(rawBody)) delete headers['Content-Type']
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(buildUrl(path), {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
    body,
  })

  if (response.status === 401 && allowRefresh && !isRefreshTokenRequest(path)) {
    if (refreshTokenHandler) {
      try {
        const refreshedToken = await refreshAccessToken()
        if (refreshedToken) {
          accessToken = refreshedToken
          return requestInternal<T>(path, options, false)
        }
      } catch {
        // fall through
      }
    }
    accessToken = null
  }

  if (!response.ok) {
    const details = await parseErrorDetails(response)
    const message = typeof details?.message === 'string' ? details.message : response.statusText || 'Request failed'
    throw new ApiError(message, response.status, details)
  }

  return await parseSuccess<T>(response)
}

export async function http<T>(path: string, options?: RequestOptions): Promise<T> {
  try {
    return await requestInternal<T>(path, options)
  } catch (error) {
    throw toApiError(error)
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setRefreshTokenHandler(handler: RefreshTokenHandler | null) {
  refreshTokenHandler = handler
}

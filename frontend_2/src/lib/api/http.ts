import { ApiError, toApiError } from './errors'
import type { ApiErrorDetails } from './errors'

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

type RefreshTokenHandler = () => Promise<string | null>

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
} as const

let accessToken: string | null = null
let refreshTokenHandler: RefreshTokenHandler | null = null

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }
  return `${API_BASE_URL}${path}`
}

function toBody(body: unknown): BodyInit | undefined {
  if (body == null) {
    return undefined
  }
  if (body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string') {
    return body
  }
  return JSON.stringify(body)
}

async function parseErrorDetails(response: Response): Promise<ApiErrorDetails | undefined> {
  const contentType = response.headers.get('content-type')
  if (!contentType) {
    return undefined
  }

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as ApiErrorDetails
      return payload
    }
    const text = await response.text()
    if (!text) {
      return undefined
    }
    return { message: text }
  } catch {
    return undefined
  }
}

async function requestInternal<T>(
  path: string,
  options: RequestOptions = {},
  allowRefresh = true,
): Promise<T> {
  const headers: Record<string, string> = { ...DEFAULT_HEADERS, ...options.headers }
  const rawBody = options.body
  const body = toBody(rawBody)

  if (rawBody instanceof FormData) {
    delete headers['Content-Type']
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    body,
  })

  if (response.status === 401 && allowRefresh && refreshTokenHandler) {
    const refreshedToken = await refreshTokenHandler()
    if (refreshedToken) {
      accessToken = refreshedToken
      return requestInternal<T>(path, options, false)
    }
  }

  if (!response.ok) {
    const details = await parseErrorDetails(response)
    const message =
      typeof details?.message === 'string' ? details.message : response.statusText || 'Request failed'
    throw new ApiError(message, response.status, details)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
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

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { ApiError, toApiError } from './errors'
import type { ApiErrorDetails } from './errors'

const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL || ''

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

let accessToken: string | null = null
let refreshTokenPromise: Promise<string | null> | null = null
let refreshTokenHandler: (() => Promise<string | null>) | null = null

const REFRESH_TOKEN_PATH = '/api/auth/refresh-token'

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

function isRefreshTokenRequest(url: string | undefined): boolean {
  return url === REFRESH_TOKEN_PATH
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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshTokenRequest(originalRequest.url)) {
      originalRequest._retry = true

      if (refreshTokenHandler) {
        try {
          const newToken = await refreshAccessToken()
          if (newToken) {
            accessToken = newToken
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${newToken}`,
            }
            return api(originalRequest)
          }
        } catch {
          // fall through
        }
      }

      accessToken = null
    }

    return Promise.reject(error)
  },
)

export async function http<T>(path: string, options?: { body?: unknown; method?: string; headers?: Record<string, string> }): Promise<T> {
  try {
    const { body, method = 'GET', headers } = options || {}
    const config: AxiosRequestConfig = {
      url: path,
      method,
      headers,
    }

    if (body && method !== 'GET') {
      config.data = body
    }

    const response = await api(config)
    return response.data as T
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const details = error.response?.data as ApiErrorDetails | undefined
      const message = typeof details?.message === 'string' ? details.message : error.message || 'Request failed'
      throw new ApiError(message, status, details)
    }
    throw toApiError(error)
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setRefreshTokenHandler(handler: (() => Promise<string | null>) | null) {
  refreshTokenHandler = handler
}

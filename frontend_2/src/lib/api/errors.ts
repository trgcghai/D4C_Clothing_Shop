export interface ApiErrorDetails {
  readonly [key: string]: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly details?: ApiErrorDetails

  constructor(message: string, status: number, details?: ApiErrorDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

export function toApiError(error: unknown, fallbackMessage = 'Request failed'): ApiError {
  if (isApiError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 0)
  }

  return new ApiError(fallbackMessage, 0)
}

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  changePassword,
  extractSignInToken,
  signIn,
  signUp,
  updateProfile,
} from './api'
import { ApiError } from '@/lib/api/errors'
import {
  getAdminGuardRedirect,
  getAuthGuardRedirect,
  getSignInRedirectByRole,
} from './store'
import { clearAccessToken, getAccessToken, setAccessToken } from './store'

vi.mock('@/lib/api/http', () => ({
  http: vi.fn(),
  setAccessToken: vi.fn(),
  setRefreshTokenHandler: vi.fn(),
}))

const { http } = await import('@/lib/api/http')
const { isUnauthorizedMeError, resolvePostSignInRedirectPath } = await import('./hooks')

describe('auth flow contract', () => {
  beforeEach(() => {
    vi.mocked(http).mockReset()
    clearAccessToken()
  })

  it('extracts token from sign-in response payload', () => {
    expect(extractSignInToken({ token: 'abc-token' })).toBe('abc-token')
    expect(extractSignInToken({ accessToken: 'wrong-field' })).toBeNull()
  })

  it('sends exact sign-in payload to /api/auth/signin', async () => {
    vi.mocked(http).mockResolvedValueOnce({ token: 'signed-token' })

    await signIn({ username: 'demo', password: 'secret123' })

    expect(http).toHaveBeenCalledWith('/api/auth/signin', {
      body: { username: 'demo', password: 'secret123' },
      method: 'POST',
    })
  })

  it('sends exact sign-up payload to /api/auth/signup', async () => {
    vi.mocked(http).mockResolvedValueOnce({ message: 'User registered successfully!' })

    await signUp({
      email: 'demo@mail.com',
      fullName: 'Demo User',
      password: 'secret123',
      phoneNumber: '0900000000',
      username: 'demo',
    })

    expect(http).toHaveBeenCalledWith('/api/auth/signup', {
      body: {
        email: 'demo@mail.com',
        fullName: 'Demo User',
        password: 'secret123',
        phoneNumber: '0900000000',
        username: 'demo',
      },
      method: 'POST',
    })
  })

  it('uses /api/users/me and /api/users/me/password endpoints', async () => {
    vi.mocked(http).mockResolvedValue({})

    await updateProfile({
      avatar: 'https://example.com/avatar.png',
      fullName: 'Demo User',
      phoneNumber: '0900000000',
    })
    await changePassword({ newPassword: 'secret456', oldPassword: 'secret123' })

    expect(http).toHaveBeenNthCalledWith(1, '/api/users/me', {
      body: {
        avatar: 'https://example.com/avatar.png',
        fullName: 'Demo User',
        phoneNumber: '0900000000',
      },
      method: 'PUT',
    })
    expect(http).toHaveBeenNthCalledWith(2, '/api/users/me/password', {
      body: { newPassword: 'secret456', oldPassword: 'secret123' },
      method: 'PUT',
    })
  })

  it('returns guard redirects for auth and role constraints', () => {
    expect(getAuthGuardRedirect(null)).toBe('/signin')
    expect(getAuthGuardRedirect('token')).toBeNull()
    expect(getAdminGuardRedirect('ROLE_USER')).toBe('/')
    expect(getAdminGuardRedirect('ADMIN')).toBeNull()
  })

  it('treats only 401 and 403 as unauthorized me errors', () => {
    expect(isUnauthorizedMeError(new ApiError('Unauthorized', 401))).toBe(true)
    expect(isUnauthorizedMeError(new ApiError('Forbidden', 403))).toBe(true)
    expect(isUnauthorizedMeError(new ApiError('Server error', 500))).toBe(false)
    expect(isUnauthorizedMeError(new Error('Network failed'))).toBe(false)
  })

  it('routes sign-in success by role', () => {
    expect(getSignInRedirectByRole('ROLE_ADMIN')).toBe('/admin')
    expect(getSignInRedirectByRole('ROLE_USER')).toBe('/')
    expect(getSignInRedirectByRole(null)).toBe('/')
  })

  it('falls back to sign-in role when profile hydration fails transiently', async () => {
    const queryClient = new QueryClient()
    setAccessToken('signed-token')
    vi.mocked(http).mockRejectedValueOnce(new ApiError('Server error', 500))

    await expect(resolvePostSignInRedirectPath(queryClient, 'ROLE_ADMIN')).resolves.toBe('/admin')
    expect(getAccessToken()).toBe('signed-token')
  })

  it('clears the token when profile hydration is unauthorized after sign-in', async () => {
    const queryClient = new QueryClient()
    setAccessToken('signed-token')
    vi.mocked(http).mockRejectedValueOnce(new ApiError('Unauthorized', 401))

    await expect(resolvePostSignInRedirectPath(queryClient, 'ROLE_ADMIN')).rejects.toBeInstanceOf(ApiError)
    expect(getAccessToken()).toBeNull()
  })
})

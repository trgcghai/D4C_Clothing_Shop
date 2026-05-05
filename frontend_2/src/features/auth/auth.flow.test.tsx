// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changePassword,
  extractSignInToken,
  signIn,
  signUp,
  updateProfile,
} from './api'
import {
  getAdminGuardRedirect,
  getAuthGuardRedirect,
  getSignInRedirectByRole,
} from './store'

vi.mock('@/lib/api/http', () => ({
  http: vi.fn(),
  setAccessToken: vi.fn(),
}))

const { http } = await import('@/lib/api/http')

describe('auth flow contract', () => {
  beforeEach(() => {
    vi.mocked(http).mockReset()
  })

  it('extracts token from sign-in response payload', () => {
    expect(extractSignInToken({ token: 'abc-token' })).toBe('abc-token')
    expect(extractSignInToken({ accessToken: 'wrong-field' })).toBeNull()
  })

  it('sends exact sign-in payload to /auth/signin', async () => {
    vi.mocked(http).mockResolvedValueOnce({ token: 'signed-token' })

    await signIn({ username: 'demo', password: 'secret123' })

    expect(http).toHaveBeenCalledWith('/auth/signin', {
      body: { username: 'demo', password: 'secret123' },
      method: 'POST',
    })
  })

  it('sends exact sign-up payload to /auth/signup', async () => {
    vi.mocked(http).mockResolvedValueOnce({ message: 'User registered successfully!' })

    await signUp({
      email: 'demo@mail.com',
      fullName: 'Demo User',
      password: 'secret123',
      phoneNumber: '0900000000',
      username: 'demo',
    })

    expect(http).toHaveBeenCalledWith('/auth/signup', {
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

  it('uses /users/me and /users/me/password endpoints', async () => {
    vi.mocked(http).mockResolvedValue({})

    await updateProfile({
      avatar: 'https://example.com/avatar.png',
      fullName: 'Demo User',
      phoneNumber: '0900000000',
    })
    await changePassword({ newPassword: 'secret456', oldPassword: 'secret123' })

    expect(http).toHaveBeenNthCalledWith(1, '/users/me', {
      body: {
        avatar: 'https://example.com/avatar.png',
        fullName: 'Demo User',
        phoneNumber: '0900000000',
      },
      method: 'PUT',
    })
    expect(http).toHaveBeenNthCalledWith(2, '/users/me/password', {
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

  it('routes sign-in success by role', () => {
    expect(getSignInRedirectByRole('ROLE_ADMIN')).toBe('/admin')
    expect(getSignInRedirectByRole('ROLE_USER')).toBe('/')
    expect(getSignInRedirectByRole(null)).toBe('/')
  })
})

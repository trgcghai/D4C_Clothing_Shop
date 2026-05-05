import { http } from '@/lib/api/http'

import { normalizeRole } from './store'

export interface SignInPayload {
  readonly username: string
  readonly password: string
}

export interface SignUpPayload {
  readonly username: string
  readonly email: string
  readonly fullName: string
  readonly phoneNumber: string
  readonly password: string
}

export interface SignInResponse {
  readonly token: string
  readonly type?: string
  readonly username: string
  readonly role: string | null
}

export interface UserProfile {
  readonly id: number
  readonly username: string
  readonly email: string
  readonly fullName: string
  readonly phoneNumber: string
  readonly avatar: string | null
  readonly role: string | null
}

export interface UpdateProfilePayload {
  readonly fullName: string
  readonly phoneNumber: string
  readonly avatar: string
}

export interface ChangePasswordPayload {
  readonly oldPassword: string
  readonly newPassword: string
}

export interface MessageResponse {
  readonly message: string
}

export function extractSignInToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const token = Reflect.get(payload, 'token')
  return typeof token === 'string' && token.length > 0 ? token : null
}

export async function signIn(payload: SignInPayload): Promise<SignInResponse> {
  const response = await http<SignInResponse>('/api/auth/signin', {
    body: payload,
    method: 'POST',
  })

  return {
    ...response,
    role: normalizeRole(response.role),
  }
}

export async function signUp(payload: SignUpPayload): Promise<MessageResponse> {
  return await http<MessageResponse>('/api/auth/signup', {
    body: payload,
    method: 'POST',
  })
}

export async function getMe(): Promise<UserProfile> {
  const response = await http<UserProfile>('/api/users/me', { method: 'GET' })
  return {
    ...response,
    role: normalizeRole(response.role),
  }
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const response = await http<UserProfile>('/api/users/me', {
    body: payload,
    method: 'PUT',
  })

  return {
    ...response,
    role: normalizeRole(response.role),
  }
}

export async function changePassword(payload: ChangePasswordPayload): Promise<MessageResponse> {
  return await http<MessageResponse>('/api/users/me/password', {
    body: payload,
    method: 'PUT',
  })
}

export async function signOut(): Promise<MessageResponse> {
  return await http<MessageResponse>('/api/auth/signout', {
    body: {},
    method: 'POST',
  })
}

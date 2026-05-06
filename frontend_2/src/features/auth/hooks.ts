import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { isApiError } from '@/lib/api/errors'
import { qk } from '@/lib/query/keys'

import {
  changePassword,
  extractSignInToken,
  getMe,
  signIn,
  signOut,
  signUp,
  updateProfile,
} from './api'
import type { SignInPayload, SignUpPayload, UpdateProfilePayload } from './api'
import {
  clearAccessToken,
  getAccessToken,
  getSignInRedirectByRole,
  setAccessToken,
} from './store'
import type { MaybeRole } from './store'

const isClient = typeof window !== 'undefined'

export function getMeQueryOptions() {
  return queryOptions({
    queryFn: getMe,
    queryKey: qk.auth.me(),
    retry: false,
    staleTime: 0,
    enabled: isClient && Boolean(getAccessToken()),
  })
}

export async function readAuthenticatedProfile(queryClient: QueryClient) {
  return await queryClient.fetchQuery(getMeQueryOptions())
}

export async function readSignInRedirectPath(queryClient: QueryClient): Promise<string | null> {
  if (!isClient || !getAccessToken()) {
    return null
  }

  try {
    const profile = await readAuthenticatedProfile(queryClient)
    return getSignInRedirectByRole(profile.role)
  } catch (error) {
    if (isUnauthorizedMeError(error)) {
      clearAccessToken()
      queryClient.removeQueries({ queryKey: qk.auth.me() })
    }
    return null
  }
}

export async function resolvePostSignInRedirectPath(queryClient: QueryClient, fallbackRole: MaybeRole): Promise<'/' | '/admin'> {
  try {
    const profile = await readAuthenticatedProfile(queryClient)
    return getPostSignInRedirectPath(profile.role ?? fallbackRole)
  } catch (error) {
    queryClient.removeQueries({ queryKey: qk.auth.me() })

    if (isUnauthorizedMeError(error)) {
      clearAccessToken()
      throw error
    }

    return getPostSignInRedirectPath(fallbackRole)
  }
}

export function isUnauthorizedMeError(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.status === 403)
}

export function useMeQuery() {
  return useQuery({
    ...getMeQueryOptions(),
    staleTime: 30_000,
    enabled: isClient && Boolean(getAccessToken()),
  })
}

export function useSignInMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SignInPayload) => {
      const response = await signIn(payload)
      const token = extractSignInToken(response)

      if (!token) {
        throw new Error('Access token is missing in sign-in response')
      }

      setAccessToken(token)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        exact: true,
        queryKey: qk.auth.me(),
      })
    },
  })
}

export function useSignUpMutation() {
  return useMutation({
    mutationFn: (payload: SignUpPayload) => signUp(payload),
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (profile) => {
      queryClient.setQueryData(qk.auth.me(), profile)
    },
  })
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: changePassword,
  })
}

export function useSignOutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: signOut,
    onSettled: () => {
      clearAccessToken()
      queryClient.removeQueries({ queryKey: qk.auth.me() })
    },
  })
}

export function getPostSignInRedirectPath(role: MaybeRole) {
  return getSignInRedirectByRole(role)
}

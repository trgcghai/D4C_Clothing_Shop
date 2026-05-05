import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

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

export function getMeQueryOptions() {
  return queryOptions({
    queryFn: getMe,
    queryKey: qk.auth.me(),
    retry: false,
  })
}

export async function readAuthenticatedProfile(queryClient: QueryClient) {
  return await queryClient.fetchQuery(getMeQueryOptions())
}

export async function readSignInRedirectPath(queryClient: QueryClient): Promise<string | null> {
  if (!getAccessToken()) {
    return null
  }

  try {
    const profile = await readAuthenticatedProfile(queryClient)
    return getSignInRedirectByRole(profile.role)
  } catch {
    clearAccessToken()
    queryClient.removeQueries({ queryKey: qk.auth.me() })
    return null
  }
}

export function useMeQuery() {
  return useQuery({
    ...getMeQueryOptions(),
    enabled: Boolean(getAccessToken()),
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

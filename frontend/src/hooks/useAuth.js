import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changePassword, getMe, updateMe } from "../api/users";
import { signIn, signUp } from "../api/auth";
import { normalizeRole } from "../lib/auth-role";

export const authQueryKeys = {
  all: ["auth"],
  me: () => ["auth", "me"],
};

export function getMeQueryOptions() {
  return {
    queryKey: authQueryKeys.me(),
    queryFn: ({ signal }) => getMe({ signal }),
    retry: false,
    staleTime: 60000,
    select: (data) => ({ ...data, role: normalizeRole(data?.role) }),
  };
}

export function useAuthBootstrapQuery(accessToken) {
  return useQuery({
    ...getMeQueryOptions(),
    enabled: Boolean(accessToken),
  });
}

export function useSignInMutation() {
  return useMutation({
    mutationFn: signIn,
  });
}

export function useSignUpMutation() {
  return useMutation({
    mutationFn: signUp,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (data) => {
      queryClient.setQueryData(authQueryKeys.me(), {
        ...data,
        role: normalizeRole(data?.role),
      });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: changePassword,
  });
}


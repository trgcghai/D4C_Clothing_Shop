import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, toggleUserStatus, type UserFilters, type ToggleUserStatusPayload } from "../services/userAdminApi";

export const userKeys = {
  all: ["admin-users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
};

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters ?? {}),
    queryFn: () => getUsers(filters),
    staleTime: 30_000,
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { userId: number; payload?: ToggleUserStatusPayload }) =>
      toggleUserStatus(vars.userId, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

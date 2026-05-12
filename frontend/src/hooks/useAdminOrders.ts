import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminOrderById,
  getAdminOrders,
  getOrderAudits,
  type AdminOrderFilters,
  type UpdateOrderStatusPayload,
  updateAdminOrderStatus,
} from "@/src/services/orderAdminApi";

export const adminOrderKeys = {
  all: ["admin-orders"] as const,
  lists: () => [...adminOrderKeys.all, "list"] as const,
  list: (filters: AdminOrderFilters) =>
    [...adminOrderKeys.lists(), filters] as const,
  detail: (id: number) => [...adminOrderKeys.all, "detail", id] as const,
  audits: (id: number) => [...adminOrderKeys.all, "audits", id] as const,
};

export function useAdminOrders(filters?: AdminOrderFilters) {
  return useQuery({
    queryKey: adminOrderKeys.list(filters ?? {}),
    queryFn: () => getAdminOrders(filters),
    staleTime: 20_000,
  });
}

export function useAdminOrderDetail(orderId: number | null) {
  return useQuery({
    queryKey: adminOrderKeys.detail(orderId ?? 0),
    queryFn: () => getAdminOrderById(orderId as number),
    enabled: orderId !== null,
  });
}

export function useOrderAudits(orderId: number | null) {
  return useQuery({
    queryKey: adminOrderKeys.audits(orderId ?? 0),
    queryFn: () => getOrderAudits(orderId as number),
    enabled: orderId !== null,
  });
}

export function useUpdateAdminOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { orderId: number; payload: UpdateOrderStatusPayload }) =>
      updateAdminOrderStatus(vars.orderId, vars.payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminOrderKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: adminOrderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({
        queryKey: adminOrderKeys.audits(variables.orderId),
      });
    },
  });
}

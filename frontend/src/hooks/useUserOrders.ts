import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  cancelOrder,
  createOrderFromCheckout,
  getOrdersByUserPaginated,
  getUserOrderDetail,
  type CreateOrderPayload,
} from "@/src/services/orderApi";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export const userOrderKeys = {
  all: ["user-orders"] as const,
  lists: () => [...userOrderKeys.all, "list"] as const,
  list: () => [...userOrderKeys.lists()] as const,
  detail: (id: number) => [...userOrderKeys.all, "detail", id] as const,
};

export function useUserOrders() {
  return useInfiniteQuery({
    queryKey: userOrderKeys.list(),
    queryFn: ({ pageParam }) =>
      getOrdersByUserPaginated({ page: pageParam, size: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.last) return undefined;
      return lastPage.page + 1;
    },
  });
}

export function useUserOrderDetail(orderId: number | null) {
  return useQuery({
    queryKey: userOrderKeys.detail(orderId ?? 0),
    queryFn: () => getUserOrderDetail(orderId as number),
    enabled: orderId !== null,
  });
}

export function useCreateOrderFromCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrderPayload) =>
      createOrderFromCheckout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userOrderKeys.lists() });
    },
    onError: (error) => {
      console.error("Failed to create order from checkout:", error);
      toast.error("Failed to create order. Please try again.");
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userOrderKeys.lists() });
    },
    onError: (error) => {
      console.error("Failed to cancel order:", error);
      toast.error("Failed to cancel order. Please try again.");
    },
  });
}

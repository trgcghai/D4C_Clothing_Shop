import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getOrdersByUserPaginated,
  getUserOrderDetail,
} from "@/src/services/orderApi";

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
    staleTime: 20_000,
  });
}

export function useUserOrderDetail(orderId: number | null) {
  return useQuery({
    queryKey: userOrderKeys.detail(orderId ?? 0),
    queryFn: () => getUserOrderDetail(orderId as number),
    enabled: orderId !== null,
    staleTime: 20_000,
  });
}

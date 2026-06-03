import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
  checkout,
  clearCartAfterCheckout,
  partialCheckout,
  removeCartItemsBulk,
  syncCartItems,
  type AddCartItemPayload,
  type UpdateCartItemPayload,
  type SyncRequest,
} from "@/src/services/cartApi";
import { toast } from "sonner";
import { isAxiosError } from "axios";

export const cartKeys = {
  all: ["cart"] as const,
  detail: () => [...cartKeys.all, "detail"] as const,
};

export function useCart() {
  return useQuery({
    queryKey: cartKeys.detail(),
    queryFn: getCart,
    staleTime: 30_000,
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddCartItemPayload) => addItemToCart(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      toast.success("Đã thêm vào giỏ hàng");
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Không thể thêm vào giỏ hàng";
        toast.error(msg);
      } else {
        toast.error("Không thể thêm vào giỏ hàng");
      }
    },
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: UpdateCartItemPayload }) =>
      updateCartItem(itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      toast.success("Đã cập nhật giỏ hàng");
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Không thể cập nhật";
        toast.error(msg);
      } else {
        toast.error("Không thể cập nhật");
      }
    },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) => removeCartItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      toast.success("Đã xóa sản phẩm khỏi giỏ hàng");
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Không thể xóa";
        toast.error(msg);
      } else {
        toast.error("Không thể xóa");
      }
    },
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearCart(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      toast.success("Đã xóa giỏ hàng");
    },
    onError: () => {
      toast.error("Không thể xóa giỏ hàng");
    },
  });
}

export function useValidateCart() {
  return useMutation({
    mutationFn: () => validateCart(),
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => checkout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Checkout thất bại";
        toast.error(msg);
      } else {
        toast.error("Checkout thất bại");
      }
    },
  });
}

export function useClearCartAfterCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearCartAfterCheckout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
}

export function usePartialCheckout() {
  return useMutation({
    mutationFn: partialCheckout,
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Checkout thất bại";
        toast.error(msg);
      } else {
        toast.error("Checkout thất bại");
      }
    },
  });
}

export function useRemoveCartItemsBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeCartItemsBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Không thể xóa sản phẩm";
        toast.error(msg);
      } else {
        toast.error("Không thể xóa sản phẩm");
      }
    },
  });
}

export function useSyncCartItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SyncRequest) => syncCartItems(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || "Khong the dong bo gio hang";
        toast.error(msg);
      } else {
        toast.error("Khong the dong bo gio hang");
      }
    },
  });
}

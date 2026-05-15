import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPayment,
  getPaymentStatus,
  getPaymentById,
  cancelPayment,
  getPaymentByOrderId,
  type CreatePaymentPayload,
} from "@/src/services/paymentApi";
import { toast } from "sonner";
import { isAxiosError } from "axios";

export const paymentKeys = {
  all: ["payments"] as const,
  detail: (id: number) => [...paymentKeys.all, "detail", id] as const,
  status: (id: number) => [...paymentKeys.all, "status", id] as const,
  byOrder: (orderId: number) => [...paymentKeys.all, "byOrder", orderId] as const,
};

export function useCreatePayment() {
  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) => createPayment(payload),
    onError: (error) => {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Tạo thanh toán thất bại");
      } else {
        toast.error("Tạo thanh toán thất bại");
      }
    },
  });
}

export function usePaymentById(paymentId: number | null) {
  return useQuery({
    queryKey: paymentKeys.detail(paymentId ?? 0),
    queryFn: () => getPaymentById(paymentId!),
    enabled: paymentId !== null,
  });
}

export function usePaymentStatus(paymentId: number | null, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.status(paymentId ?? 0),
    queryFn: () => getPaymentStatus(paymentId!),
    enabled: enabled && paymentId !== null,
    refetchInterval: 3000,
  });
}

export function useCancelPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: number) => cancelPayment(paymentId),
    onSuccess: () => {
      toast.info("Đã hủy thanh toán");
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Hủy thanh toán thất bại");
      } else {
        toast.error("Hủy thanh toán thất bại");
      }
    },
  });
}

export function usePaymentByOrderId(orderId: number | null, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.byOrder(orderId ?? 0),
    queryFn: () => getPaymentByOrderId(orderId!),
    enabled: enabled && orderId !== null,
  });
}

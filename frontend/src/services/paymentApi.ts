import axiosInstance from "@/src/services/_axios";

export type PaymentMethod = "QR" | "CASH";

export interface CreatePaymentPayload {
  orderId: number;
  checkoutOrderId: string;
  amount: number;
  method: PaymentMethod;
}

export interface PaymentResponse {
  paymentId: number;
  orderId: number;
  checkoutOrderId: string;
  paymentCode: string;
  amount: number;
  method: PaymentMethod;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  qrUrl?: string;
  expiresAt: string;
  createdAt: string;
}

export interface PaymentStatusResponse {
  paymentId: number;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  paidAt?: string;
}

export const createPayment = (payload: CreatePaymentPayload) =>
  axiosInstance
    .post<PaymentResponse>("/api/payments", payload)
    .then((res) => res.data);

export const getPaymentStatus = (paymentId: number) =>
  axiosInstance
    .get<PaymentStatusResponse>(`/api/payments/${paymentId}/status`)
    .then((res) => res.data);

export const getPaymentById = (paymentId: number) =>
  axiosInstance
    .get<PaymentResponse>(`/api/payments/${paymentId}`)
    .then((res) => res.data);

export const cancelPayment = (paymentId: number) =>
  axiosInstance
    .post<PaymentStatusResponse>(`/api/payments/${paymentId}/cancel`)
    .then((res) => res.data);

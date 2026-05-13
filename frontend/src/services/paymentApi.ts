import axios from "axios";
import { useStore } from "@/src/store";

function getToken(): string | null {
  const token = useStore.getState().token;
  if (token) return token;
  try {
    const raw = localStorage.getItem("d4c-auth-storage");
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.token || null;
    }
  } catch {
    // ignore
  }
  return null;
}

const paymentApi = axios.create({
  baseURL: import.meta.env.VITE_PAYMENT_SERVICE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

paymentApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  paymentApi.post<PaymentResponse>("/api/payments", payload).then((res) => res.data);

export const getPaymentStatus = (paymentId: number) =>
  paymentApi.get<PaymentStatusResponse>(`/api/payments/${paymentId}/status`).then((res) => res.data);

export const getPaymentById = (paymentId: number) =>
  paymentApi.get<PaymentResponse>(`/api/payments/${paymentId}`).then((res) => res.data);

export const cancelPayment = (paymentId: number) =>
  paymentApi.post<PaymentStatusResponse>(`/api/payments/${paymentId}/cancel`).then((res) => res.data);
